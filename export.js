// Exports: Excel(CSV), PDF (print), WhatsApp card (PNG / SVG / share)
let cur = null;
const day = () => new Date().toISOString().slice(0, 10);
const dl = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const csvDown = (name, rows) => dl(new Blob(['\uFEFF' + rows.map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${name}_${day()}.csv`);
const orderRow = o => [o.id, o.name, o.phone, o.area, teamName(o.teamId), o.member, o.litres, o.amount, o.payMode, o.payStatus, o.utr, o.time];
const OH = ['ID', 'Name', 'Phone', 'Area', 'Team', 'Member', 'Litres', 'Amount', 'Mode', 'Status', 'UTR', 'Time'];

// ---------- Export studio (dynamic: teams / areas come from live data) ----------
function studio() {
  return `<div class="card no-print"><h3>📄 Export studio</h3><div class=row>
<select id=sm onchange="subOpts()">${opt([['TEAM', 'Team-wise (page per team)'], ['AREA', 'Area-wise (page per area)'], ['PAID', 'Paid only'], ['UNPAID', 'Unpaid / cash collection'], ['MASTER', 'Master (all)']], 'TEAM')}</select><select id=ss></select></div>
<div class=row><button class="b g" onclick="studioCsv()">📊 Excel</button><button class=b onclick="studioPdf()">🖨️ PDF</button><button class="b o" onclick="studioImg()">🖼️ Image card</button></div></div>`;
}
function subOpts() {
  const m = $('#sm'), s = $('#ss'); if (!m) return;
  s.style.display = m.value === 'TEAM' || m.value === 'AREA' ? '' : 'none';
  const items = m.value === 'TEAM' ? S.teams.map(t => [t.id, t.name]).concat([['DIRECT', 'Direct']]) : [...new Set(S.orders.map(o => o.area))].map(a => [a, a]);
  s.innerHTML = opt([['ALL', 'All (one page each)']].concat(items));
}
function pick() {
  const m = $('#sm').value, sub = $('#ss').value, L = S.orders;
  if (m === 'TEAM') return (sub === 'ALL' ? S.teams.map(t => t.id).concat(['DIRECT']) : [sub]).map(id => ['Team: ' + teamName(id), L.filter(o => o.teamId === id)]).filter(g => sub !== 'ALL' || g[1].length);
  if (m === 'AREA') return (sub === 'ALL' ? [...new Set(L.map(o => o.area))] : [sub]).map(a => ['Area: ' + a, L.filter(o => o.area === a)]);
  if (m === 'PAID') return [['Paid orders', L.filter(o => o.payStatus === 'PAID')]];
  if (m === 'UNPAID') return [['Unpaid - collect on delivery', L.filter(o => o.payStatus !== 'PAID')]];
  return [['Master report', L]];
}
const studioCsv = () => csvDown('Payasam_Export', [OH].concat(pick().flatMap(g => g[1].map(orderRow))));
function studioPdf() {
  const g = pick(); if (!g.some(x => x[1].length)) return toast('⚠️ Orders illa');
  printPdf(g.map(x => secHtml(x[0], x[1])).join(''));
}
function studioImg() {
  const g = pick(), all = g.flatMap(x => x[1]);
  showCard(card('പായസം ഫെസ്റ്റ് 2026 - Orders', g.length === 1 ? g[0][0] : 'Summary', [['Orders', all.length], ['Litres', sum(all, 'litres').toFixed(1) + ' L', '#b45309'], ['Amount', rs(sum(all, 'amount')), '#059669'],
    ['Paid', all.filter(o => o.payStatus === 'PAID').length, '#059669'], ['Unpaid', all.filter(o => o.payStatus !== 'PAID').length, '#dc2626'], ['Teams', S.teams.length]],
    g.length > 1 ? g.slice(0, 12).map(x => `${x[0]}: ${x[1].length} orders, ${sum(x[1], 'litres').toFixed(1)} L`) : []), 'Payasam_Orders');
}
const secHtml = (t, l) => `<section style="page-break-after:always;font:12px sans-serif;color:#000;margin-bottom:24px"><h2 style="margin:0">Payasam Challenge 2026 - ${esc(t)}</h2><p>${l.length} orders • ${sum(l, 'litres').toFixed(1)} L • ${rs(sum(l, 'amount'))}</p>
<table border=1 cellpadding=4 style="border-collapse:collapse;width:100%"><tr><th>#</th><th>Customer</th><th>Area</th><th>Team</th><th>L</th><th>₹</th><th>Status</th><th>Delivered</th></tr>${l.map((o, i) => `<tr><td>${i + 1}</td><td>${esc(o.name)}<br>${esc(o.phone)}</td><td>${esc(o.area)}</td><td>${esc(teamName(o.teamId))}</td><td>${o.litres}</td><td>${o.amount}</td><td>${o.payStatus}</td><td>[ ]</td></tr>`).join('')}</table></section>`;
function printPdf(html) {
  const p = $('#pa'); p.innerHTML = html; document.body.classList.add('printing');
  setTimeout(() => { print(); document.body.classList.remove('printing'); p.innerHTML = ''; }, 200);
}

// ---------- Financial / rankings / team ----------
function finCsv() {
  const f = fin();
  csvDown('Payasam_Financial', [['=== FINANCIAL LEDGER ===', day()], ['Gross sales', f.gross], ['Litres', f.litres], ['UPI in bank', f.upi], ['Admin cash received', f.cashIn], ['Customer dues', f.due], ['Expenses', f.exp], ['Realized net profit', f.real], ['Projected profit', f.proj],
    ['Cash in hand', f.cash], ['Bank balance', f.bank], ['Teams yet to hand over', f.unsettled], [], ['Team', 'Cash collected', 'Handed', 'Due'],
    ...S.teams.map(t => { const c = sum(teamOrders(t).filter(x => x.payStatus === 'PAID' && x.payMode !== 'upi'), 'amount'); return [t.name, c, t.settledCash, Math.max(0, c - t.settledCash)]; }),
    [], ['Category', 'Item', 'Vendor', 'Mode', 'Amount'], ...S.expenses.map(e => [e.category, e.item, e.vendor, e.paymentMode, e.amount])]);
}
function finCard() {
  const f = fin();
  showCard(card('💰 പായസം ഫെസ്റ്റ് - Financial', `${f.litres.toFixed(1)} L • ₹250/L`, [['Gross', rs(f.gross)], ['Received', rs(f.upi + f.cashIn), '#059669'], ['Expenses', rs(f.exp), '#dc2626'], ['Net profit', rs(f.real), '#15803d'], ['Customer dues', rs(f.due), '#b45309'], ['Teams to hand', rs(f.unsettled), '#dc2626']],
    [`Cash in hand: ${rs(f.cash)}`, `Bank balance: ${rs(f.bank)}`]), 'Payasam_Financial');
}
const ranked = () => S.teams.map(t => { const o = teamOrders(t); return { n: t.name, c: o.length, l: sum(o, 'litres'), r: sum(o, 'amount') }; }).sort((a, b) => b.l - a.l || b.r - a.r);
const rankCsv = () => csvDown('Payasam_Leaderboard', [['Rank', 'Team', 'Orders', 'Litres', 'Revenue']].concat(ranked().map((t, i) => [i + 1, t.n, t.c, t.l.toFixed(1), t.r])));
function rankCard() {
  const r = ranked(), md = ['🥇', '🥈', '🥉'];
  showCard(card('🏆 ടീം ലീഡർബോർഡ്', 'Payasam Challenge 2026', r.slice(0, 3).map((t, i) => [md[i] + ' ' + t.n, t.l.toFixed(1) + ' L', '#b45309']), r.slice(3, 12).map((t, i) => `${i + 4}. ${t.n} - ${t.l.toFixed(1)} L (${rs(t.r)})`)), 'Payasam_Leaderboard');
}
function teamCsv() { csvDown(me.team.name + '_Orders', [OH].concat(teamOrders(me.team).map(orderRow))); }
function teamCard() {
  const o = teamOrders(me.team), cash = sum(o.filter(x => x.payStatus === 'PAID' && x.payMode !== 'upi'), 'amount');
  showCard(card(me.team.name + ' 🏆', 'Team performance card', [['Orders', o.length], ['Litres', sum(o, 'litres').toFixed(1) + ' L', '#b45309'], ['Revenue', rs(sum(o, 'amount')), '#059669']],
    [`Cash collected: ${rs(cash)}`, `Handed to admin: ${rs(me.team.settledCash)}`, `Still to hand over: ${rs(Math.max(0, cash - me.team.settledCash))}`]), me.team.name + '_Card');
}

// ---------- SVG card + share ----------
function card(title, sub, stats, lines) {
  const r = Math.ceil(stats.length / 3), y0 = 110 + r * 85 + 8, H = y0 + lines.length * 24 + 50, x = esc;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${H}" viewBox="0 0 600 ${H}" font-family="system-ui,sans-serif"><rect width="600" height="${H}" fill="#fff"/><rect width="600" height="90" fill="#1e3a8a"/>
<text x="30" y="40" fill="#fff" font-size="19" font-weight="bold">${x(title)}</text><text x="30" y="66" fill="#bfdbfe" font-size="12">${x(sub)}</text><text x="570" y="66" fill="#fff" font-size="12" text-anchor="end">${new Date().toLocaleDateString('en-GB')}</text>
${stats.map((s, i) => `<g transform="translate(${30 + i % 3 * 180},${108 + (i / 3 | 0) * 85})"><rect width="170" height="72" rx="10" fill="#f1f5f9" stroke="#cbd5e1"/><text x="12" y="24" fill="#64748b" font-size="11">${x(s[0])}</text><text x="12" y="55" fill="${s[2] || '#1e3a8a'}" font-size="20" font-weight="bold">${x(s[1])}</text></g>`).join('')}
${lines.map((l, i) => `<text x="30" y="${y0 + 18 + i * 24}" fill="#334155" font-size="13">${x(l)}</text>`).join('')}
<text x="30" y="${H - 16}" fill="#94a3b8" font-size="10">Payasam Challenge 2026 • Fest Committee</text></svg>`;
}
function showCard(svg, name) {
  cur = { svg, name };
  $('#ed').innerHTML = `<div style="overflow:auto">${svg}</div><div class=row style="margin-top:10px"><button class="b g" onclick="cardPng()">📥 PNG</button><button class="b o" onclick="dl(new Blob([cur.svg],{type:'image/svg+xml'}),cur.name+'.svg')">📐 SVG</button><button class=b onclick="cardShare()">📲 WhatsApp</button><button class="b o" onclick="$('#ed').close()">Close</button></div>`;
  $('#ed').showModal();
}
const toPng = () => new Promise(res => {
  const i = new Image();
  i.onload = () => { const c = document.createElement('canvas'); c.width = i.width * 2; c.height = i.height * 2; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(i, 0, 0, c.width, c.height); c.toBlob(res, 'image/png'); };
  i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cur.svg);
});
async function cardPng() { dl(await toPng(), cur.name + '.png'); }
async function cardShare() {
  const b = await toPng(), f = new File([b], cur.name + '.png', { type: 'image/png' }), text = '🥥 പായസം ഫെസ്റ്റ് 2026';
  if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], text }).catch(() => {});
  dl(b, cur.name + '.png'); window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); toast('📲 PNG download aayi - WhatsApp-il attach cheyyuka');
}
