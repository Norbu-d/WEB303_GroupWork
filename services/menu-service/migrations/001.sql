CREATE TABLE IF NOT EXISTS menu_items(id text PRIMARY KEY,name text NOT NULL,description text NOT NULL DEFAULT '',category text NOT NULL DEFAULT 'Mains',price numeric(10,2) NOT NULL CHECK(price>=0),available boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Mains';
INSERT INTO menu_items(id,name,description,category,price) VALUES
 ('burger','Classic Burger','Griddled beef, sharp cheddar, lettuce and Gather sauce.','Mains',9.50),
 ('pizza','Margherita Pizza','Wood-fired tomato, mozzarella, basil and olive oil.','Mains',12.00),
 ('salad','Garden Salad','Crisp leaves, cucumber, tomato and lemon herb dressing.','Bowls',6.00),
 ('pasta','Creamy Truffle Pasta','Silky parmesan cream, mushrooms and a touch of truffle.','Mains',13.50),
 ('chicken','Lemon Herb Chicken','Char-grilled chicken, rosemary potatoes and greens.','Mains',14.50),
 ('rice-bowl','Teriyaki Rice Bowl','Sticky rice, glazed vegetables, sesame and scallions.','Bowls',11.50),
 ('fries','Rosemary Fries','Golden hand-cut fries with rosemary sea salt.','Sides',4.50),
 ('tomato-soup','Roasted Tomato Soup','Slow-roasted tomatoes, basil and warm sourdough.','Sides',5.50),
 ('chocolate-cake','Chocolate Fudge Cake','Dark chocolate sponge with a soft ganache centre.','Desserts',6.50),
 ('berry-cheesecake','Berry Cheesecake','Vanilla cheesecake, berry compote and biscuit crumb.','Desserts',6.50)
 ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,category=EXCLUDED.category,price=EXCLUDED.price;
