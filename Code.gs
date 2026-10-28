// Google Apps Script — paste in Extensions > Apps Script of your Google Sheet.
// Deploy > New deployment > Web app > Execute as: Me, Access: Anyone. (Code maattiyal "New version" deploy cheyyanam)
const H = {
  orders: ['id','name','phone','area','teamId','teamName','member','item','litres','amount','payMode','payStatus','utr','time','updated'],
  teams: ['id','name','password','settledCash','members','updated'],
  expenses: ['id','category','item','amount','paymentMode','vendor','notes','time','updated']
};
const out = o => ContentService.createTextOutput(typeof o === 'string' ? o : JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function sh(k) {
  const ss = SpreadsheetApp.getActive(); let s = ss.getSheetByName('PZ_' + k);
  if (!s) { s = ss.insertSheet('PZ_' + k); s.appendRow(H[k]); }
  return s;
}

function doGet() {
  const res = {};
  for (const k in H) {
    const v = sh(k).getDataRange().getValues(), h = v.shift();
    res[k] = v.filter(r => r[0] !== '').map(r => { const o = {}; h.forEach((c, i) => o[c] = r[i]); return o; });
  }
  return out(res);
}

function doPost(e) {
  const L = LockService.getScriptLock(); L.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.action === 'clear_all') {
      for (const k in H) { const s = sh(k); if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1); }
      return out('ok');
    }
    const s = sh(b.kind), n = H[b.kind].length;
    const ids = s.getRange(1, 1, s.getLastRow(), 1).getValues().flat().map(String), i = ids.indexOf(String(b.id));
    if (b.action === 'delete') { if (i > 0) s.deleteRow(i + 1); }
    else {
      const row = H[b.kind].map(c => b.data[c] === undefined ? '' : b.data[c]);
      const r = i > 0 ? s.getRange(i + 1, 1, 1, n) : s.getRange(s.getLastRow() + 1, 1, 1, n);
      r.setNumberFormat('@').setValues([row]);   // text format: phone/time not auto-converted
    }
    return out('ok');
  } finally { L.releaseLock(); }
}
