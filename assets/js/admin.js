import { auth, db } from "./firebase-config.js";
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

console.log("✅ admin.js loaded (firebase version)", new Date().toISOString());

// ===== Elements (ambil yang pertama; kalau HTML Anda dobel, ini tetap jalan) =====
const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");
const statusBar = document.getElementById("status-bar");
const adminEmailDisplay = document.getElementById("admin-email-display");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginMessage = document.getElementById("login-message");

const memberNameInput = document.getElementById("member-name");
const memberPhoneInput = document.getElementById("member-phone");
const addMemberBtn = document.getElementById("add-member-btn");
const memberMessage = document.getElementById("member-message");

const searchInput = document.getElementById("member-search");
const suggestionsBox = document.getElementById("member-suggestions");
const searchMessage = document.getElementById("search-message");

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
  if (type === "success") el.classList.add("text-emerald-700");
  if (type === "error") el.classList.add("text-red-600");
  if (type === "neutral") el.classList.add("text-stone-500");
}

function hideMsg(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso || "-";
  }
}

function normalizePoints(log) {
  // kompatibel log lama (change) & log baru (points)
  return Number(log?.points ?? log?.change ?? 0);
}

function setLoggedOutUI() {
  loginSection?.classList.remove("hidden");
  adminSection?.classList.add("hidden");
  statusBar?.classList.add("hidden");
  if (adminEmailDisplay) adminEmailDisplay.textContent = "-";
  clearSelectedMember();
}

function setLoggedInUI(email) {
  loginSection?.classList.add("hidden");
  adminSection?.classList.remove("hidden");
  statusBar?.classList.remove("hidden");
  if (adminEmailDisplay) adminEmailDisplay.textContent = email || "-";
}

async function checkAdminAccess(user) {
  const snap = await get(ref(db, `admins/${user.uid}`));
  return snap.exists();
}

function clearSelectedMember() {
  selectedMemberId = null;
  selectedMemberLogs = [];
  memberDetailSection?.classList.add("hidden");
  if (detailMemberName) detailMemberName.textContent = "-";
  if (detailMemberPhone) detailMemberPhone.textContent = "-";
  if (detailTotalPoints) detailTotalPoints.textContent = "0 pts";
  if (detailTotalVisits) detailTotalVisits.textContent = "0 visit";
  if (detailStatus) detailStatus.textContent = "Aktif";
  if (visitPointsInput) visitPointsInput.value = "";
  if (visitNoteInput) visitNoteInput.value = "";
  if (memberLogList) memberLogList.innerHTML = "";
}

function renderMemberDetail(member) {
  if (!member) return clearSelectedMember();
  memberDetailSection?.classList.remove("hidden");
  detailMemberName.textContent = member.name || "-";
  detailMemberPhone.textContent = member.phone || "-";
  detailTotalPoints.textContent = `${Number(member.points || 0)} pts`;
  detailTotalVisits.textContent = `${Number(member.visits || 0)} visit`;
  detailStatus.textContent = member.active ? "Aktif" : "Nonaktif";
}

function renderSuggestions(items) {
  if (!suggestionsBox) return;
  if (!items.length) {
    suggestionsBox.classList.add("hidden");
    suggestionsBox.innerHTML = "";
    return;
  }

  suggestionsBox.innerHTML = items.map(({ id, member }) => `
    <button
      type="button"
      class="w-full text-left px-4 py-3 text-sm hover:bg-stone-50 transition border-b border-stone-100 last:border-b-0"
      data-id="${id}"
    >
      <div class="font-medium text-primary">${member.name || "Tanpa Nama"}</div>
      <div class="text-xs text-stone-500 mt-1">${member.phone || "-"}</div>
    </button>
  `).join("");

  suggestionsBox.classList.remove("hidden");

  suggestionsBox.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", () => selectMember(btn.dataset.id));
  });
}

function filterMembers(keyword) {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];
  return Object.entries(membersCache)
    .filter(([, m]) => (m.name || "").toLowerCase().includes(q))
    .sort((a, b) => (a[1].name || "").localeCompare(b[1].name || ""))
    .slice(0, 8)
    .map(([id, member]) => ({ id, member }));
}

function renderLogs(logs) {
  if (!memberLogList) return;

  if (!logs.length) {
    memberLogList.innerHTML = `
      <div class="rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-sm text-stone-500">
        Belum ada riwayat visit untuk member ini.
      </div>
    `;
    return;
  }

  memberLogList.innerHTML = logs.map(({ id, data }) => {
    const pts = normalizePoints(data);
    return `
      <div class="rounded-2xl border border-stone-200 px-4 py-4">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p class="font-medium text-primary">+${pts} pts</p>
            <p class="text-sm text-stone-500">${data.note || "Visit"}</p>
            <p class="text-xs text-stone-400 mt-1">${formatDate(data.createdAt)}</p>
          </div>

          <button
            type="button"
            class="delete-visit-btn inline-flex items-center justify-center rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
            data-log="${id}"
          >
            Hapus Visit
          </button>
        </div>
      </div>
    `;
  }).join("");

  memberLogList.querySelectorAll(".delete-visit-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteVisit(btn.dataset.log));
  });
}

// ===== Loaders =====
function loadMembers() {
  if (typeof unsubMembers === "function") unsubMembers();
  unsubMembers = onValue(ref(db, "members"), (snap) => {
    membersCache = {};
    if (snap.exists()) snap.forEach(ch => membersCache[ch.key] = ch.val() || {});

    // refresh detail jika masih memilih member
    if (selectedMemberId && membersCache[selectedMemberId]) {
      renderMemberDetail(membersCache[selectedMemberId]);
    }
  });
}

function loadLogsForMember(memberId) {
  if (typeof unsubLogs === "function") unsubLogs();
  const qLogs = query(ref(db, "point_logs"), orderByChild("memberId"), equalTo(memberId));

  unsubLogs = onValue(qLogs, (snap) => {
    const rows = [];
    if (snap.exists()) snap.forEach(ch => rows.push({ id: ch.key, data: ch.val() || {} }));
    rows.sort((a, b) => new Date(b.data.createdAt || 0) - new Date(a.data.createdAt || 0));
    selectedMemberLogs = rows;
    renderLogs(rows);
  });
}

function selectMember(memberId) {
  const member = membersCache[memberId];
  if (!member) {
    showMsg(searchMessage, "Member tidak ditemukan.", "error");
    return;
  }

  selectedMemberId = memberId;
  if (searchInput) searchInput.value = member.name || "";
  suggestionsBox?.classList.add("hidden");
  hideMsg(searchMessage);

  renderMemberDetail(member);
  loadLogsForMember(memberId);
}

// ===== Actions =====
async function deleteVisit(logId) {
  if (!selectedMemberId) return;
  const target = selectedMemberLogs.find(x => x.id === logId);
  if (!target) return;

  const pts = normalizePoints(target.data);
  const ok = confirm(`Hapus visit ini?\n\n${target.data.note || "-"}\n+${pts} pts`);
  if (!ok) return;

  const member = membersCache[selectedMemberId];
  const newPoints = Math.max(0, Number(member.points || 0) - pts);
  const newVisits = Math.max(0, Number(member.visits || 0) - 1);

  await remove(ref(db, `point_logs/${logId}`));
  await update(ref(db, `members/${selectedMemberId}`), { points: newPoints, visits: newVisits });

  showMsg(visitMessage, "Visit berhasil dihapus.", "success");
}

async function hardDeleteMember() {
  if (!selectedMemberId) return;

  const member = membersCache[selectedMemberId];
  const ok = confirm(
    `Hapus PERMANEN member ini?\n\nNama: ${member.name}\nTotal: ${member.points} pts\nVisit: ${member.visits}\n\nSemua log akan dihapus.`
  );
  if (!ok) return;

  // hapus semua logs milik member
  const qLogs = query(ref(db, "point_logs"), orderByChild("memberId"), equalTo(selectedMemberId));
  const snap = await get(qLogs);
  const tasks = [];

  if (snap.exists()) {
    snap.forEach(ch => tasks.push(remove(ref(db, `point_logs/${ch.key}`))));
  }

  tasks.push(remove(ref(db, `members/${selectedMemberId}`)));
  await Promise.all(tasks);

  clearSelectedMember();
  if (searchInput) searchInput.value = "";
  showMsg(searchMessage, "Member dan semua riwayat visit berhasil dihapus.", "success");
}

async function addVisit() {
  hideMsg(visitMessage);

  if (!selectedMemberId) {
    showMsg(visitMessage, "Pilih member terlebih dahulu.", "error");
    return;
  }

  const points = parseInt(visitPointsInput?.value || "", 10);
  const note = (visitNoteInput?.value || "").trim();

  if (Number.isNaN(points) || points <= 0) {
    showMsg(visitMessage, "Point visit harus angka dan > 0.", "error");
    return;
  }
  if (!note) {
    showMsg(visitMessage, "Catatan visit wajib diisi.", "error");
    return;
  }

  const member = membersCache[selectedMemberId];

  await set(push(ref(db, "point_logs")), {
    memberId: selectedMemberId,
    memberName: member.name || "-",
    points,
    note,
    createdAt: new Date().toISOString(),
    createdBy: currentAdminEmail || "-"
  });

  await update(ref(db, `members/${selectedMemberId}`), {
    points: Number(member.points || 0) + points,
    visits: Number(member.visits || 0) + 1
  });

  visitPointsInput.value = "";
  visitNoteInput.value = "";
  showMsg(visitMessage, "Visit berhasil ditambahkan.", "success");
}

async function addMember() {
  hideMsg(memberMessage);

  const name = (memberNameInput?.value || "").trim();
  const phone = (memberPhoneInput?.value || "").trim();

  if (!name) {
    showMsg(memberMessage, "Nama member wajib diisi.", "error");
    return;
  }

  await set(push(ref(db, "members")), {
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

// ===== Wire UI events =====
loginBtn?.addEventListener("click", async () => {
  hideMsg(loginMessage);

  const email = (emailInput?.value || "").trim();
  const password = passwordInput?.value || "";

  if (!email || !password) {
    showMsg(loginMessage, "Email dan password wajib diisi.", "error");
    return;
  }

  loginBtn.disabled = true;
  const oldText = loginBtn.textContent;
  loginBtn.textContent = "Memproses...";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const ok = await checkAdminAccess(cred.user);

    if (!ok) {
      await signOut(auth);
      showMsg(loginMessage, "Login berhasil, tetapi akun ini bukan admin.", "error");
      return;
    }

    currentAdminEmail = cred.user.email || "";
    setLoggedInUI(currentAdminEmail);
    loadMembers();
  } catch (e) {
    console.error(e);
    showMsg(loginMessage, `Login gagal: ${e.code || e.message}`, "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = oldText;
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

searchInput?.addEventListener("input", () => {
  const keyword = searchInput.value.trim();
  if (!keyword) {
    suggestionsBox?.classList.add("hidden");
    hideMsg(searchMessage);
    return;
  }

  const results = filterMembers(keyword);
  if (!results.length) {
    showMsg(searchMessage, "Tidak ada member yang cocok.", "neutral");
    renderSuggestions([]);
    return;
  }

  hideMsg(searchMessage);
  renderSuggestions(results);
});

document.addEventListener("click", (e) => {
  // hide suggestions jika klik di luar area search
  const wrapper = searchInput?.closest(".relative");
  if (wrapper && !wrapper.contains(e.target)) {
    suggestionsBox?.classList.add("hidden");
  }
});

addVisitBtn?.addEventListener("click", addVisit);
addMemberBtn?.addEventListener("click", addMember);
deleteMemberBtn?.addEventListener("click", hardDeleteMember);

// ===== Auth State =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentAdminEmail = "";
    detachListeners();
    setLoggedOutUI();
    return;
  }

  try {
    const ok = await checkAdminAccess(user);
    if (!ok) {
      await signOut(auth);
      setLoggedOutUI();
      return;
    }

    currentAdminEmail = user.email || "";
    setLoggedInUI(currentAdminEmail);
    loadMembers();
  } catch (e) {
    console.error(e);
    setLoggedOutUI();
  }
});

// helper
function detachListeners() {
  if (typeof unsubMembers === "function") unsubMembers();
  if (typeof unsubLogs === "function") unsubLogs();
  unsubMembers = null;
  unsubLogs = null;
}
