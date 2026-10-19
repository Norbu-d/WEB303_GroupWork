CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS orders(id uuid PRIMARY KEY, customer_name text NOT NULL, table_number int NOT NULL, items jsonb NOT NULL, total numeric(10,2) NOT NULL, status text NOT NULL DEFAULT 'PENDING', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS correlation_id uuid;
UPDATE orders SET correlation_id=gen_random_uuid() WHERE correlation_id IS NULL;
ALTER TABLE orders ALTER COLUMN correlation_id SET DEFAULT gen_random_uuid();
ALTER TABLE orders ALTER COLUMN correlation_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'PENDING';
CREATE TABLE IF NOT EXISTS outbox(id bigserial PRIMARY KEY,event_id uuid UNIQUE,event_type text NOT NULL,routing_key text,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz);
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS routing_key text;
UPDATE outbox SET event_id=COALESCE(event_id,(payload->>'eventId')::uuid,gen_random_uuid()) WHERE event_id IS NULL;
UPDATE outbox SET routing_key=CASE COALESCE(payload->>'type',event_type)
  WHEN 'OrderPlaced' THEN 'order.placed' WHEN 'OrderCancelled' THEN 'order.cancelled'
  WHEN 'OrderPreparing' THEN 'order.preparing' WHEN 'OrderReady' THEN 'order.ready'
  WHEN 'StockReserved' THEN 'stock.reserved' WHEN 'StockInsufficient' THEN 'stock.insufficient'
  ELSE COALESCE(payload->>'routingKey','unknown') END WHERE routing_key IS NULL;
ALTER TABLE outbox ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE outbox ALTER COLUMN routing_key SET NOT NULL;
CREATE TABLE IF NOT EXISTS processed_events(event_id uuid PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now());
