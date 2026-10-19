CREATE TABLE IF NOT EXISTS stock(item_id text PRIMARY KEY,name text NOT NULL,available int NOT NULL CHECK(available>=0),unit_price numeric(10,2) NOT NULL DEFAULT 0);
INSERT INTO stock(item_id,name,available,unit_price) VALUES
 ('burger','Classic Burger',25,9.50),('pizza','Margherita Pizza',20,12.00),('salad','Garden Salad',30,6.00),
 ('pasta','Creamy Truffle Pasta',18,13.50),('chicken','Lemon Herb Chicken',18,14.50),
 ('rice-bowl','Teriyaki Rice Bowl',24,11.50),('fries','Rosemary Fries',40,4.50),
 ('tomato-soup','Roasted Tomato Soup',20,5.50),('chocolate-cake','Chocolate Fudge Cake',16,6.50),
 ('berry-cheesecake','Berry Cheesecake',16,6.50)
 ON CONFLICT(item_id) DO UPDATE SET name=EXCLUDED.name,unit_price=EXCLUDED.unit_price;
CREATE TABLE IF NOT EXISTS reservations(order_id uuid NOT NULL,item_id text NOT NULL,quantity int NOT NULL,PRIMARY KEY(order_id,item_id));
CREATE TABLE IF NOT EXISTS processed_events(event_id uuid PRIMARY KEY,processed_at timestamptz NOT NULL DEFAULT now());
