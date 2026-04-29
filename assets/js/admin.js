/******************************
 * CONFIG & AUTH
 ******************************/
const API_VERSION = "2026-04-29-FINAL-LOGGED-UX";
const SHEET_ADMINS  = "admins";
const SHEET_MEMBERS = "members";
const SHEET_VISITS  = "visits";
const SHEET_META    = "meta";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, adminId, token, payload, memberId } = body;
    if (action !== "ping") {
      const auth = authenticateAdmin_(adminId, token);
      if (!auth.ok) return json_({ ok: false, error: auth.error });
    }
    switch (action) {
      case "ping": return json_({ ok: true, data: "PONG" });
      case "listMembers": return json_({ ok: true, data: listMembers_() });
      case "addMember": return json_({ ok: true, data: addMember_(payload) });
      case "listVisits": return json_({ ok: true, data: listVisits_(memberId) });
      case "addVisit": return json_({ ok: true, data: addVisit_(payload, adminId) });
      case "editVisit": return json_({ ok: true, data: editVisit_(payload, adminId) });
      case "deleteMember": return json_({ ok: true, data: deleteMember_(memberId) });
      default: return json_({ ok: false, error: "Action unknown" });
    }
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}

function doGet(e) {
  if (e.parameter.action === "publicLeaderboard") {
    return json_({ ok: true, data: publicLeaderboard_(100) });
  }
  return json_({ ok: false, error: "Invalid GET" });
}

function addMember_(payload) {
  const { name, phone } = payload;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shMembers = ss.getSheetByName(SHEET_MEMBERS);
  const shMeta = ss.getSheetByName(SHEET_META);
  const data = shMembers.getDataRange().getValues();
  const idx = indexMap_(data[0]);
  const cleanPhone = (p) => String(p).replace(/\D/g, "").replace(/^(0|62)/, "");
  const newPhoneClean = cleanPhone(phone);
  for (let i = 1; i < data.length; i++) {
    if (cleanPhone(data[i][idx.phone]) === newPhoneClean) {
      throw "Nomor " + phone + " sudah terdaftar atas nama " + data[i][idx.name];
    }
  }
  let lastNo = shMeta.getRange("B1").getValue() || 0;
  const nextNo = Number(lastNo) + 1;
  const memberId = "RKM" + String(nextNo).padStart(3, '0');
  shMembers.appendRow([memberId, name, phone, 0, 0, true, new Date()]);
  shMeta.getRange("B1").setValue(nextNo);
  return { memberId, name };
}

function addVisit_(p, adminId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shV = ss.getSheetByName(SHEET_VISITS);
  const shM = ss.getSheetByName(SHEET_MEMBERS);
  const vId = "VST-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  shV.appendRow([vId, p.memberId, p.points, new Date(), adminId]);
  const mD = shM.getDataRange().getValues();
  const idx = indexMap_(mD[0]);
  for (let i = 1; i < mD.length; i++) {
    if (mD[i][idx.memberId] === p.memberId) {
      shM.getRange(i+1, idx.totalPoints+1).setValue(Number(mD[i][idx.totalPoints]) + Number(p.points));
      shM.getRange(i+1, idx.totalVisits+1).setValue(Number(mD[i][idx.totalVisits]) + 1);
      break;
    }
  }
  return { visitId: vId };
}

function editVisit_(payload, adminId) {
  const { visitId, memberId, newPoints } = payload;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shV = ss.getSheetByName(SHEET_VISITS);
  const shM = ss.getSheetByName(SHEET_MEMBERS);
  const vData = shV.getDataRange().getValues();
  let diff = 0, found = false;
  for (let i = 1; i < vData.length; i++) {
    if (vData[i][0] === visitId) {
      diff = Number(newPoints) - Number(vData[i][2]);
      shV.getRange(i+1, 3).setValue(Number(newPoints));
      shV.getRange(i+1, 4).setValue(new Date());
      shV.getRange(i+1, 5).setValue(adminId);
      found = true;
      break;
    }
  }
  if (!found) throw "ID Visit tidak ditemukan.";
  const mData = shM.getDataRange().getValues();
  const idx = indexMap_(mData[0]);
  for (let i = 1; i < mData.length; i++) {
    if (mData[i][idx.memberId] === memberId) {
      shM.getRange(i+1, idx.totalPoints+1).setValue(Number(mData[i][idx.totalPoints]) + diff);
      break;
    }
  }
  return true;
}

function listMembers_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMBERS);
  const v = sh.getDataRange().getValues();
  const idx = indexMap_(v[0]);
  return v.slice(1).map(r => ({ memberId: r[idx.memberId], name: r[idx.name], phone: r[idx.phone], totalPoints: Number(r[idx.totalPoints]) || 0, totalVisits: Number(r[idx.totalVisits]) || 0, active: String(r[idx.active]).toUpperCase() === "TRUE" })).filter(m => m.active && m.memberId !== "");
}

function listVisits_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_VISITS);
  const d = sh.getDataRange().getValues();
  return d.slice(1).filter(r => r[1] === id).map(r => ({ visitId: r[0], pointsAdded: r[2], timestamp: r[3] })).reverse();
}

function deleteMember_(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shM = ss.getSheetByName(SHEET_MEMBERS), shV = ss.getSheetByName(SHEET_VISITS);
  const d = shM.getDataRange().getValues();
  const idx = indexMap_(d[0]);
  for (let i = 1; i < d.length; i++) { if (d[i][idx.memberId] === id) { shM.deleteRow(i+1); const vD = shV.getDataRange().getValues(); for (let j = vD.length - 1; j >= 1; j--) { if (vD[j][1] === id) shV.deleteRow(j+1); } return true; } }
  return false;
}

function publicLeaderboard_(l) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMBERS);
  const v = sh.getDataRange().getValues();
  const idx = indexMap_(v[0]);
  return v.slice(1).map(r => ({ memberId: r[idx.memberId], name: r[idx.name], totalPoints: Number(r[idx.totalPoints]) || 0 })).filter(m => m.name !== "").sort((a,b) => b.totalPoints - a.totalPoints).slice(0, l);
}

function authenticateAdmin_(id, token) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ADMINS);
  const v = sh.getDataRange().getValues();
  const idx = indexMap_(v[0]);
  const h = sha256hex_(token);
  for (let i = 1; i < v.length; i++) { if (v[i][idx.adminId] === id && v[i][idx.tokenHash] === h) return { ok: true }; }
  return { ok: false, error: "Invalid token" };
}
function indexMap_(h) { const m = {}; h.forEach((x, i) => m[x.trim()] = i); return m; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sha256hex_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s).map(b => ("0" + (b & 255).toString(16)).slice(-2)).join(""); }
