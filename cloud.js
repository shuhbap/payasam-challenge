// Google Sheets sync: orders, teams, expenses (upsert by id, last-write-wins by `updated`)
const KINDS = ['teams', 'orders', 'expenses'];
const NORM = {
  teams: c => ({ ...c, members: String(c.members || '').split('|').filter(Boolean), settledCash: +c.settledCash || 0, password: String(c.password || 'team123') }),
  orders: c => { const t = findTeam(c.teamName || c.teamId); return { ...c, phone: String(c.phone), litres: +c.litres || 0, amount: +c.amount || 0, teamId: t ? t.id : 'DIRECT' }; },
  expenses: c => ({ ...c, amount: +c.amount || 0 })
};

function flat(kind, o) {
  const r = {};
  for (const k in o) if (k !== 'pending') r[k] = Array.isArray(o[k]) ? o[k].join('|') : o[k];
  if (kind === 'orders') r.teamName = teamName(o.teamId);
  return r;
}

function post(body) {
  if (!S.url) return Promise.resolve();
  // text/plain => no CORS preflight (Apps Script requirement)
  return fetch(S.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).catch(e => console.error(e));
}
const push = (kind, o) => post({ action: 'upsert', kind, id: o.id, data: flat(kind, o) });
const pushDel = (kind, id) => { S.gone.push(id); save(); return post({ action: 'delete', kind, id }); };

function merge(kind, cloud) {
  const cm = new Map(), loc = S[kind];
  cloud.filter(c => c && c.id && !isSys(String(c.id))).forEach(c => {
    c.id = String(c.id); cm.set(c.id, c);
    if (S.gone.includes(c.id)) { post({ action: 'delete', kind, id: c.id }); return; }
    c.updated = +c.updated || 0;
    const l = loc.find(x => x.id === c.id);
    if (!l) { loc.push(NORM[kind](c)); return; }
    if (l.pending && (l.updated || 0) > c.updated) { push(kind, l); return; }
    Object.assign(l, NORM[kind](c)); delete l.pending;
  });
  S[kind] = loc.filter(l => (cm.has(l.id) && !S.gone.includes(l.id)) || l.pending);
  S[kind].forEach(l => { if (l.pending && !cm.has(l.id)) push(kind, l); });
}

async function sync(silent) {
  if (!S.url) return setBadge(false);
  let d;
  try { d = await (await fetch(S.url)).json(); }
  catch (e) { setBadge(false); if (!silent) toast('❌ Sync failed - Script URL / Access: Anyone check cheyyuka'); return; }
  if (Array.isArray(d)) d = { orders: d };
  if (!d || typeof d !== 'object') return setBadge(false);
  KINDS.forEach(k => Array.isArray(d[k]) && merge(k, d[k]));
  save(); setBadge(true); refresh();
  if (!silent) toast(`✅ Synced (${S.orders.length} orders, ${S.teams.length} teams)`);
}
