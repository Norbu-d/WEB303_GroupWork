import amqp, { Channel, ConsumeMessage } from "amqplib";
import { Pool } from "pg";
import { AnyEvent, buildEvent, DLQ, DLX, EXCHANGE, MAX_ATTEMPTS, parseEvent, Queues, RoutingKey } from "@food/event-contracts";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export async function migrate(sql: string) { await pool.query(sql); }
export async function once(event: AnyEvent, work: (client: import("pg").PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const inserted = await client.query("INSERT INTO processed_events(event_id) VALUES($1) ON CONFLICT DO NOTHING", [event.eventId]); if (inserted.rowCount) await work(client); await client.query("COMMIT"); }
  catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
export async function withBroker(run: (channel: Channel) => Promise<void>) {
  const conn = await amqp.connect(process.env.AMQP_URL || "amqp://food:food_pass@rabbitmq:5672");
  const ch = await conn.createConfirmChannel(); await ch.prefetch(10);
  await ch.assertExchange(EXCHANGE,"topic",{durable:true}); await ch.assertExchange(DLX,"fanout",{durable:true});
  await ch.assertQueue(DLQ,{durable:true}); await ch.bindQueue(DLQ,DLX,DLQ);
  try { await run(ch); } catch (e) { await ch.close(); await conn.close(); throw e; }
  return { ch, conn };
}
export async function consume(ch: Channel, queue: keyof typeof Queues, handler: (event: AnyEvent) => Promise<void>) {
  const spec = Queues[queue];
  await ch.assertQueue(spec.name,{durable:true,arguments:{"x-dead-letter-exchange":DLX}}); for (const key of spec.bindings) await ch.bindQueue(spec.name,EXCHANGE,key);
  await ch.consume(spec.name, async (msg: ConsumeMessage|null) => {
    if (!msg) return;
    let event: AnyEvent; try { const parsed = parseEvent(JSON.parse(msg.content.toString())); if (!parsed.ok) { console.error("Invalid event", parsed.error); ch.nack(msg,false,false); return; } event = parsed.event; }
    catch { ch.nack(msg,false,false); return; }
    const attempt = Number(msg.properties.headers?.['x-attempt'] || 0);
    try { console.info(JSON.stringify({eventId:event.eventId,orderId:(event as any).data.orderId,correlationId:event.correlationId,type:event.type})); await handler(event); ch.ack(msg); }
    catch (error) { console.error("Event handler failed",error); if (attempt + 1 >= MAX_ATTEMPTS) ch.publish(DLX,DLQ,msg.content,{persistent:true,headers:{'x-attempt':attempt+1}}); else ch.publish(EXCHANGE,msg.fields.routingKey,msg.content,{persistent:true,headers:{'x-attempt':attempt+1}}); ch.ack(msg); }
  });
}
export function publish(ch: Channel,type: keyof typeof RoutingKey,data: any,correlationId?: string) { const event=buildEvent(type as any,data,correlationId); ch.publish(EXCHANGE,RoutingKey[type],Buffer.from(JSON.stringify(event)),{persistent:true,contentType:"application/json",messageId:event.eventId,correlationId:event.correlationId}); return event; }
export async function startOutbox(ch: Channel) { let running=false; setInterval(async()=>{ if(running)return;running=true;const client=await pool.connect(); try { const rows=await client.query("SELECT id,routing_key,payload FROM outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 50"); for(const row of rows.rows)ch.publish(EXCHANGE,row.routing_key,Buffer.from(JSON.stringify(row.payload)),{persistent:true,contentType:"application/json",messageId:row.payload.eventId,correlationId:row.payload.correlationId}); if(rows.rowCount){ await (ch as any).waitForConfirms(); await client.query("UPDATE outbox SET published_at=now() WHERE id=ANY($1)",[rows.rows.map(r=>r.id)]); } } catch(e){console.error("Outbox publish failed; rows will retry",e);} finally{client.release();running=false;}},500); }
