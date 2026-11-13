for (const s of ["Regular","Medium","SemiBold","Bold","ExtraBold"]) await figma.loadFontAsync({family:"Manrope",style:s});
const V = Object.fromEntries((await figma.variables.getLocalVariablesAsync('COLOR')).map(v=>[v.name,v]));
let T = 'light';
const P = (n, opacity) => { const p = figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}}, 'color', V[`${T}/${n}`]); return opacity!=null ? {...p, opacity} : p; };
const AL = (dir, o = {}) => { const f = figma.createAutoLayout(dir); f.fills = []; f.set(o); return f; };
const put = (parent, ...kids) => { for (const k of kids) { if (!k) continue; parent.appendChild(k); } return parent; };
const fillW = n => { n.layoutSizingHorizontal = 'FILL'; return n; };
function tx(s, size, style = 'Regular', color = 'ink', o = {}) {
  const t = figma.createText(); t.fontName = {family:'Manrope', style}; t.fontSize = size; t.characters = s;
  t.fills = [P(color)]; t.lineHeight = {unit:'PERCENT', value: size >= 24 ? 110 : 140};
  if (size >= 24) t.letterSpacing = {unit:'PERCENT', value: -3};
  if (o.w) { t.resize(o.w, t.height); t.textAutoResize = 'HEIGHT'; }
  if (o.name) t.name = o.name;
  return t;
}
const wrapTx = (parent, t) => { parent.appendChild(t); t.textAutoResize = 'HEIGHT'; t.layoutSizingHorizontal = 'FILL'; return t; };
function card(o = {}) { const c = AL('VERTICAL', { name: o.name || 'Карточка', itemSpacing: o.gap ?? 12, paddingTop: 18, paddingBottom: 18, paddingLeft: 18, paddingRight: 18, cornerRadius: o.r ?? 22 }); c.fills = [P(o.fill || 'surface')]; c.strokes = [P('line')]; c.strokeWeight = 1; return c; }
function btn(label, kind = 'primary', o = {}) {
  const b = AL('HORIZONTAL', { name: `Кнопка / ${label}`, paddingLeft: 20, paddingRight: 20, cornerRadius: 16, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' });
  b.minHeight = o.h || 48; b.counterAxisSizingMode = 'AUTO';
  if (kind === 'primary') b.fills = [P('accent')]; else if (kind === 'ghost') { b.fills = [P('surface')]; b.strokes = [P('line')]; } else if (kind === 'danger') { b.strokes = [P('danger')]; }
  put(b, tx(label, o.size || 16, 'Bold', kind === 'primary' ? 'on-accent' : kind === 'danger' ? 'danger' : 'ink'));
  return b;
}
function chip(label, active) { const c = AL('HORIZONTAL', { name: `Чип / ${label}`, paddingLeft: 16, paddingRight: 16, paddingTop: 11, paddingBottom: 11, cornerRadius: 999 }); c.fills = [P(active ? 'ink' : 'surface')]; c.strokes = [P(active ? 'ink' : 'line')]; put(c, tx(label, 15, 'Bold', active ? 'bg' : 'ink')); return c; }
function seg(items, activeIdx) {
  const s = AL('HORIZONTAL', { name: 'Сегменты', itemSpacing: 4, paddingTop: 4, paddingBottom: 4, paddingLeft: 4, paddingRight: 4, cornerRadius: 16 }); s.fills = [P('bg-2')];
  items.forEach(([l, h], i) => { const b = AL('VERTICAL', { name: l, paddingTop: 8, paddingBottom: 8, paddingLeft: 6, paddingRight: 6, cornerRadius: 12, counterAxisAlignItems: 'CENTER', itemSpacing: 1 }); if (i === activeIdx) b.fills = [P('surface')]; put(b, tx(l, 14, 'Bold'), h ? tx(h, 11, 'Medium', 'muted') : null); s.appendChild(b); b.layoutSizingHorizontal = 'FILL'; });
  return s;
}
function sw(on) { const s = figma.createFrame(); s.name = on ? 'Переключатель / вкл' : 'Переключатель / выкл'; s.resize(52, 32); s.cornerRadius = 16; s.fills = [P(on ? 'accent' : 'line')]; const k = figma.createEllipse(); k.resize(24, 24); k.x = on ? 24 : 4; k.y = 4; k.fills = [{type:'SOLID', color:{r:1,g:1,b:1}}]; s.appendChild(k); return s; }
function row(label, hint, right) { const r = AL('HORIZONTAL', { name: `Строка / ${label}`, itemSpacing: 12, paddingTop: 10, paddingBottom: 10, counterAxisAlignItems: 'CENTER' }); const l = AL('VERTICAL', { itemSpacing: 2 }); put(l, tx(label, 15, 'Bold'), hint ? tx(hint, 13, 'Regular', 'muted') : null); put(r, l, right); l.layoutSizingHorizontal = 'FILL'; return r; }
function stepper(v) { const s = AL('HORIZONTAL', { name: 'Количество', itemSpacing: 4, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, cornerRadius: 14, counterAxisAlignItems: 'CENTER' }); s.fills = [P('surface')]; s.strokes = [P('line')]; put(s, tx('−', 18, 'Bold', 'muted'), tx(`   ${v}   `, 16, 'ExtraBold'), tx('+', 18, 'Bold')); return s; }
function field(label, value, o = {}) {
  const f = AL('VERTICAL', { name: `Поле / ${label}`, itemSpacing: 6 }); put(f, tx(label, 14, 'Bold'));
  const i = AL('HORIZONTAL', { name: 'Ввод', paddingLeft: 14, paddingRight: 14, paddingTop: 13, paddingBottom: 13, cornerRadius: 14 }); i.fills = [P('surface')]; i.strokes = [P(o.err ? 'danger' : o.focus ? 'accent' : 'line')]; i.strokeWeight = o.err || o.focus ? 1.5 : 1;
  put(i, tx(value || o.ph || ' ', 15, 'Regular', value ? 'ink' : 'muted')); f.appendChild(i); i.layoutSizingHorizontal = 'FILL';
  if (o.err) put(f, tx(o.err, 13, 'SemiBold', 'danger')); else if (o.hint) put(f, tx(o.hint, 13, 'Regular', 'muted'));
  return f;
}
function header(w) { const h = AL('HORIZONTAL', { name: 'Шапка', paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, itemSpacing: 8, counterAxisAlignItems: 'CENTER' }); h.fills = [P('bg')]; h.strokes = [P('line')]; h.strokeBottomWeight = 1; h.strokeTopWeight = 0; h.strokeLeftWeight = 0; h.strokeRightWeight = 0;
  const logo = AL('HORIZONTAL', { name: 'Логотип', itemSpacing: 9, counterAxisAlignItems: 'CENTER' }); const mark = figma.createFrame(); mark.name = 'Знак'; mark.resize(30, 30); mark.cornerRadius = 10; mark.fills = [P('accent')];
  for (const x of [9, 17]) { const e = figma.createRectangle(); e.resize(4, 6); e.cornerRadius = 2; e.x = x; e.y = 11; e.fills = [P('on-accent')]; mark.appendChild(e); }
  put(logo, mark, tx('Ворс', 21, 'ExtraBold')); put(h, logo); const sp = AL('HORIZONTAL'); h.appendChild(sp); sp.layoutSizingHorizontal = 'FILL';
  for (const n of ['Тема', 'Корзина']) { const b = AL('HORIZONTAL', { name: `Иконка / ${n}`, cornerRadius: 14, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10 }); b.fills = [P('surface')]; b.strokes = [P('line')]; put(b, tx(n === 'Тема' ? (T === 'dark' ? '☀' : '☾') : '🛍', 16, 'Regular')); h.appendChild(b); }
  return h; }
function screen(name, x, w = 390, y = 0) { const s = AL('VERTICAL', { name, itemSpacing: 0 }); s.fills = [P('bg')]; s.resize(w, 100); s.primaryAxisSizingMode = 'AUTO'; s.counterAxisSizingMode = 'FIXED'; s.x = x; s.y = y; s.clipsContent = true; return s; }
function body(parent, gap = 14) { const b = AL('VERTICAL', { name: 'Содержимое', itemSpacing: gap, paddingLeft: 16, paddingRight: 16, paddingTop: 14, paddingBottom: 24 }); parent.appendChild(b); b.layoutSizingHorizontal = 'FILL'; return b; }
function stage(h = 380, name = 'Сцена 3D') { const s = figma.createFrame(); s.name = name; s.resize(358, h); s.cornerRadius = 28; s.fills = [{type:'GRADIENT_LINEAR', gradientTransform: [[0,1,0],[-1,0,1]], gradientStops: [{position:0,color:{...(T==='dark'?{r:.094,g:.125,b:.114}:{r:1,g:1,b:1}),a:1}},{position:1,color:{...(T==='dark'?{r:.11,g:.18,b:.2}:{r:.84,g:.91,b:.93}),a:1}}]}]; s.strokes = [P('line')]; return s; }
function modelRect(parent, label, w = 300, h = 230, x = 29, y = 90) { const r = figma.createRectangle(); r.name = `Модель / ${label}`; r.resize(w, h); r.x = x; r.y = y; r.fills = [P('soap', 0.4)]; r.cornerRadius = 12; parent.appendChild(r); return r; }
function bubble(parent, s, x, y) { const b = AL('HORIZONTAL', { name: 'Реплика', paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10, topLeftRadius: 18, topRightRadius: 18, bottomRightRadius: 18, bottomLeftRadius: 6 }); b.fills = [P('ink')]; const t = tx(s, 14, 'SemiBold', 'bg'); t.resize(200, t.height); t.textAutoResize = 'HEIGHT'; b.appendChild(t); parent.appendChild(b); b.x = x; b.y = y; return b; }
function note(parent, s, kind = 'soap') { const n = AL('HORIZONTAL', { name: 'Плашка', paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, cornerRadius: 14 }); n.fills = [P(kind === 'alert' ? 'danger' : 'soap', kind === 'alert' ? 0.1 : 1)]; parent.appendChild(n); n.layoutSizingHorizontal = 'FILL'; wrapTx(n, tx(s, 14, kind === 'alert' ? 'SemiBold' : 'Regular', kind === 'alert' ? 'danger' : 'ink')); return n; }
function line2(l, r, o = {}) { const x = AL('HORIZONTAL', { name: 'Строка суммы', itemSpacing: 8 }); const a = tx(l, o.size || 15, o.bold ? 'ExtraBold' : 'Regular', o.muted ? 'muted' : 'ink'); const b = tx(r, o.size || 15, o.bold ? 'ExtraBold' : 'SemiBold', o.rc || (o.muted ? 'muted' : 'ink')); put(x, a); const sp = AL('HORIZONTAL'); x.appendChild(sp); sp.layoutSizingHorizontal = 'FILL'; put(x, b); return x; }
function tag(s) { const t = AL('HORIZONTAL', { name: 'Метка', paddingLeft: 9, paddingRight: 9, paddingTop: 3, paddingBottom: 3, cornerRadius: 8 }); t.fills = [P('warn', 0.14)]; put(t, tx(s, 12.5, 'Bold', 'warn')); return t; }
function cartItem(title, sub, price, opts = []) { const c = AL('VERTICAL', { name: `Позиция / ${title}`, itemSpacing: 10, paddingTop: 14, paddingBottom: 14 }); c.strokes = [P('line')]; c.strokeTopWeight = 0; c.strokeLeftWeight = 0; c.strokeRightWeight = 0; c.strokeBottomWeight = 1;
  const top = AL('HORIZONTAL', { itemSpacing: 10 }); const l = AL('VERTICAL', { itemSpacing: 2 }); put(l, tx(title, 16, 'Bold'), tx(sub, 13.5, 'Regular', 'muted')); put(top, l); const sp = AL('HORIZONTAL'); top.appendChild(sp); sp.layoutSizingHorizontal = 'FILL'; put(top, price === 'по фото' ? tag('по фото') : tx(price, 16, 'ExtraBold'));
  c.appendChild(top); top.layoutSizingHorizontal = 'FILL';
  if (opts.length) { const r = AL('HORIZONTAL', { itemSpacing: 8, counterAxisAlignItems: 'CENTER', layoutWrap: 'WRAP', counterAxisSpacing: 8 }); for (const [o, on] of opts) { const m = AL('HORIZONTAL', { name: o, paddingLeft: 12, paddingRight: 12, paddingTop: 9, paddingBottom: 9, cornerRadius: 12 }); m.fills = [P(on ? 'accent' : 'surface', on ? 0.1 : 1)]; m.strokes = [P(on ? 'accent' : 'line')]; put(m, tx(o, 13.5, 'SemiBold', on ? 'accent' : (o === 'Удалить' ? 'danger' : 'ink'))); r.appendChild(m); } c.appendChild(r); r.layoutSizingHorizontal = 'FILL'; }
  return c; }
