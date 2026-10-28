// State, storage, helpers
const PRICE = 250, ITEM = 'അട പ്രഥമൻ (Ada Pradhaman)', K = 'payasam_v4';
// Apps Script Web App URL (deploy cheytha ശേഷം ivide ottikkuka, allenkil Admin > Cloud URL)
const DEF_URL = 'https://script.google.com/macros/s/AKfycbyKT4_zsGfkvgR8hIH11hIu2OLu1ysiRTdi8zHx9V37Bnk0z_-3Y3a5909_NYv0qzs/exec';

const S = Object.assign({
  teams: [], orders: [], expenses: [], gone: [],
  pin: 'admin123', upi: 'festpayasam@upi', payee: 'Fest Payasam Committee', url: DEF_URL,
  wa: 'ഹലോ {name}, നിങ്ങളുടെ അട പ്രഥമൻ ഓർഡർ (#{id}):\nഅളവ്: {litres} L\nതുക: ₹{amount} [{status}]\nസ്ഥലം: {area}\nപായസം ഫെസ്റ്റിലേക്ക് സ്വാഗതം! ❤️'
}, JSON.parse(localStorage.getItem(K) || '{}'));

const save = () => localStorage.setItem(K, JSON.stringify(S));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
const slug = n => 't_' + n.trim().toLowerCase().replace(/\s+/g, '_');
const findTeam = v => S.teams.find(t => t.id === v || t.name.toLowerCase() === String(v || '').trim().toLowerCase());
const teamName = id => (findTeam(id) || {}).name || 'Direct';
const sum = (a, f) => a.reduce((s, x) => s + (+x[f] || 0), 0);
const rs = n => '₹' + Math.round(n * 100) / 100;
const isSys = id => /^(TEAM|SYS)-/.test(id);

// Create/edit -> mark pending, push to cloud (cloud.js)
function put(kind, obj) {
  obj.pending = 1; obj.updated = Date.now(); save(); push(kind, obj);
}

// One-time migration from old v3 data
(function () {
  const p = new URLSearchParams(location.search).get('sheet');
  if (p) { S.url = p; save(); }
  if (localStorage.getItem(K)) return;
  const g = k => { try { return JSON.parse(localStorage.getItem('payasam_v3_' + k)) || []; } catch { return []; } };
  S.teams = g('teams').filter(t => t && t.id && !/^t[1-5]$/.test(t.id));
  S.orders = g('orders').filter(o => o && o.id && !isSys(o.id) && !/^ORD-(TEST|10\d)/.test(o.id));
  S.expenses = g('expenses'); S.gone = g('deleted_orders');
  ['upi_id:upi', 'upi_name:payee', 'wa_template:wa', 'admin_pin:pin'].forEach(x => {
    const [a, b] = x.split(':'), v = localStorage.getItem('payasam_v3_' + a); if (v) S[b] = v;
  });
  const now = Date.now();
  S.orders.forEach(o => { const t = findTeam(o.teamId); o.teamId = t ? t.id : 'DIRECT'; o.pending = 1; o.updated = now; });
  S.teams.concat(S.expenses).forEach(x => { x.pending = 1; x.updated = now; });
  save();
})();
