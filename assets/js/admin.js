import { auth, db } from "./firebase-config.js";-total-visits");
const detailStatuses = document.querySelectorAll("#detail-status");

const addVisitBtns = document.querySelectorAll("#add-visit-btn");
const visitPointsInputs = document.querySelectorAll("#visit-points");
const visitNoteInputs = document.querySelectorAll("#visit-note");
const visitMessages = document.querySelectorAll("#visit-message");

const memberLogLists = document.querySelectorAll("#member-log-list");
const deleteMemberBtns = document.querySelectorAll("#delete-member-btn");

/* ===============================
   STATE
================================ */
let currentAdminEmail = "";
let membersCache = {};              // { memberId: memberData }
let selectedMemberId = null;        // memberId aktif
let selectedMemberLogs = [];        // [{id, data}]
let unsubscribeMembers = null;
let unsubscribeMemberLogs = null;

/* ===============================
   UI Helpers
================================ */
function showAll(nodes) {
  nodes.forEach((el) => el?.classList?.remove("hidden"));
}
function hideAll(nodes) {
  nodes.forEach((el) => el?.classList?.add("hidden"));
}
function setTextAll(nodes, text) {
  nodes.forEach((el) => {
    if (el) el.textContent = text;
  });
}

function showMessage(nodes, text, type = "success") {
  nodes.forEach((el) => {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden", "text-red-600", "text-emerald-700", "text-stone-500");
    if (type === "success") el.classList.add("text-emerald-700");
    if (type === "error") el.classList.add("text-red-600");
    if (type === "neutral") el.classList.add("text-stone-500");
  });
}
function hideMessage(nodes) {
  nodes.forEach((el) => {
    if (!el) return;
    el.textContent = "";
    el.classList.add("hidden");
  });
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso || "-";
  }
}

// kompatibel log lama: change; log baru: points
function normalizePoints(log) {
  return Number(log?.points ?? log?.change ?? 0);
}

/* ===============================
   Auth helpers
================================ */
async function checkAdminAccess(user) {
  if (!user?.uid) return false;
  const adminRef = ref(db, `admins/${user.uid}`);
  const snap = await get(adminRef);
  return snap.exists();
}

function detachListeners() {
  if (typeof unsubscribeMembers === "function") {
    unsubscribeMembers();
    unsubscribeMembers = null;
  }
  if (typeof unsubscribeMemberLogs === "function") {
    unsubscribeMemberLogs();
    unsubscribeMemberLogs = null;
  }
}

function setLoggedOutUI() {
  showAll(loginSections);
  hideAll(adminSections);
  hideAll(statusBars);
  setTextAll(adminEmailDisplays, "-");
  clearSelectedMemberUI();
}

function setLoggedInUI(email) {
  hideAll(loginSections);
  showAll(adminSections);
  showAll(statusBars);
  setTextAll(adminEmailDisplays, email || "-");
}

/* ===============================
   Member UI
================================ */
function clearSelectedMemberUI() {
  selectedMemberId = null;
  selectedMemberLogs = [];

  hideAll(memberDetailSections);
  setTextAll(detailMemberNames, "-");
  setTextAll(detailMemberPhones, "-");
  setTextAll(detailTotalPoints, "0 pts");
  setTextAll(detailTotalVisits, "0 visit");
  setTextAll(detailStatuses, "Aktif");

  visitPointsInputs.forEach((i) => i && (i.value = ""));
  visitNoteInputs.forEach((i) => i && (i.value = ""));
  memberLogLists.forEach((l) => l && (l.innerHTML = ""));
}

function renderMemberDetail(member) {
  if (!member) {
    clearSelectedMemberUI();
    return;
  }

  showAll(memberDetailSections);
  setTextAll(detailMemberNames, member.name || "-");
  setTextAll(detailMemberPhones, member.phone || "-");
  setTextAll(detailTotalPoints, `${Number(member.points || 0)} pts`);
  setTextAll(detailTotalVisits, `${Number(member.visits || 0)} visit`);
  setTextAll(detailStatuses, member.active ? "Aktif" : "Nonaktif");
}

function renderMemberLogs(logs) {
  memberLogLists.forEach((listEl) => {
    if (!listEl) return;

    if (!logs.length) {
      listEl.innerHTML = `
        <div class="rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-sm text-stone-500">
          Belum ada riwayat visit untuk member ini.
        </div>
      `;
      return;
    }

    listEl.innerHTML = logs
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
              <button
                type="button"
                class="delete-visit-btn inline-flex items-center justify-center rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
                data-log-id="${id}"
              >
                Hapus Visit
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll(".delete-visit-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const logId = btn.dataset.logId;
        await deleteVisit(logId);
      });
    });
  });
}

/* ===============================
   Search + Suggestions
================================ */
function hideSuggestions() {
  suggestionBoxes.forEach((box) => {
    if (!box) return;
    box.innerHTML = "";
    box.classList.add("hidden");
  });
}

function showSuggestions(items) {
  suggestionBoxes.forEach((box) => {
    if (!box) return;

    if (!items.length) {
      box.innerHTML = "";
      box.classList.add("hidden");
      return;
    }

    box.innerHTML = items
      .map(({ id, member }) => `
        <button
          type="button"
          class="search-suggestion-item w-full text-left px-4 py-3 text-sm hover:bg-stone-50 transition border-b border-stone-100 last:border-b-0"
          data-member-id="${id}"
        >
          <span class="font-medium text-primary">${member.name || "Tanpa Nama"}</span>
          <span class="block text-stone-500 text-xs mt-1">${member.phone || "-"}</span>
        </button>
      `)
      .join("");

    box.classList.remove("hidden");

    box.querySelectorAll(".search-suggestion-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const memberId = btn.dataset.memberId;
        selectMember(memberId);
      });
    });
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

/* ===============================
   Data loaders
================================ */
function loadMembers() {
  if (typeof unsubscribeMembers === "function") {
    unsubscribeMembers();
    unsubscribeMembers = null;
  }

  unsubscribeMembers = onValue(ref(db, "members"), (snap) => {
    membersCache = {};

    if (snap.exists()) {
      snap.forEach((child) => {
        membersCache[child.key] = child.val() || {};
      });
    }

    // kalau member terpilih dihapus
    if (selectedMemberId && !membersCache[selectedMemberId]) {
      clearSelectedMemberUI();
      searchInputs.forEach((inp) => inp && (inp.value = ""));
      showMessage(searchMessages, "Member yang dipilih sudah tidak ada.", "neutral");
    }

    // refresh detail kalau masih ada
    if (selectedMemberId && membersCache[selectedMemberId]) {
      renderMemberDetail(membersCache[selectedMemberId]);
    }

    // refresh suggestions saat mengetik
    const keyword = (searchInputs[0]?.value || "").trim();
    if (keyword) {
      showSuggestions(filterMembers(keyword));
    }
  });
}

function loadLogsForMember(memberId) {
  if (typeof unsubscribeMemberLogs === "function") {
    unsubscribeMemberLogs();
    unsubscribeMemberLogs = null;
  }

  const qLogs = query(ref(db, "point_logs"), orderByChild("memberId"), equalTo(memberId));

  unsubscribeMemberLogs = onValue(qLogs, (snap) => {
    const rows = [];
    if (snap.exists()) {
      snap.forEach((child) => {
        rows.push({ id: child.key, data: child.val() || {} });
      });
    }

    rows.sort((a, b) => new Date(b.data.createdAt || 0) - new Date(a.data.createdAt || 0));
    selectedMemberLogs = rows;

    renderMemberLogs(rows);
  });
}

function selectMember(memberId) {
  const member = membersCache[memberId];
  if (!member) {
    showMessage(searchMessages, "Member tidak ditemukan.", "error");
    return;
  }

  selectedMemberId = memberId;
  searchInputs.forEach((inp) => inp && (inp.value = member.name || ""));
  hideSuggestions();
  hideMessage(searchMessages);

  renderMemberDetail(member);
  loadLogsForMember(memberId);
}

/* ===============================
   Actions: Add Member / Add Visit / Delete Visit / Delete Member
================================ */
async function addMember(name, phone) {
  const memberRef = push(ref(db, "members"));
  await set(memberRef, {
    name,
    phone,
    points: 0,
    visits: 0,
    active: true,
    createdAt: new Date().toISOString()
  });
}

async function addVisit(points, note) {
  if (!selectedMemberId) throw new Error("Pilih member dulu.");
  const member = membersCache[selectedMemberId];
  if (!member) throw new Error("Member tidak ditemukan.");

  const logRef = push(ref(db, "point_logs"));
  await set(logRef, {
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
}

async function deleteVisit(logId) {
  if (!selectedMemberId) return;

  const target = selectedMemberLogs.find((x) => x.id === logId);
  if (!target) return;

  const pts = normalizePoints(target.data);
  const ok = window.confirm(
    `Hapus visit ini?\n\nCatatan: ${target.data.note || "-"}\nPoint: ${pts} pts\n\nTotal point & total visit akan berkurang.`
  );
  if (!ok) return;

  const member = membersCache[selectedMemberId];
  const newPoints = Math.max(0, Number(member.points || 0) - pts);
  const newVisits = Math.max(0, Number(member.visits || 0) - 1);

  await remove(ref(db, `point_logs/${logId}`));
  await update(ref(db, `members/${selectedMemberId}`), {
    points: newPoints,
    visits: newVisits
  });

  showMessage(visitMessages, "Visit berhasil dihapus.", "success");
}

async function hardDeleteMember() {
  if (!selectedMemberId) throw new Error("Belum ada member yang dipilih.");

  const member = membersCache[selectedMemberId];
  const ok = window.confirm(
    `HAPUS PERMANEN?\n\nNama: ${member?.name || "-"}\nTotal point: ${Number(member?.points || 0)} pts\nTotal visit: ${Number(member?.visits || 0)}\n\nSEMUA riwayat visit akan dihapus.`
  );
  if (!ok) return;

  // ambil semua logs milik member
  const qLogs = query(ref(db, "point_logs"), orderByChild("memberId"), equalTo(selectedMemberId));
  const snap = await get(qLogs);

  const tasks = [];
  if (snap.exists()) {
    snap.forEach((child) => tasks.push(remove(ref(db, `point_logs/${child.key}`))));
  }

  // hapus member
  tasks.push(remove(ref(db, `members/${selectedMemberId}`)));

  await Promise.all(tasks);

  clearSelectedMemberUI();
  searchInputs.forEach((inp) => inp && (inp.value = ""));
  hideSuggestions();
  showMessage(searchMessages, "Member & seluruh riwayat visit berhasil dihapus.", "success");
}

/* ===============================
   WIRE EVENTS
================================ */

// Login buttons (support duplikasi)
loginBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    console.log("🟢 Login clicked");

    hideMessage(loginMessages);

    // ambil email/password yang paling dekat dengan tombol
    const container = btn.closest("#login-section") || document;
    const emailEl = container.querySelector("#email") || document.querySelector("#email");
    const passEl = container.querySelector("#password") || document.querySelector("#password");

    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    if (!email || !password) {
      showMessage(loginMessages, "Email dan password wajib diisi.", "error");
      return;
    }

    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = "Memproses...";

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      const allowed = await checkAdminAccess(user);
      if (!allowed) {
        await signOut(auth);
        showMessage(loginMessages, "Login berhasil, tetapi akun ini bukan admin.", "error");
        return;
      }

      currentAdminEmail = user.email || "";
      setLoggedInUI(currentAdminEmail);
      loadMembers();
      showMessage(loginMessages, "Login berhasil.", "success");
    } catch (err) {
      console.error("Login error:", err);
      showMessage(loginMessages, `Login gagal: ${err?.code || err?.message || "unknown"}`, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });
});

// Logout buttons
logoutBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  });
});

// Search input
searchInputs.forEach((inp) => {
  inp.addEventListener("input", () => {
    const keyword = inp.value.trim();
    if (!keyword) {
      hideSuggestions();
      hideMessage(searchMessages);
      return;
    }

    const results = filterMembers(keyword);
    if (!results.length) {
      hideSuggestions();
      showMessage(searchMessages, "Tidak ada member yang cocok.", "neutral");
      return;
    }

    hideMessage(searchMessages);
    showSuggestions(results);
  });

  inp.addEventListener("focus", () => {
    const keyword = inp.value.trim();
    if (!keyword) return;
    const results = filterMembers(keyword);
    showSuggestions(results);
  });
});

// click outside suggestion -> hide
document.addEventListener("click", (e) => {
  // hide suggestion jika klik di luar input & kotak suggestion
  const inSearch = [...searchInputs].some((inp) => inp?.closest(".relative")?.contains(e.target));
  const inBox = [...suggestionBoxes].some((box) => box?.contains(e.target));
  if (!inSearch && !inBox) hideSuggestions();
});

// Add member
addMemberBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    hideMessage(memberMessages);

    // ambil input paling dekat (jika duplikat)
    const container = btn.closest("div") || document;
    const nameEl = container.querySelector("#member-name") || memberNameInputs[0];
    const phoneEl = container.querySelector("#member-phone") || memberPhoneInputs[0];

    const name = (nameEl?.value || "").trim();
    const phone = (phoneEl?.value || "").trim();

    if (!name) {
      showMessage(memberMessages, "Nama member wajib diisi.", "error");
      return;
    }

    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = "Menyimpan...";

    try {
      await addMember(name, phone);
      if (nameEl) nameEl.value = "";
      if (phoneEl) phoneEl.value = "";
      showMessage(memberMessages, "Member berhasil ditambahkan.", "success");
    } catch (err) {
      console.error("Add member error:", err);
      showMessage(memberMessages, "Gagal menambahkan member.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });
});

// Add visit
addVisitBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    hideMessage(visitMessages);

    if (!selectedMemberId) {
      showMessage(visitMessages, "Pilih member terlebih dahulu.", "error");
      return;
    }

    // ambil input poin/catatan
    const container = btn.closest("#member-detail-section") || document;
    const pointsEl = container.querySelector("#visit-points") || visitPointsInputs[0];
    const noteEl = container.querySelector("#visit-note") || visitNoteInputs[0];

    const points = parseInt(pointsEl?.value || "", 10);
    const note = (noteEl?.value || "").trim();

    if (Number.isNaN(points) || points <= 0) {
      showMessage(visitMessages, "Point visit harus angka dan lebih dari 0.", "error");
      return;
    }
    if (!note) {
      showMessage(visitMessages, "Catatan visit wajib diisi.", "error");
      return;
    }

    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = "Menyimpan...";

    try {
      await addVisit(points, note);
      if (pointsEl) pointsEl.value = "";
      if (noteEl) noteEl.value = "";
      showMessage(visitMessages, "Visit berhasil ditambahkan.", "success");
    } catch (err) {
      console.error("Add visit error:", err);
      showMessage(visitMessages, "Gagal menambahkan visit.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });
});

// Delete member (hard delete)
deleteMemberBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    hideMessage(visitMessages);

    try {
      await hardDeleteMember();
    } catch (err) {
      console.error("Delete member error:", err);
      showMessage(visitMessages, err?.message || "Gagal menghapus member.", "error");
    }
  });
});

/* ===============================
   AUTH STATE
================================ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentAdminEmail = "";
    detachListeners();
    setLoggedOutUI();
    return;
  }

  try {
    const allowed = await checkAdminAccess(user);
    if (!allowed) {
      await signOut(auth);
      currentAdminEmail = "";
      detachListeners();
      setLoggedOutUI();
      return;
    }

    currentAdminEmail = user.email || "";
    setLoggedInUI(currentAdminEmail);
    loadMembers();
  } catch (err) {
    console.error("Auth state error:", err);
    currentAdminEmail = "";
    detachListeners();
    setLoggedOutUI();
  }
});
``
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

/**
 * ==========================================
 * DEBUG: pastikan file ini benar-benar jalan
 * ==========================================
 */
console.log("✅ admin.js loaded", new Date().toISOString());

/* ===============================
   ELEMENTS (ambil banyak jika duplikat)
================================ */
const loginSections = document.querySelectorAll("#login-section");
const adminSections = document.querySelectorAll("#admin-section");
const statusBars = document.querySelectorAll("#status-bar");
const adminEmailDisplays = document.querySelectorAll("#admin-email-display");

const loginBtns = document.querySelectorAll("#login-btn");
const logoutBtns = document.querySelectorAll("#logout-btn");
const loginMessages = document.querySelectorAll("#login-message");

const addMemberBtns = document.querySelectorAll("#add-member-btn");
const memberNameInputs = document.querySelectorAll("#member-name");
const memberPhoneInputs = document.querySelectorAll("#member-phone");
const memberMessages = document.querySelectorAll("#member-message");

const searchInputs = document.querySelectorAll("#member-search");
const suggestionBoxes = document.querySelectorAll("#member-suggestions");
const searchMessages = document.querySelectorAll("#search-message");

const memberDetailSections = document.querySelectorAll("#member-detail-section");
const detailMemberNames = document.querySelectorAll("#detail-member-name");
const detailMemberPhones = document.querySelectorAll("#detail-member-phone");
const detailTotalPoints = document.querySelectorAll("#detail-total-points");
