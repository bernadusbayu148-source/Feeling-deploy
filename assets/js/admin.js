import { auth as fbAuth, db as fbDb } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  ref,
  push,
  set,
  get,
  update,
  onValue,
  query,
  orderByChild,
  equalTo,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

console.log("✅ admin.js loaded (clean)", new Date().toISOString());

// ===== Elements =====
const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");
const statusBar = document.getElementById("status-bar");
const adminEmailDisplay = document.getElementById("admin-email-display");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginMessage = document.getElementById("login-message");

const searchInput = document.getElementById("member-search");
const suggestionsBox = document.getElementById("member-suggestions");
const searchMessage = document.getElementById("search-message");

const memberNameInput = document.getElementById("member-name");
const memberPhoneInput = document.getElementById("member-phone");
const addMemberBtn = document.getElementById("add-member-btn");
const memberMessage = document.getElementById("member-message");

const memberDetailSection = document.getElementById("member-detail-section");
const detailMemberName = document.getElementById("detail-member-name");
const detailMemberPhone = document.getElementById("detail-member-phone");
const detailTotalPoints = document.getElementById("detail-total-points");
const detailTotalVisits = document.getElementById("detail-total-visits");
const detailStatus = document.getElementById("detail-status");

const visitPointsInput = document.getElementById("visit-points");
const visitNoteInput = document.getElementById("visit-note");
const addVisitBtn = document.getElementById("add-visit-btn");
const visitMessage = document.getElementById("visit-message");

const memberLogList = document.getElementById("member-log-list");
const deleteMemberBtn = document.getElementById("delete-member-btn");

// ===== State =====
let currentAdminEmail = "";
let membersCache = {};
let selectedMemberId = null;
let selectedMemberLogs = [];
let unsubMembers = null;
let unsubLogs = null;

// ===== Helpers =====
function showMsg(el, text, type = "success") {
  if (!el) return;
  el.textContent = text;
  el.classList.remove("hidden", "text-red-600", "text-emerald-700", "text-stone-500");
  el.classList.add(type === "error" ? "text-red-600" : type === "neutral" ? "text-stone-500" : "text-emerald-700");
}

function hideMsg(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function setLoggedOutUI() {
  loginSection?.classList.remove("hidden");
  adminSection?.classList.add("hidden");
  statusBar?.classList.add("hidden");
  if (adminEmailDisplay) adminEmailDisplay.textContent = "-";
}

function setLoggedInUI(email) {
  loginSection?.classList.add("hidden");
  adminSection?.classList.remove("hidden");
  statusBar?.classList.remove("hidden");
  if (adminEmailDisplay) adminEmailDisplay.textContent = email || "-";
}

async function checkAdminAccess(user) {
  const snap = await get(ref(fbDb, `admins/${user.uid}`));
  return snap.exists();
}

function detachListeners() {
  if (typeof unsubMembers === "function") unsubMembers();
  if (typeof unsubLogs === "function") unsubLogs();
  unsubMembers = null;
  unsubLogs = null;
}

function normalizePoints(log) {
  return Number(log?.points ?? log?.change ?? 0);
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso || "-";
  }
}

function clearMemberUI() {
  selectedMemberId = null;
  selectedMemberLogs = [];
  memberDetailSection?.classList.add("hidden");
  if (detailMemberName) detailMemberName.textContent = "-";
  if (detailMemberPhone) detailMemberPhone.textContent = "-";
  if (detailTotalPoints) detailTotalPoints.textContent = "0 pts";
  if (detailTotalVisits) detailTotalVisits.textContent = "0 visit";
  if (detailStatus) detailStatus.textContent = "Aktif";
  if (memberLogList) memberLogList.innerHTML = "";
}

// ===== Members load =====
function loadMembers() {
  if (typeof unsubMembers === "function") unsubMembers();

  unsubMembers = onValue(
    ref(fbDb, "members"),
    (snap) => {
      membersCache = {};
      if (snap.exists()) snap.forEach((ch) => (membersCache[ch.key] = ch.val() || {}));
      console.log("✅ members loaded:", Object.keys(membersCache).length);
    },
    (err) => {
      console.error("members read error:", err);
      showMsg(searchMessage, "Gagal membaca members. Periksa Rules (.read).", "error");
    }
  );
}

// ===== Search =====
function renderSuggestions(items) {
  if (!suggestionsBox) return;
  suggestionsBox.innerHTML = "";
  if (!items.length) {
    suggestionsBox.classList.add("hidden");
    return;
  }

  suggestionsBox.classList.remove("hidden");
  items.forEach(({ id, member }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "w-full text-left px-4 py-3 text-sm hover:bg-stone-50 transition border-b border-stone-100 last:border-b-0";
    btn.innerHTML = `<div class="font-medium text-primary">${member.name || "-"}</div>
                     <div class="text-xs text-stone-500 mt-1">${member.phone || "-"}</div>`;
    btn.addEventListener("click", () => selectMember(id));
    suggestionsBox.appendChild(btn);
  });
}

function filterMembers(keyword) {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];
  return Object.entries(membersCache)
    .filter(([, m]) => (m.name || "").toLowerCase().includes(q))
    .slice(0, 10)
    .map(([id, member]) => ({ id, member }));
}

function selectMember(memberId) {
  const member = membersCache[memberId];
  if (!member) return;

  selectedMemberId = memberId;
  if (searchInput) searchInput.value = member.name || "";
  suggestionsBox?.classList.add("hidden");
  hideMsg(searchMessage);

  // render detail
  memberDetailSection?.classList.remove("hidden");
  detailMemberName.textContent = member.name || "-";
  detailMemberPhone.textContent = member.phone || "-";
  detailTotalPoints.textContent = `${Number(member.points || 0)} pts`;
  detailTotalVisits.textContent = `${Number(member.visits || 0)} visit`;
  detailStatus.textContent = member.active ? "Aktif" : "Nonaktif";

  loadLogsForMember(memberId);
}

// ===== Logs =====
function renderLogs(rows) {
  if (!memberLogList) return;

  if (!rows.length) {
    memberLogList.innerHTML = `<div class="rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-sm text-stone-500">Belum ada riwayat visit.</div>`;
    return;
  }

  memberLogList.innerHTML = rows
    .map(({ id, data }) => {
      const pts = normalizePoints(data);
      return `
        <div class="rounded-2xl border border-stone-200 px-4 py-4">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p class="font-medium text-primary">+${pts} pts</p>
              <p class="text-sm text-stone-500">${data.note || "Visit"}</p>
              <p class="text-xs text-stone-400 mt-1">${formatDate(data.createdAt)}</p>
            </div>
            <button type="button" class="delete-visit-btn rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition" data-log="${id}">
              Hapus Visit
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  memberLogList.querySelectorAll(".delete-visit-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteVisit(btn.dataset.log));
  });
}

function loadLogsForMember(memberId) {
  if (typeof unsubLogs === "function") unsubLogs();

  const qLogs = query(ref(fbDb, "point_logs"), orderByChild("memberId"), equalTo(memberId));
  unsubLogs = onValue(qLogs, (snap) => {
    const rows = [];
    if (snap.exists()) snap.forEach((ch) => rows.push({ id: ch.key, data: ch.val() || {} }));
    rows.sort((a, b) => new Date(b.data.createdAt || 0) - new Date(a.data.createdAt || 0));
    selectedMemberLogs = rows;
    renderLogs(rows);
  });
}

// ===== Actions =====
async function addMember() {
  hideMsg(memberMessage);
  const name = (memberNameInput?.value || "").trim();
  const phone = (memberPhoneInput?.value || "").trim();

  if (!name) return showMsg(memberMessage, "Nama member wajib diisi.", "error");

  await set(push(ref(fbDb, "members")), {
    name,
    phone,
    points: 0,
    visits: 0,
    active: true,
    createdAt: new Date().toISOString()
  });

  memberNameInput.value = "";
  memberPhoneInput.value = "";
  showMsg(memberMessage, "Member berhasil ditambahkan.", "success");
}

async function addVisit() {
  hideMsg(visitMessage);
  if (!selectedMemberId) return showMsg(visitMessage, "Pilih member dulu.", "error");

  const points = parseInt(visitPointsInput?.value || "", 10);
  const note = (visitNoteInput?.value || "").trim();
  if (Number.isNaN(points) || points <= 0) return showMsg(visitMessage, "Point visit harus > 0.", "error");
  if (!note) return showMsg(visitMessage, "Catatan visit wajib.", "error");

  const member = membersCache[selectedMemberId];

  await set(push(ref(fbDb, "point_logs")), {
    memberId: selectedMemberId,
    memberName: member.name || "-",
    points,
    note,
    createdAt: new Date().toISOString(),
    createdBy: currentAdminEmail || "-"
  });

  await update(ref(fbDb, `members/${selectedMemberId}`), {
    points: Number(member.points || 0) + points,
    visits: Number(member.visits || 0) + 1
  });

  visitPointsInput.value = "";
  visitNoteInput.value = "";
  showMsg(visitMessage, "Visit berhasil ditambahkan.", "success");
}

async function deleteVisit(logId) {
  const target = selectedMemberLogs.find((x) => x.id === logId);
  if (!target) return;

  const pts = normalizePoints(target.data);
  if (!confirm(`Hapus visit ini?\n${target.data.note || "-"}\n+${pts} pts`)) return;

  const member = membersCache[selectedMemberId];

  await remove(ref(fbDb, `point_logs/${logId}`));
  await update(ref(fbDb, `members/${selectedMemberId}`), {
    points: Math.max(0, Number(member.points || 0) - pts),
    visits: Math.max(0, Number(member.visits || 0) - 1)
  });

  showMsg(visitMessage, "Visit berhasil dihapus.", "success");
}

async function hardDeleteMember() {
  hideMsg(visitMessage);
  if (!selectedMemberId) return showMsg(visitMessage, "Pilih member dulu.", "error");

  const member = membersCache[selectedMemberId];
  if (!confirm(`Hapus PERMANEN?\n${member.name}\n${member.points} pts / ${member.visits} visit`)) return;

  const qLogs = query(ref(fbDb, "point_logs"), orderByChild("memberId"), equalTo(selectedMemberId));
  const snap = await get(qLogs);

  const tasks = [];
  if (snap.exists()) snap.forEach((ch) => tasks.push(remove(ref(fbDb, `point_logs/${ch.key}`))));
  tasks.push(remove(ref(fbDb, `members/${selectedMemberId}`)));
  await Promise.all(tasks);

  clearMemberUI();
  if (searchInput) searchInput.value = "";
  hideSuggestions();
  showMsg(searchMessage, "Member dan semua visit berhasil dihapus.", "success");
}

// ===== Wire events =====
addMemberBtn?.addEventListener("click", addMember);
addVisitBtn?.addEventListener("click", addVisit);
deleteMemberBtn?.addEventListener("click", hardDeleteMember);

logoutBtn?.addEventListener("click", () => signOut(fbAuth));

searchInput?.addEventListener("input", () => {
  const keyword = searchInput.value.trim();
  if (!keyword) {
    hideMsg(searchMessage);
    renderSuggestions([]);
    return;
  }
  const results = filterMembers(keyword);
  if (!results.length) showMsg(searchMessage, "Tidak ada member yang cocok.", "neutral");
  else hideMsg(searchMessage);
  renderSuggestions(results);
});

// ===== Login =====
loginBtn?.addEventListener("click", async () => {
  hideMsg(loginMessage);
  const email = (emailInput?.value || "").trim();
  const password = passwordInput?.value || "";
  if (!email || !password) return showMsg(loginMessage, "Email dan password wajib diisi.", "error");

  loginBtn.disabled = true;
  const old = loginBtn.textContent;
  loginBtn.textContent = "Memproses...";

  try {
    const cred = await signInWithEmailAndPassword(fbAuth, email, password);
    const ok = await checkAdminAccess(cred.user);
    if (!ok) {
      await signOut(fbAuth);
      return showMsg(loginMessage, "Login berhasil tapi akun bukan admin.", "error");
    }
    currentAdminEmail = cred.user.email || "";
    setLoggedInUI(currentAdminEmail);
    loadMembers();
  } catch (e) {
    console.error(e);
    showMsg(loginMessage, `Login gagal: ${e.code || e.message}`, "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = old;
  }
});

// ===== Auth state =====
onAuthStateChanged(fbAuth, async (user) => {
  if (!user) {
    currentAdminEmail = "";
    detachListeners();
    setLoggedOutUI();
    return;
  }
  const ok = await checkAdminAccess(user);
  if (!ok) {
    await signOut(fbAuth);
    setLoggedOutUI();
    return;
  }
  currentAdminEmail = user.email || "";
  setLoggedInUI(currentAdminEmail);
  loadMembers();
});
