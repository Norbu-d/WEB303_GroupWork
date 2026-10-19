import { randomUUID } from "node:crypto";
import { z } from "zod";

// ---- Broker topology (single source of truth for all services) ----
export const EXCHANGE = "food.events"; // topic exchange
export const DLX = "food.dlx";         // dead-letter exchange
export const DLQ = "food.dlq";         // dead-letter queue
export const MAX_ATTEMPTS = 3;         // retries before a message goes to the DLQ

export const RoutingKey = {
  OrderPlaced: "order.placed",
  OrderCancelled: "order.cancelled",
  OrderPreparing: "order.preparing",
  OrderReady: "order.ready",
  StockReserved: "stock.reserved",
  StockInsufficient: "stock.insufficient",
} as const;

export type EventType = keyof typeof RoutingKey;

// Each service owns one durable queue and binds only to what it needs.
export const Queues = {
  kitchen: { name: "kitchen.q", bindings: ["order.placed", "order.cancelled"] },
  inventory: { name: "inventory.q", bindings: ["order.placed", "order.cancelled"] },
  notification: {
    name: "notification.q",
    bindings: ["order.placed", "stock.insufficient", "order.ready"],
  },
  order: {
    name: "order.q",
    bindings: ["stock.reserved", "stock.insufficient", "order.preparing", "order.ready"],
  },
} as const;

// ---- Event payloads (self-contained so consumers never call the publisher) ----
const uuid = z.string().uuid();

const OrderItem = z.object({
  itemId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const DataSchemas = {
  OrderPlaced: z.object({
    orderId: uuid,
    customerName: z.string().min(1),
    tableNumber: z.number().int().positive(),
    items: z.array(OrderItem).min(1),
    total: z.number().nonnegative(),
  }),
  OrderCancelled: z.object({ orderId: uuid, reason: z.string().min(1) }),
  OrderPreparing: z.object({ orderId: uuid }),
  OrderReady: z.object({ orderId: uuid, readyAt: z.string().datetime() }),
  StockReserved: z.object({
    orderId: uuid,
    items: z.array(z.object({ itemId: z.string(), quantity: z.number().int().positive() })),
  }),
  StockInsufficient: z.object({
    orderId: uuid,
    shortages: z.array(
      z.object({
        itemId: z.string(),
        requested: z.number().int().positive(),
        available: z.number().int().nonnegative(),
      }),
    ),
  }),
} as const;

// ---- Envelope shared by every event ----
function envelope<T extends EventType, D extends z.ZodTypeAny>(type: T, data: D) {
  return z.object({
    eventId: uuid,            // used by consumers for idempotency
    type: z.literal(type),
    version: z.literal(1),
    occurredAt: z.string().datetime(),
    correlationId: uuid,      // stays the same across a whole order workflow
    data,
  });
}

export const Schemas = {
  OrderPlaced: envelope("OrderPlaced", DataSchemas.OrderPlaced),
  OrderCancelled: envelope("OrderCancelled", DataSchemas.OrderCancelled),
  OrderPreparing: envelope("OrderPreparing", DataSchemas.OrderPreparing),
  OrderReady: envelope("OrderReady", DataSchemas.OrderReady),
  StockReserved: envelope("StockReserved", DataSchemas.StockReserved),
  StockInsufficient: envelope("StockInsufficient", DataSchemas.StockInsufficient),
} as const;

export type EventOf<T extends EventType> = z.infer<(typeof Schemas)[T]>;
export type AnyEvent = { [K in EventType]: EventOf<K> }[EventType];

/** Create a validated-shape event. Pass the incoming correlationId when chaining. */
export function buildEvent<T extends EventType>(
  type: T,
  data: z.infer<(typeof DataSchemas)[T]>,
  correlationId: string = randomUUID(),
): EventOf<T> {
  return {
    eventId: randomUUID(),
    type,
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId,
    data,
  } as EventOf<T>;
}

/** Validate an incoming message. A failed parse should be rejected straight to the DLQ. */
export function parseEvent(
  raw: unknown,
): { ok: true; event: AnyEvent } | { ok: false; error: string } {
  const type = (raw as { type?: string } | null)?.type;
  if (!type || !(type in Schemas)) return { ok: false, error: `unknown event type: ${String(type)}` };
  const result = (Schemas[type as EventType] as z.ZodTypeAny).safeParse(raw);
  return result.success
    ? { ok: true, event: result.data as AnyEvent }
    : { ok: false, error: result.error.message };
}
