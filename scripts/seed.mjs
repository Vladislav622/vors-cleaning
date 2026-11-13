// Начальные настройки (если их нет) и, с флагом --demo, вымышленные заявки для просмотра кабинета.
import pg from "pg";
import { randomBytes, createHash } from "node:crypto";
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL не задан"); process.exit(1); }
const ssl = /sslmode=require|neon\.tech|supabase\.co/.test(url) ? { rejectUnauthorized: false } : undefined;
const c = new pg.Client({ connectionString: url, ssl });
await c.connect();
const demo = process.argv.includes("--demo");
const r = await c.query("select 1 from settings where id = 1");
if (!r.rowCount) {
  const data = {
    company: demo
      ? { name: "Ворс", tagline: "Выездная химчистка мягкой мебели", city: "Петропавловск", territory: "Город и пригород до 25 км", workHours: "Ежедневно 9:00–20:00", accent: "#2F6F62", demo: true }
      : { demo: false },
  };
  await c.query("insert into settings (id, data) values (1, $1)", [JSON.stringify(data)]);
  console.log("Настройки созданы.");
}
if (demo) {
  const tok = () => randomBytes(24).toString("base64url");
  const pricing = { currency: "₸", roundingStep: 100, minOrder: 8000, heavySoilingPct: 30, secondSidePct: 70, outOfTownFee: 3000,
    variants: { "sofa-2": 12000, "sofa-3": 15000, "sofa-corner": 19000, "armchair-standard": 6000, "armchair-recliner": 8000, "mattress-single": 7000, "mattress-double": 10000, "chair-seat": 1500, "chair-seat-back": 2500 } };
  const orders = [
    { name: "Тестовый Клиент", phone: "+70000000001", address: "ул. Вымышленная, 1, кв. 1", items: [
      { key: "sofa:sofa-corner:heavy:1s", category: "sofa", variant: "sofa-corner", qty: 1, heavy: true, secondSide: false, description: "", manual: false, basePrice: 19000, unitPrice: 24700, lineTotal: 24700 },
      { key: "chair:chair-seat:normal:1s", category: "chair", variant: "chair-seat", qty: 4, heavy: false, secondSide: false, description: "", manual: false, basePrice: 1500, unitPrice: 1500, lineTotal: 6000 }],
      estimate: { knownSubtotal: 30700, manualCount: 0, minOrder: 8000, minTopUp: 0, cleaningFrom: 30700, travelFee: 0, totalFrom: 30700, exact: true, manualOnly: false, currency: "₸" } },
    { name: "Демо Пользователь", phone: "+70000000002", address: "пос. Примерный, д. 7", out: true, items: [
      { key: "mattress:mattress-double:normal:2s", category: "mattress", variant: "mattress-double", qty: 1, heavy: false, secondSide: true, description: "", manual: false, basePrice: 10000, unitPrice: 17000, lineTotal: 17000 },
      { key: "other:1", category: "other", variant: null, qty: 1, heavy: false, secondSide: false, description: "Банкетка в прихожей, велюр", manual: true, basePrice: null, unitPrice: null, lineTotal: null }],
      estimate: { knownSubtotal: 17000, manualCount: 1, minOrder: 8000, minTopUp: 0, cleaningFrom: 17000, travelFee: 3000, totalFrom: 20000, exact: false, manualOnly: false, currency: "₸" } },
  ];
  for (const o of orders) {
    const key = "demo-" + createHash("sha256").update(o.phone).digest("hex").slice(0, 24);
    const ins = await c.query(`insert into orders (public_token, idempotency_key, request_hash, customer_name, phone, address, out_of_town, comment, consent_at, items, estimate, pricing_snapshot)
      values ($1,$2,'demo',$3,$4,$5,$6,'Демо-заявка, данные вымышленные', now(), $7,$8,$9) on conflict (idempotency_key) do nothing returning id`,
      [tok(), key, o.name, o.phone, o.address, !!o.out, JSON.stringify(o.items), JSON.stringify(o.estimate), JSON.stringify(pricing)]);
    if (ins.rows[0]) await c.query("insert into order_events (order_id, kind, payload) values ($1,'created',$2)", [ins.rows[0].id, JSON.stringify({ items: o.items.length, photos: 0 })]);
  }
  console.log("Демо-заявки добавлены.");
}
await c.end();
