# progress.md - WEB303 Lab 6: Event-Driven Food Ordering Microservices

Last updated: 19 Oct 2026
Status: implementation complete; build succeeds. Live Docker workflow, eight runtime scenarios, screenshots, final PDF and member-specific presentation still need the group's real execution and details.

## Current implementation update (19 Oct 2026)

The starter repository has now been expanded into the target runnable monorepo: shared event contracts and runtime; order, inventory, kitchen, notification and menu services; API gateway; React/Vite ordering, status, kitchen and event-feed UI; Compose definitions and Dockerfiles; architecture notes and an eight-scenario acceptance plan. The menu contains ten dishes with category filters and matching inventory rows. `npm run build` completes successfully across the TypeScript workspaces and Vite production build. `docker compose config --quiet` passes. `docker compose up --build -d` started the full stack successfully; the API health endpoint returned healthy and the gateway returned the seeded menu.

The plan in `docs/test-cases.md` deliberately records actual results as **Not run**. The final lab requires a live failure/recovery demonstration, screenshots, observed test results, member names/contributions and a rehearsal. Those items need to be recorded from the group's run; they are not fabricated in this repository.

Order creation was also checked against the existing persistent database. Its earlier schema had no outbox `routing_key` and required an explicit order status. The order migration now adds the missing fields without resetting stored data, and order inserts set `PENDING` explicitly. A new order was confirmed through the full RabbitMQ flow; the temporary verification order was removed and its inventory reservation restored.

---

## 1. Project overview and goal

**Course / task:** WEB303 Lab 6 - Designing and Implementing an Event-Driven Microservices Application with Asynchronous Communication. It is a group practical (new group, separate from DrukLeague).

**Chosen application:** Restaurant food ordering. A customer places an order, and independent services react to events: the kitchen prepares it, inventory reserves stock, notifications go out, and the order status updates.

**Goal (what the lab assesses):**
- At least 4 independently functioning microservices, each with its own data store (no shared DB ownership).
- Asynchronous communication through a message broker. REST/gRPC is allowed but events must be central.
- At least 3 distinct event types.
- At least one event processed by two different services (multiple consumers).
- At least one event chain (processing an event publishes another event).
- Reliability: error handling, no message loss when a consumer is down, duplicate-safe processing, logging, resume after restart, and one full failure-and-recovery demo.
- A functional UI that triggers and reflects event-driven workflows, with success/failure feedback.
- 8 integration tests with expected vs actual results: successful operation, event delivery, multiple consumers, event chaining, consumer unavailable, consumer recovery, duplicate event, complete user workflow.
- Live demo and presentation; every member explains their own part.
- Final PDF report (title and members, description, services, architecture diagram, event descriptions, messaging tech explanation, screenshots, test results, failure evidence, individual contributions). It must reflect what was actually built.

**Report formatting:** APA 7th edition (Times New Roman 12pt, double spaced, 1-inch margins, page numbers top-right, student title page, References page with hanging indent). Department line: Department of Software Engineering, College of Science and Technology, Royal University of Bhutan.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Backend language | TypeScript on Node.js 20+ (agreed with the user) |
| Message broker | RabbitMQ 3.13 (recommended; durable queues, manual acks, dead-letter exchange, management UI at :15672). NATS JetStream is the fallback if the group prefers it. |
| Databases | PostgreSQL 16, one database + one login role per service (isolated) |
| Event validation | zod schemas in a shared contracts package |
| Frontend | Vite (React is my suggestion, not yet confirmed) |
| Infra / run | Docker Compose, npm workspaces monorepo |
| Planned per-service libs (not yet chosen) | Express or Fastify, `amqplib`, `pg` or an ORM, `pino` for logging |

---

## 3. Original foundation (before the implementation update above)

The repository began with these foundation files; the current implementation adds the service, gateway, shared runtime, UI, Compose definitions and docs listed in the update at the top of this file.

| File | What it does |
|---|---|
| `package.json` | Root npm workspaces config (`packages/*`, `services/*`, `web`) plus helper scripts (`build:contracts`, `infra:up`, `infra:down`, `infra:reset`). |
| `.gitignore` | Ignores `node_modules`, `dist`, `.env`, logs. |
| `docker-compose.yml` | Starts RabbitMQ (AMQP 5672, UI 15672, persistent volume, healthcheck) and one Postgres 16 container that runs `init.sql` on first start. |
| `infra/postgres/init.sql` | Creates 5 databases (`menu_db`, `order_db`, `kitchen_db`, `inventory_db`, `notification_db`), 5 login roles, and revokes `CONNECT` from PUBLIC so a service cannot open another service's database. |
| `packages/event-contracts/package.json` | Package `@food/event-contracts` (depends on zod, builds with tsc). |
| `packages/event-contracts/tsconfig.json` | Strict TypeScript, CommonJS output to `dist/`. |
| `packages/event-contracts/src/index.ts` | Single source of truth for the broker topology (exchange, DLX, DLQ, queue bindings, `MAX_ATTEMPTS`), the 6 event payload schemas, the shared event envelope, `buildEvent()` and `parseEvent()`. |
| `README.md` | Startup commands and layout notes. |

**Verified:** the contracts package compiles with `tsc`, and a quick Node check showed a valid `OrderPlaced` parses, a malformed one is rejected, and an unknown type is rejected.
**Not verified:** `docker compose up` was not run in the sandbox. Test it on your machine.

### Architecture decisions made

Services (each with its own DB): `menu-service`, `order-service`, `kitchen-service`, `inventory-service`, `notification-service`, plus a stateless `api-gateway` (REST entry point for the UI).

Events:

| Event | Published by | Consumed by |
|---|---|---|
| `OrderPlaced` | order | kitchen, inventory, notification |
| `StockReserved` | inventory | order |
| `StockInsufficient` | inventory | order, notification |
| `OrderPreparing` | kitchen | order |
| `OrderReady` | kitchen | order, notification |
| `OrderCancelled` | order | kitchen, inventory |

How the lab requirements are met:
- Multiple consumers: `OrderPlaced` is processed by kitchen, inventory and notification.
- Event chaining: `OrderPlaced` -> inventory publishes `StockInsufficient` -> order-service sets `REJECTED` and publishes `OrderCancelled` -> kitchen drops the order.
- 6 event types (minimum is 3).

Reliability design:
- Transactional outbox in order-service: the order row and the outgoing event are written in one DB transaction, then a publisher loop sends unsent rows to RabbitMQ.
- Durable per-service queues with manual ack after successful processing.
- Retry up to 3 times (attempt counter in a message header), then reject to `food.dlq`.
- Idempotent consumers: a `processed_events(event_id PRIMARY KEY)` table in each consumer's DB.
- Every log line includes `eventId`, `orderId` and `correlationId`.
- Failure demo: stop kitchen-service, place 3 orders, show them queued in RabbitMQ, restart the service, show all 3 arrive.

Main workflow: `POST /orders` -> order saved as `PENDING` -> `OrderPlaced` -> kitchen, inventory and notification each react -> `StockReserved` or `StockInsufficient` -> order becomes `CONFIRMED` or `REJECTED` -> kitchen `PREPARING` then `READY` -> order status updated and notification sent -> UI shows live status.

Suggested split for 4 people: (1) order-service + gateway, (2) kitchen-service + kitchen UI, (3) inventory-service + menu-service, (4) notification-service + customer UI + shared contracts.

---

## 4. Original foundation code

### `package.json` (root)

```json
{
  "name": "food-ordering",
  "private": true,
  "workspaces": ["packages/*", "services/*", "web"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build:contracts": "npm run build -w @food/event-contracts",
    "infra:up": "docker compose up -d",
    "infra:down": "docker compose down",
    "infra:reset": "docker compose down -v"
  }
}
```

### `.gitignore`

```
node_modules/
dist/
.env
*.log
```

### `docker-compose.yml`

```yaml
# Shared infrastructure only. Each service gets its own entry here once it exists.
services:
  rabbitmq:
    image: rabbitmq:3.13-management
    container_name: food-rabbitmq
    ports:
      - "5672:5672"     # AMQP
      - "15672:15672"   # Management UI -> http://localhost:15672
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-food}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS:-food_pass}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq   # keeps durable queues across restarts
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10

  postgres:
    image: postgres:16-alpine
    container_name: food-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${PG_ADMIN_USER:-postgres}
      POSTGRES_PASSWORD: ${PG_ADMIN_PASS:-postgres_admin_pass}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  rabbitmq_data:
  postgres_data:
```

### `infra/postgres/init.sql`

```sql
-- One database + one login role per service. Nobody else can connect to it,
-- so a service physically cannot read another service's data.
CREATE ROLE menu_user         LOGIN PASSWORD 'menu_pass';
CREATE ROLE order_user        LOGIN PASSWORD 'order_pass';
CREATE ROLE kitchen_user      LOGIN PASSWORD 'kitchen_pass';
CREATE ROLE inventory_user    LOGIN PASSWORD 'inventory_pass';
CREATE ROLE notification_user LOGIN PASSWORD 'notification_pass';

CREATE DATABASE menu_db         OWNER menu_user;
CREATE DATABASE order_db        OWNER order_user;
CREATE DATABASE kitchen_db      OWNER kitchen_user;
CREATE DATABASE inventory_db    OWNER inventory_user;
CREATE DATABASE notification_db OWNER notification_user;

REVOKE CONNECT ON DATABASE menu_db         FROM PUBLIC;
REVOKE CONNECT ON DATABASE order_db        FROM PUBLIC;
REVOKE CONNECT ON DATABASE kitchen_db      FROM PUBLIC;
REVOKE CONNECT ON DATABASE inventory_db    FROM PUBLIC;
REVOKE CONNECT ON DATABASE notification_db FROM PUBLIC;
```

### `packages/event-contracts/package.json`

```json
{
  "name": "@food/event-contracts",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -p tsconfig.json" },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "@types/node": "^20.14.0", "typescript": "^5.5.0" }
}
```

### `packages/event-contracts/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### `packages/event-contracts/src/index.ts`

```ts
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
```

### `README.md`

```
# Food Ordering - Event-Driven Microservices (WEB303 Lab 6)

## Start infrastructure
npm install
npm run build:contracts
npm run infra:up

- RabbitMQ UI: http://localhost:15672 (food / food_pass)
- Postgres: localhost:5432, one database and one role per service (see infra/postgres/init.sql)

## Layout
- packages/event-contracts : event names, payload schemas, routing keys, queue bindings
- services/                : one folder per microservice (added next)
- web/                     : Vite UI (added later)
- docs/                    : architecture, test cases
```

Dev-only credentials: RabbitMQ `food` / `food_pass`; Postgres admin `postgres` / `postgres_admin_pass`; service roles `<service>_user` / `<service>_pass`. Never reuse these for anything real.

---

## 5. Remaining work

The implementation work is complete. Before submission, the group still needs to:

1. Run the Compose stack on the demo machine and follow the eight acceptance scenarios in `docs/test-cases.md`; enter actual results and commit/date details.
2. Perform the kitchen stop/recovery demonstration and save screenshots under `docs/screenshots/`.
3. Confirm student names, group allocation and individual contributions; rehearse each member's service explanation.
4. Produce the final APA 7 PDF from the observed run, with title page, architecture/event descriptions, screenshots, results and contributions. The evidence must come from the group's real run.

The implementation choices are RabbitMQ, React/Vite, Express, PostgreSQL `pg`, and npm workspaces. The event schema source remains `packages/event-contracts/src/index.ts`.

---

## 6. Handoff

The current project lives in this workspace. Start with `README.md`, then consult `docs/architecture.md` and `docs/test-cases.md`. The next work should be the live stack run, evidence capture, actual test results, and the APA report based on those results. Keep event definitions in `packages/event-contracts/src/index.ts` consistent if event behavior changes.
