import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Item = { id: string; name: string; description: string; category: string; price: number };
type Order = { id: string; status: string; table_number: number; total: string };
type Ticket = { order_id: string; customer_name: string; table_number: number; items: { name: string; quantity: number }[]; status: string };
type Tab = "menu" | "orders" | "kitchen" | "activity";

const api = async (path: string, init?: RequestInit) => {
  const response = await fetch(`/api/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "Request failed");
  return data;
};

const foodPhoto = (item: Item, index: number) => {
  if (item.id === "burger") return "/images/house-burger.jpg";
  if (item.id === "pizza") return "/images/margherita.jpg";
  if (item.id === "salad") return "/images/garden-bowl.jpg";
  if (item.id === "pasta") return "/images/creamy-pasta.jpg";
  if (item.id === "chicken") return "/images/herb-chicken.jpg";
  if (item.id === "rice-bowl") return "/images/rice-bowl.jpg";
  if (item.id === "fries") return "/images/rosemary-fries.jpg";
  if (item.id === "tomato-soup") return "/images/tomato-soup.jpg";
  if (item.id === "chocolate-cake") return "/images/chocolate-cake.jpg";
  if (item.id === "berry-cheesecake") return "/images/berry-cheesecake.jpg";
  return ["/images/house-burger.jpg", "/images/margherita.jpg", "/images/garden-bowl.jpg"][index % 3];
};

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("Guest");
  const [table, setTable] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("menu");
  const [menuCategory, setMenuCategory] = useState("All");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const total = useMemo(() => items.reduce((sum, item) => sum + (cart[item.id] || 0) * Number(item.price), 0), [items, cart]);
  const itemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const categories = ["All", ...["Mains", "Bowls", "Sides", "Desserts"].filter(category => items.some(item => (item.category || "Mains") === category))];
  const visibleItems = menuCategory === "All" ? items : items.filter(item => (item.category || "Mains") === menuCategory);

  const refresh = async () => {
    try {
      const [menu, orderRows, ticketRows, notificationRows] = await Promise.all([
        api("menu"), api("orders"), api("tickets"), api("notifications"),
      ]);
      setItems(menu.items);
      setOrders(orderRows);
      setTickets(ticketRows);
      setNotes(notificationRows);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Services unavailable");
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    return () => clearInterval(timer);
  }, []);

  const setQty = (id: string, quantity: number) => setCart(current => ({ ...current, [id]: Math.max(0, quantity) }));
  const placeOrder = async () => {
    const chosen = items.filter(item => cart[item.id] > 0).map(item => ({
      itemId: item.id, name: item.name, quantity: cart[item.id], unitPrice: Number(item.price),
    }));
    if (!chosen.length) return;
    setBusy(true);
    try {
      const order = await api("orders", {
        method: "POST",
        body: JSON.stringify({ customerName: name, tableNumber: Number(table), items: chosen }),
      });
      setCart({});
      setToast(`Order ${order.id.slice(0, 8)} placed`);
      setTab("orders");
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not place order");
    } finally {
      setBusy(false);
    }
  };

  const action = async (ticket: Ticket, next: "preparing" | "ready") => {
    try {
      await api(`tickets/${ticket.order_id}/${next}`, { method: "POST", body: "{}" });
      setToast(`Ticket moved to ${next}`);
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Action failed");
    }
  };

  return <main className="site-shell">
    <header className="topbar">
      <a className="wordmark" href="#top" onClick={() => setTab("menu")}><span className="wordmark-icon">G</span><span>GATHER<small>KITCHEN & TABLE</small></span></a>
      <nav aria-label="Main navigation">
        {([ ["menu", "Menu"], ["orders", "My orders"], ["kitchen", "Kitchen"], ["activity", "Activity"] ] as [Tab, string][]).map(([key, label]) =>
          <button key={key} className={tab === key ? "selected" : ""} onClick={() => setTab(key)}>{label}</button>)}
      </nav>
      <span className="open-status"><i /> OPEN <b>·</b> 11:00–22:00</span>
    </header>

    {toast && <div className="toast" role="status" onClick={() => setToast("")}>{toast}<button aria-label="Dismiss">×</button></div>}

    {tab === "menu" && <>
      <div className="menu-intro"><span className="intro-rule" /><span>GOOD FOOD · MADE FRESH · SHARED TOGETHER</span><span className="intro-rule" /></div>
      <section className="menu-cover" id="top">
        <div className="cover-glow" />
        <div className="cover-copy">
          <div className="cover-brand"><span className="tiny-sun">✳</span> GATHER <span className="cover-brand-line" /> <small>NEIGHBOURHOOD KITCHEN</small></div>
          <p className="cover-kicker">FRESH FROM OUR KITCHEN</p>
          <h1>Good food.<br /><em>Good mood.</em></h1>
          <p className="cover-description">Seasonal favourites, made with care<br />and served straight to your table.</p>
          <div className="cover-offer"><strong>01</strong><span>MADE FRESH<br />WHEN YOU ORDER</span></div>
          <button className="cover-cta" onClick={() => document.getElementById("our-menu")?.scrollIntoView({ behavior: "smooth" })}>EXPLORE THE MENU <span>↓</span></button>
        </div>
        <div className="cover-food" aria-label="A selection of Gather dishes">
          <div className="cover-photo cover-photo-large"><img src="/images/house-burger.jpg" alt="Gather's house burger" /><span className="photo-caption">THE HOUSE BURGER <i>✳</i></span></div>
          <div className="cover-photo cover-photo-small"><img src="/images/margherita.jpg" alt="Freshly baked margherita pizza" /></div>
          <div className="cover-photo cover-photo-small lower"><img src="/images/garden-bowl.jpg" alt="A fresh garden bowl" /></div>
          <div className="cover-sticker"><span>GOOD</span><b>FOOD</b><span>ALL DAY</span></div>
        </div>
        <div className="cover-index"><span>GATHER MENU</span><span>01 <i>/</i> {String(items.length).padStart(2, "0")}</span></div>
      </section>

      <section className="menu-area" id="our-menu">
        <div className="section-title">
          <div><p className="eyebrow">COOKED WITH A LITTLE EXTRA LOVE</p><h2>On the menu<span>.</span></h2></div>
          <p className="menu-note">All the good stuff, made fresh<br />and ready when you are.</p>
        </div>
        <div className="menu-controls"><div className="category-tabs" aria-label="Filter menu by category">{categories.map(category => <button key={category} className={menuCategory === category ? "active" : ""} onClick={() => setMenuCategory(category)}>{category}<span>{category === "All" ? items.length : items.filter(item => (item.category || "Mains") === category).length}</span></button>)}</div><span className="results-count">{visibleItems.length} FRESH PICKS</span></div>
        <div className="menu-layout">
          <div className="menu-list">
            <div className="menu-list-top"><span>{menuCategory === "All" ? "THE EVERYDAY FAVOURITES" : menuCategory.toUpperCase()}</span><span>PRICE <i>·</i> ADD</span></div>
            {visibleItems.map((item, index) => <article className="menu-item" key={item.id}>
              <div className="item-photo"><img src={foodPhoto(item, index)} alt={item.name} /><span className="item-number">{String(index + 1).padStart(2, "0")}</span></div>
              <div className="item-copy"><span className="item-tag">{item.id === "burger" ? "GATHER CLASSIC" : item.category.toUpperCase()}</span><h3>{item.name}</h3><p>{item.description}</p><span className="item-ingredients">FRESHLY PREPARED · HOUSE FAVOURITE</span></div>
              <div className="item-order"><strong>${Number(item.price).toFixed(2)}</strong><div className="quantity-control"><button aria-label={`Remove one ${item.name}`} onClick={() => setQty(item.id, (cart[item.id] || 0) - 1)}>−</button><span>{cart[item.id] || 0}</span><button aria-label={`Add one ${item.name}`} onClick={() => setQty(item.id, (cart[item.id] || 0) + 1)}>+</button></div></div>
            </article>)}
            {!items.length && <p className="empty">The menu is warming up. Please check back in a moment.</p>}
            <div className="menu-footnote"><span>✳</span> GOOD THINGS TAKE TIME. YOURS IS MADE TO ORDER.</div>
          </div>
          <aside className="order-card">
            <div className="order-card-top"><p className="eyebrow">YOUR ORDER</p><span className="bag-count">{itemCount.toString().padStart(2, "0")}</span></div>
            <h3>Make it<br /><em>your own.</em></h3>
            <label className="field-label">YOUR NAME<input value={name} onChange={event => setName(event.target.value)} placeholder="Name for the order" /></label>
            <label className="field-label">TABLE NUMBER<input type="number" min="1" value={table} onChange={event => setTable(Number(event.target.value))} /></label>
            <div className="order-lines">{items.filter(item => cart[item.id] > 0).map(item => <div className="order-line" key={item.id}><span>{cart[item.id]} × {item.name}</span><b>${(cart[item.id] * Number(item.price)).toFixed(2)}</b></div>)}{itemCount === 0 && <p>Choose something delicious to get started.</p>}</div>
            <div className="order-total"><span>YOUR TOTAL</span><strong>${total.toFixed(2)}</strong></div>
            <button className="place-order" disabled={busy || total === 0 || !name.trim() || table < 1} onClick={placeOrder}>{busy ? "SENDING YOUR ORDER…" : "PLACE YOUR ORDER"}<span>↗</span></button>
            <p className="order-caption">FRESHLY MADE · SENT STRAIGHT TO THE KITCHEN</p>
          </aside>
        </div>
      </section>
      <section className="closing-note"><span>✳</span><p>Gather around.<br /><em>There's always room at our table.</em></p><span>✳</span></section>
    </>}

    {tab === "orders" && <section className="utility-page"><div className="utility-heading"><p className="eyebrow">FROM OUR KITCHEN TO YOUR TABLE</p><h1>Your orders<span>.</span></h1><p>Follow along while we make something good.</p></div><div className="order-history">{orders.map(order => <article className="history-row" key={order.id}><div className="history-id">ORDER {order.id.slice(0, 8).toUpperCase()} <span>·</span> TABLE {order.table_number}</div><h2>{order.status.replaceAll("_", " ")}</h2><span className={`status-pill ${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span><strong>${Number(order.total).toFixed(2)}</strong></article>)}{!orders.length && <p className="empty">Your orders will appear here.</p>}</div></section>}

    {tab === "kitchen" && <section className="utility-page"><div className="utility-heading"><p className="eyebrow">SERVICE IN PROGRESS</p><h1>Kitchen board<span>.</span></h1><p>{tickets.filter(ticket => ticket.status === "QUEUED" || ticket.status === "PREPARING").length} active tickets</p></div><div className="ticket-grid">{tickets.map(ticket => <article className="ticket" key={ticket.order_id}><div className="ticket-head"><span>TABLE {ticket.table_number}</span><span className={`status-pill ${ticket.status.toLowerCase()}`}>{ticket.status}</span></div><h2>{ticket.customer_name}</h2><ul>{ticket.items.map((item, index) => <li key={index}><b>{item.quantity}×</b> {item.name}</li>)}</ul>{ticket.status === "QUEUED" && <button className="place-order" onClick={() => action(ticket, "preparing")}>START PREPARING <span>→</span></button>}{ticket.status === "PREPARING" && <button className="place-order" onClick={() => action(ticket, "ready")}>MARK READY <span>✓</span></button>}</article>)}{!tickets.length && <p className="empty">New orders will appear here as soon as they reach the kitchen.</p>}</div></section>}

    {tab === "activity" && <section className="utility-page"><div className="utility-heading"><p className="eyebrow">A LITTLE LOOK BEHIND THE SCENES</p><h1>Fresh from the kitchen<span>.</span></h1><p>Live updates from your order.</p></div><div className="activity-list">{notes.map(note => <article className="activity-row" key={note.id}><span className="activity-star">✳</span><div><small>{note.event_type} · ORDER {note.order_id.slice(0, 8).toUpperCase()}</small><h2>{note.message}</h2></div><time>{new Date(note.created_at).toLocaleTimeString()}</time></article>)}{!notes.length && <p className="empty">Order updates will appear here.</p>}</div></section>}

    <footer className="site-footer"><a className="wordmark" href="#top" onClick={() => setTab("menu")}><span className="wordmark-icon">G</span><span>GATHER<small>KITCHEN & TABLE</small></span></a><span>GOOD FOOD · GOOD COMPANY · EVERY DAY</span><span>OPEN DAILY <i>11:00–22:00</i></span></footer>
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
