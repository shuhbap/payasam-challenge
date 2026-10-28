// UI: views, handlers
const $ = s => document.querySelector(s);
let V = 'home', me = null, adm = localStorage.getItem('pz_adm') === '1', tab = 'team', F = { q: '', st: 'ALL', tm: 'ALL' }, ok = false;
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600); };
const go = v => { V = v; render(); scrollTo(0, 0); };
const fd = e => { e.preventDefault(); return Object.fromEntries(new FormData(e.target)); };
const stat = (l, v, c = '') => `<div><small>${l}</small><b class="${c}">${v}</b></div>`;
const tbl = (h, r) => `<div class=tw><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${r.length ? r.join('') : `<tr><td colspan=${h.length} class=mu>No data</td></tr>`}</tbody></table></div>`;
const pill = o => `<span class="pill ${o.payStatus === 'PAID' ? 'ok' : 'bad'}">${o.payStatus}</span>`;
const opt = (a, sel) => a.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
const teamOpts = (sel, direct) => opt(S.teams.map(t => [t.id, t.name]).concat(direct ? [['DIRECT', 'Fest General (No Team)']] : []), sel);
const wa = o => {
  const m = S.wa.replace(/\{(\w+)\}/g, (_, k) => ({ name: o.name, id: o.id, litres: o.litres, amount: o.amount, status: o.payStatus, area: o.area, upi: S.upi })[k] ?? '');
  return `https://wa.me/91${String(o.phone).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(m)}`;
};

// ---------- theme / badge ----------
function theme(t) {
  t = t || localStorage.getItem('pz_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.t = t; localStorage.setItem('pz_theme', t);
}
const toggleTheme = () => theme(document.documentElement.dataset.t === 'dark' ? 'light' : 'dark');
function setBadge(v) { ok = v; const b = $('#badge'); if (b) b.textContent = v ? '🟢 Cloud connected' : (S.url ? '🔴 Cloud error' : '⚪ Local'); }
async function manualSync() { toast('🔄 Syncing...'); await sync(false); }

// ---------- derived data ----------
const teamOrders = t => S.orders.filter(o => o.teamId === t.id);
function fin() {
  const o = S.orders, paid = o.filter(x => x.payStatus === 'PAID');
  const upi = sum(paid.filter(x => x.payMode === 'upi'), 'amount');
  const directCash = sum(paid.filter(x => x.payMode !== 'upi' && x.teamId === 'DIRECT'), 'amount');
  const cashTeams = S.teams.reduce((s, t) => s + sum(teamOrders(t).filter(x => x.payStatus === 'PAID' && x.payMode !== 'upi'), 'amount'), 0);
  const handed = sum(S.teams, 'settledCash'), cashIn = handed + directCash;
  const exp = sum(S.expenses, 'amount'), cashExp = sum(S.expenses.filter(e => e.paymentMode !== 'upi'), 'amount'), upiExp = exp - cashExp;
  const gross = sum(o, 'amount'), litres = sum(o, 'litres');
  return { gross, litres, upi, cashIn, exp, due: gross - sum(paid, 'amount'), unsettled: Math.max(0, cashTeams - handed),
    cash: cashIn - cashExp, bank: upi - upiExp, real: upi + cashIn - exp, proj: gross - exp };
}

// ---------- order create ----------
function addOrder(x) {
  if (String(x.phone).replace(/\D/g, '').length < 10) { toast('⚠️ 10 അക്ക ഫോൺ നമ്പർ നൽകുക'); return null; }
  const litres = parseFloat(x.litres) || 1;
  const o = { id: uid('ORD'), name: x.name.trim(), phone: x.phone.trim(), area: x.area.trim(), teamId: x.teamId, member: x.member || 'Volunteer', item: ITEM,
    litres, amount: Math.round(litres * PRICE), payMode: x.payMode, payStatus: x.payMode === 'upi' || x.payMode === 'cash' ? 'PAID' : 'UNPAID',
    utr: x.utr || '', time: new Date().toLocaleString('en-GB') };
  S.orders.unshift(o); put('orders', o); return o;
}
const qr = a => {
  const u = `upi://pay?pa=${encodeURIComponent(S.upi)}&pn=${encodeURIComponent(S.payee)}&am=${a}&cu=INR&tn=Payasam`;
  return `<img width=130 height=130 style="background:#fff;padding:5px;border-radius:8px" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(u)}"><div><b>${esc(S.upi)}</b><br><a href="${u}">Open UPI app</a></div>`;
};
function payChange(f) {
  const m = f.querySelector('[name=payMode]:checked').value, b = f.querySelector('.upi'), l = parseFloat(f.litres.value) || 0;
  b.style.display = m === 'upi' ? 'flex' : 'none'; if (m === 'upi') b.firstElementChild.outerHTML = `<div class=row style="flex:none">${qr(Math.round(l * PRICE))}</div>`;
  f.querySelector('.tot').textContent = rs(l * PRICE);
}
const payForm = (modes, cb) => `<label>Litres (₹250/L)</label><div class=row>${[0.5, 1, 2, 3, 5].map(n => `<button type=button class="b o" onclick="this.form.litres.value=${n};payChange(this.form)">${n}L</button>`).join('')}</div>
<input name=litres type=number step=0.5 min=0.5 value=1 oninput="payChange(this.form)"><h3>Total: <span class=tot>₹250</span></h3>
<div class=row>${modes.map(([v, l], i) => `<label><input type=radio name=payMode value=${v} ${i ? '' : 'checked'} onchange="payChange(this.form)" style="width:auto"> ${l}</label>`).join('')}</div>
<div class="upi row" style="display:none"><span></span><input name=utr placeholder="UTR / Ref (optional)"></div>`;

// ---------- views ----------
const views = {
  home() {
    const p = S.orders.filter(o => o.payStatus === 'PAID').length, f = fin();
    return `<div class=card><h2>🍮 Payasam Challenge 2026</h2><small>${ITEM} • ₹250 / L</small></div>
<div class=grid>${[['team', '👥 Team Login', S.teams.length + ' teams'], ['direct', '🛍️ Individual Order', '₹250/L'], ['rank', '🏆 Rankings', 'Live'], ['orders', '📋 All Orders', `${p} paid | ${S.orders.length - p} unpaid`], ['admin', '🔐 Admin Desk', rs(f.proj) + ' profit']]
      .map(t => `<button class=tile onclick="go('${t[0]}')"><b>${t[1]}</b><small>${t[2]}</small></button>`).join('')}</div>
<div class="card stats">${stat('Litres', f.litres.toFixed(1) + ' L', 'am')}${stat('Sales', rs(f.gross))}${stat('Paid', rs(f.gross - f.due), 'ok')}${stat('Due', rs(f.due), 'bad')}</div>`;
  },
  team() {
    if (!me) return `<div class=card><h3>Team Login</h3><form onsubmit="login(event)">
<label>Team</label><select name=team onchange="memberList(this.form)">${S.teams.length ? teamOpts() : '<option value="">No teams yet — register below</option>'}</select>
<label>Your name</label><input name=member required list=ml placeholder="eg. Rahul"><datalist id=ml>${S.teams[0] ? S.teams[0].members.map(m => `<option value="${esc(m)}">`).join('') : ''}</datalist>
<label>Password</label><input name=pw type=password value=team123><button class=b>Login ➔</button></form>
<details><summary>➕ Register new team</summary><form onsubmit="newTeam(event)"><input name=name required placeholder="Team name"><input name=pw value=team123 placeholder=Password>
<input name=members required placeholder="Members (comma separated, max 5)"><button class=b>Save & Login</button></form></details></div>`;
    return `<div class="card row"><div><b>${esc(me.team.name)}</b> • ${esc(me.member)}</div><button class="b o" onclick="chPwd()">🔑 Password</button><button class="b g" onclick="teamCsv()">📊</button><button class=b onclick="print()">🖨️</button><button class="b o" onclick="teamCard()">🖼️</button><button class="b r" onclick="logout()">Logout</button></div>
<div class=card><h3>New order</h3><form id=of onsubmit="teamOrder(event)"><input name=name required placeholder="Customer name"><input name=phone type=tel required placeholder="WhatsApp number (10 digits)">
<input name=area required placeholder="Area / Dept / Room">${payForm([['cash', '💵 Cash'], ['upi', '📱 UPI'], ['unpaid', '⏳ Pay on delivery']])}<button class=b>Save & next ➔</button></form></div>
<div class=card><h3>My team orders</h3><div id=mine>${mine()}</div></div>`;
  },
  direct() {
    return `<div class=card><h3>Individual order</h3><form onsubmit="directOrder(event)">
<div class=row><label><input type=radio name=mode value=agent checked style="width:auto" onchange="document.getElementById('ag').style.display=''"> Volunteer booking</label><label><input type=radio name=mode value=cust style="width:auto" onchange="document.getElementById('ag').style.display='none'"> Customer self</label></div>
<div id=ag><input name=agent placeholder="Agent name (rank credit)"><select name=team>${teamOpts('', 1)}</select></div>
<input name=name required placeholder="Customer name"><input name=phone type=tel required placeholder="WhatsApp number"><input name=area required placeholder="Area / Room">
${payForm([['unpaid', '⏳ Pay on delivery'], ['upi', '📱 UPI']])}<button class=b>Save & next ➔</button></form></div>`;
  },
  rank() {
    const ts = S.teams.map(t => { const o = teamOrders(t); return { n: t.name, c: o.length, l: sum(o, 'litres'), r: sum(o, 'amount') }; }).sort((a, b) => b.l - a.l || b.r - a.r);
    const m = {};
    S.orders.forEach(o => { const k = (o.member || 'Direct') + '|' + o.teamId; (m[k] = m[k] || { n: o.member || 'Direct', t: teamName(o.teamId), c: 0, l: 0, r: 0 }); m[k].c++; m[k].l += o.litres; m[k].r += o.amount; });
    const ms = Object.values(m).sort((a, b) => b.l - a.l || b.r - a.r), md = ['🥇', '🥈', '🥉'];
    return `<div class="card row no-print"><button class="b g" onclick="rankCsv()">📊 Excel</button><button class=b onclick="print()">🖨️ PDF</button><button class="b o" onclick="rankCard()">🖼️ WhatsApp card</button></div><div class=card><h3>🏆 Team standings</h3>${tbl(['#', 'Team', 'Orders', 'Litres', 'Revenue'], ts.map((t, i) => `<tr><td>${md[i] || i + 1}</td><td><b>${esc(t.n)}</b></td><td>${t.c}</td><td class=am><b>${t.l.toFixed(1)} L</b></td><td>${rs(t.r)}</td></tr>`))}</div>
<div class=card><h3>🌟 Individual standings</h3>${tbl(['#', 'Member', 'Team', 'Orders', 'Litres', 'Value'], ms.map((t, i) => `<tr><td>${md[i] || i + 1}</td><td><b>${esc(t.n)}</b></td><td>${esc(t.t)}</td><td>${t.c}</td><td class=am><b>${t.l.toFixed(1)} L</b></td><td>${rs(t.r)}</td></tr>`))}</div>`;
  },
  orders() {
    return `<div class=card><div class=row><h3 style="flex:1;margin:0">All orders</h3><button class="b g" onclick="csv()">📊 CSV</button><button class=b onclick="print()">🖨️ PDF</button></div>${filters()}<div id=ot>${orderTable(false)}</div></div>${studio()}`;
  },
  admin() {
    if (!adm) return `<div class=card><h3>Admin PIN</h3><form onsubmit="unlock(event)"><input name=pin type=password required placeholder="PIN"><button class=b>Unlock</button></form></div>`;
    return `<div class="row no-print"><button class="b r" onclick="adm=false;localStorage.removeItem('pz_adm');render()">🔒 Lock</button><button class="b g" onclick="finCsv()">📊 Financial Excel</button><button class=b onclick="print()">🖨️ Financial PDF</button><button class="b o" onclick="finCard()">🖼️ Summary card</button></div><div id=kpi>${kpi()}</div>
<div class=card><h3>Orders manager</h3>${filters()}<div id=ot>${orderTable(true)}</div></div>
${studio()}<div class=card><h3>☁️ Cloud URL</h3><form onsubmit="setCfg(event)"><input name=url value="${esc(S.url)}" placeholder="Apps Script Web App URL"><button class=b>Save & sync</button></form></div>
<div class=card><h3>📱 UPI & 💬 WhatsApp</h3><form onsubmit="setCfg(event)"><input name=upi value="${esc(S.upi)}"><input name=payee value="${esc(S.payee)}"><textarea name=wa rows=4>${esc(S.wa)}</textarea>
<small>{name} {id} {litres} {amount} {status} {area} {upi}</small><br><button class=b>Save</button></form></div>
<div class=card><h3>🔐 Change PIN</h3><form onsubmit="setPin(event)"><input name=cur type=password placeholder="Current PIN" required><input name=nw type=password placeholder="New PIN (min 4)" required><button class=b>Save PIN</button></form></div>
<div class=card><button class="b r" onclick="resetAll()">🗑️ Clear all data</button></div>`;
  }
};

function mine() {
  if (!me) return '';
  const o = teamOrders(me.team);
  return `<p><b>${o.length} orders • ${sum(o, 'litres').toFixed(1)} L</b></p>` + tbl(['ID', 'Customer', 'By', 'L', '₹', 'Status', 'WA'], o.map(x => `<tr><td>${x.id}</td><td>${esc(x.name)}<br><small>${esc(x.phone)}</small></td><td>${esc(x.member)}</td><td>${x.litres}</td><td>${x.amount}</td><td>${pill(x)}</td><td><a href="${wa(x)}" target=_blank>💬</a></td></tr>`));
}
function filters() {
  return `<div class=row><input placeholder="Search name / phone / area" value="${esc(F.q)}" oninput="setF('q',this.value)"><select onchange="setF('st',this.value)">${opt([['ALL', 'All'], ['PAID', 'Paid'], ['UNPAID', 'Unpaid']], F.st)}</select>
<select onchange="setF('tm',this.value)">${opt([['ALL', 'All teams']].concat(S.teams.map(t => [t.id, t.name])).concat([['DIRECT', 'Direct']]), F.tm)}</select></div>`;
}
const setF = (k, v) => { F[k] = v; $('#ot').innerHTML = orderTable(V === 'admin'); };
const filtered = () => S.orders.filter(o => (F.st === 'ALL' || o.payStatus === F.st) && (F.tm === 'ALL' || o.teamId === F.tm) &&
  (!F.q || (o.name + o.phone + o.area + o.id + o.member).toLowerCase().includes(F.q.toLowerCase())));
function orderTable(a) {
  const l = filtered();
  return tbl(['ID', 'Customer', 'Area', 'Team', 'L', '₹', 'Status', a ? 'Actions' : 'WA'], l.map(o => `<tr><td>${o.id}<br><small>${esc(o.time)}</small></td><td>${esc(o.name)}<br><a href="${wa(o)}" target=_blank>💬 ${esc(o.phone)}</a></td><td>${esc(o.area)}</td>
<td>${esc(teamName(o.teamId))}<br><small>${esc(o.member)}</small></td><td>${o.litres}</td><td>${o.amount}</td><td>${pill(o)}</td>
<td>${a ? `<button class=b onclick="editOrder('${o.id}')">✏️</button> <button class="b o" onclick="togglePaid('${o.id}')">${o.payStatus === 'PAID' ? 'Unpay' : 'Pay ✓'}</button> <button class="b r" onclick="delOrder('${o.id}')">🗑️</button>` : `<a href="${wa(o)}" target=_blank>WhatsApp</a>`}</td></tr>`))
    + `<p><small>${l.length} orders • ${sum(l, 'litres').toFixed(1)} L • ${rs(sum(l, 'amount'))}</small></p>`;
}
function kpi() {
  const f = fin();
  return `<div class="card stats">${stat('Gross', rs(f.gross))}${stat('Received', rs(f.upi + f.cashIn), 'ok')}${stat('UPI in bank', rs(f.upi))}${stat('Cust. dues', rs(f.due), 'am')}${stat('Expenses', rs(f.exp), 'bad')}${stat('Net profit', rs(f.real), 'ok')}</div>
<div class="card stats">${stat('Cash in hand', rs(f.cash))}${stat('Bank balance', rs(f.bank))}${stat('Teams yet to hand', rs(f.unsettled), 'bad')}${stat('Cost / L', f.litres ? rs(f.exp / f.litres) : '₹0')}${stat('Profit / L', f.litres ? rs(f.proj / f.litres) : '₹0')}${stat('Margin', f.gross ? (f.proj / f.gross * 100).toFixed(1) + '%' : '0%')}</div>
<div class=card><h3>🤝 Team cash & passwords</h3>${tbl(['Team', 'Collected', 'Handed', 'Due', ''], S.teams.map(t => {
    const c = sum(teamOrders(t).filter(x => x.payStatus === 'PAID' && x.payMode !== 'upi'), 'amount'), d = Math.max(0, c - t.settledCash);
    return `<tr><td>${esc(t.name)}</td><td>${rs(c)}</td><td>${rs(t.settledCash)}</td><td class=bad>${rs(d)}</td><td>${d ? `<button class="b g" onclick="receive('${t.id}',${d})">Receive</button> ` : ''}<button class="b o" onclick="resetPwd('${t.id}')">🔑</button></td></tr>`; }))}</div>
<div class=card><h3>🧾 Expenses</h3><form class=row onsubmit="addExp(event)"><input name=item required placeholder="Item"><input name=category placeholder="Category (milk, jaggery...)"><input name=amount type=number min=1 required placeholder="₹">
<select name=mode><option value=cash>Cash</option><option value=upi>UPI</option></select><input name=vendor placeholder="Paid to"><button class=b>Add</button></form>
${tbl(['Item', 'Paid to', 'Mode', '₹', ''], S.expenses.map(e => `<tr><td>${esc(e.item)}<br><small>${esc(e.category)}</small></td><td>${esc(e.vendor)}</td><td>${e.paymentMode === 'upi' ? 'UPI' : 'Cash'}</td><td class=bad>${e.amount}</td><td><button class="b r" onclick="delExp('${e.id}')">🗑️</button></td></tr>`))}</div>`;
}

// ---------- handlers ----------
function render() {
  $('#app').innerHTML = views[V]();
  if (typeof subOpts === 'function') subOpts();
  const f = $('#app form[id=of]'); if (f) setTimeout(() => f.name.focus(), 100);
}
function refresh() {
  if (me) me.team = findTeam(me.team.id) || me.team;
  if (V === 'home' || V === 'rank') return render();
  if ($('#ot')) $('#ot').innerHTML = orderTable(V === 'admin');
  if ($('#mine')) $('#mine').innerHTML = mine();
  if ($('#kpi')) $('#kpi').innerHTML = kpi();
}
const saveMe = () => localStorage.setItem('pz_me', JSON.stringify({ t: me.team.id, m: me.member }));
const logout = () => { me = null; localStorage.removeItem('pz_me'); render(); };
function memberList(f) { const t = findTeam(f.team.value); $('#ml').innerHTML = t ? t.members.map(m => `<option value="${esc(m)}">`).join('') : ''; }
function login(e) {
  const x = fd(e), t = findTeam(x.team);
  if (!t) return toast('⚠️ Team select cheyyuka / register cheyyuka');
  if (x.pw !== t.password && x.pw !== S.pin) return toast('❌ Wrong password');
  if (!t.members.includes(x.member.trim())) { t.members.push(x.member.trim()); put('teams', t); }
  me = { team: t, member: x.member.trim() }; saveMe(); render(); toast(`🎉 Welcome ${x.member}`);
}
function newTeam(e) {
  const x = fd(e), name = x.name.trim();
  if (findTeam(name)) return toast('⚠️ ആ പേരിൽ ടീം ഉണ്ട് - login ചെയ്യുക');
  const t = { id: slug(name), name, password: x.pw.trim() || 'team123', settledCash: 0, members: x.members.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5) };
  S.teams.push(t); put('teams', t); me = { team: t, member: t.members[0] || 'Captain' }; saveMe(); render(); toast('✅ Team registered');
}
function chPwd() {
  const c = prompt('Current password'); if (c === null) return;
  if (c !== me.team.password) return toast('❌ Wrong current password');
  const n = (prompt('New password') || '').trim(); if (!n) return;
  me.team.password = n; put('teams', me.team); toast('✅ Password changed');
}
function teamOrder(e) {
  const x = fd(e), o = addOrder({ ...x, teamId: me.team.id, member: me.member }); if (!o) return;
  e.target.reset(); payChange(e.target); refresh(); toast(`🎉 #${o.id} saved`);
  window.open(wa(o), '_blank');
}
function directOrder(e) {
  const x = fd(e), a = x.mode === 'agent';
  const o = addOrder({ ...x, teamId: a ? x.team : 'DIRECT', member: a ? (x.agent || 'Volunteer') : 'Direct Customer' }); if (!o) return;
  e.target.reset(); payChange(e.target); toast(`🎉 #${o.id} saved${a ? ' — team rank updated' : ''}`);
}
function unlock(e) { if (fd(e).pin !== S.pin) return toast('❌ Wrong PIN'); adm = true; localStorage.setItem('pz_adm', '1'); render(); }
function setCfg(e) {
  const x = fd(e); ['url', 'upi', 'payee', 'wa'].forEach(k => x[k] !== undefined && (S[k] = x[k].trim())); save(); toast('✅ Saved');
  if (x.url !== undefined) sync(false);
}
function setPin(e) {
  const x = fd(e); if (x.cur !== S.pin) return toast('❌ Wrong current PIN'); if (x.nw.length < 4) return toast('⚠️ Min 4 chars');
  S.pin = x.nw; save(); e.target.reset(); toast('✅ PIN changed');
}
const togglePaid = id => { const o = S.orders.find(x => x.id === id); o.payStatus = o.payStatus === 'PAID' ? 'UNPAID' : 'PAID'; put('orders', o); refresh(); };
function delOrder(id) {
  if (!confirm('Delete ' + id + '?')) return;
  S.orders = S.orders.filter(o => o.id !== id); pushDel('orders', id); refresh();
}
function editOrder(id) {
  const o = S.orders.find(x => x.id === id);
  $('#ed').innerHTML = `<form method=dialog onsubmit="saveEdit(event,'${id}')"><h3>Edit ${id}</h3><input name=name value="${esc(o.name)}" required><input name=phone value="${esc(o.phone)}" required><input name=area value="${esc(o.area)}" required>
<input name=litres type=number step=0.1 value="${o.litres}" oninput="this.form.amount.value=Math.round(this.value*${PRICE})"><input name=amount type=number value="${o.amount}">
<select name=payMode>${opt([['cash', 'Cash'], ['upi', 'UPI'], ['unpaid', 'Pay on delivery']], o.payMode)}</select><select name=payStatus>${opt([['PAID', 'PAID'], ['UNPAID', 'UNPAID']], o.payStatus)}</select>
<select name=teamId>${teamOpts(o.teamId, 1)}</select><input name=member value="${esc(o.member)}" placeholder=Member><input name=utr value="${esc(o.utr)}" placeholder=UTR>
<div class=row><button class="b o" type=button onclick="$('#ed').close()">Cancel</button><button class=b>Save</button></div></form>`;
  $('#ed').showModal();
}
function saveEdit(e, id) {
  const x = fd(e), o = S.orders.find(y => y.id === id);
  Object.assign(o, x, { litres: parseFloat(x.litres) || 1, amount: parseFloat(x.amount) || 0 }); put('orders', o); $('#ed').close(); refresh(); toast('✅ Updated');
}
function receive(id, d) { const t = findTeam(id); if (confirm(`Receive ₹${d} from ${t.name}?`)) { t.settledCash += d; put('teams', t); refresh(); } }
function resetPwd(id) { const t = findTeam(id), n = prompt(`New password for ${t.name}`, t.password); if (n && n.trim()) { t.password = n.trim(); put('teams', t); toast('✅ Done'); } }
function addExp(e) {
  const x = fd(e), ex = { id: uid('EXP'), item: x.item.trim(), category: x.category.trim(), amount: +x.amount, paymentMode: x.mode, vendor: x.vendor.trim(), time: new Date().toLocaleString('en-GB') };
  S.expenses.unshift(ex); put('expenses', ex); e.target.reset(); refresh();
}
function delExp(id) { if (confirm('Delete expense?')) { S.expenses = S.expenses.filter(e => e.id !== id); pushDel('expenses', id); refresh(); } }
async function resetAll() {
  if (!confirm('എല്ലാ ഓർഡറുകളും ചിലവുകളും ഡിലീറ്റ് ആകും. തുടരണോ?')) return;
  S.orders.forEach(o => S.gone.push(o.id)); S.expenses.forEach(o => S.gone.push(o.id));
  S.orders = []; S.expenses = []; S.teams.forEach(t => { t.settledCash = 0; t.pending = 1; t.updated = Date.now(); });
  save(); await post({ action: 'clear_all' }); S.teams.forEach(t => push('teams', t)); refresh(); toast('✅ Cleared');
}
function csv() {
  const h = ['ID', 'Name', 'Phone', 'Area', 'Team', 'Member', 'Litres', 'Amount', 'Mode', 'Status', 'UTR', 'Time'];
  const r = filtered().map(o => [o.id, o.name, o.phone, o.area, teamName(o.teamId), o.member, o.litres, o.amount, o.payMode, o.payStatus, o.utr, o.time]);
  const s = '\uFEFF' + [h, ...r].map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' }));
  a.download = `Payasam_Orders_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

// ---------- boot ----------
addEventListener('DOMContentLoaded', () => {
  theme(); setBadge(false);
  try { const s = JSON.parse(localStorage.getItem('pz_me')); const t = s && findTeam(s.t); if (t) me = { team: t, member: s.m }; } catch (e) {}
  render();
  sync(true); setInterval(() => !document.hidden && sync(true), 6000);
});
