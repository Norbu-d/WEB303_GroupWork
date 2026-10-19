# Integration test plan

Record actual outcome, date, commit and evidence during the live Docker run. All actual results below are intentionally **Not run**; expected outcomes are acceptance criteria, not measured results.

| # | Scenario | Action | Expected result | Actual |
|---|---|---|---|---|
| 1 | Successful operation | Submit a valid order whose items have stock. | HTTP 202 with `PENDING`; then `CONFIRMED`; kitchen ticket appears; notification is stored. | Not run |
| 2 | Event delivery | Place an order and inspect service state / broker logs. | `OrderPlaced` reaches order, kitchen, inventory and notification workflows; order eventually advances from inventory result. | Not run |
| 3 | Multiple consumers | Place one order and inspect all three consumer-owned stores. | Kitchen ticket, inventory reservation/stock adjustment and notification are independently recorded. | Not run |
| 4 | Event chaining | Submit an order exceeding available stock. | Inventory emits `StockInsufficient`; order becomes `REJECTED` and emits `OrderCancelled`; kitchen cancels ticket. | Not run |
| 5 | Consumer unavailable | Stop kitchen-service, place at least three orders, inspect `kitchen.q`. | Durable queue retains messages while the consumer is stopped. | Not run |
| 6 | Consumer recovery | Restart kitchen-service after scenario 5. | Queued orders are consumed and tickets appear without resubmission. | Not run |
| 7 | Duplicate event | Redeliver an already processed event with its original event ID. | `processed_events` prevents the same database effect from being applied twice. | Not run |
| 8 | Complete user workflow | Use customer menu/cart, order, kitchen preparing/ready actions and status/activity tabs. | The UI shows order creation, live status progression, ready notification and useful errors for unavailable services. | Not run |

## Evidence log template

| Scenario | Date / commit | Expected | Actual | Screenshot or log path | Notes |
|---|---|---|---|---|---|
| | | | | | |

For failure-and-recovery evidence, capture the stopped kitchen container, the nonzero `kitchen.q` depth, the queue draining after restart, and the resulting kitchen tickets. Avoid including credentials in screenshots.
