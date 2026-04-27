import { auth, db } from "./firebase-config.js";const suggestionsBox = document.getElementById("member-suggestions");
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

/* ===============================
   STATE
================================ */
let currentAdminEmail = "";
let membersCache = {};
let selectedMemberId = null;
let selectedMemberLogs = [];
let unsubscribeMembers = null;
let unsubscribeMemberLogs = null;

/* ===============================
   HELPERS
================================ */
function showMessage(el, text, type = "success") {
  if (!el) return;
  el.textContent = text;
  el.classList.remove("hidden", "text-red-600", "text-emerald-700", "text-stone-500");

  if (type === "success") el.classList.add("text-emerald-700");
  if (type === "error") el.classList.add("text-red-600");
  if (type === "neutral") el.classList.add("text-stone-500");
}

function hideMessage(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return isoString || "-";
  }
}

function normalizePoints(log) {
  // backward-compatible:
  // log baru: points
  // log lama: change
  return Number(log?.points ?? log?.change ?? 0);
}

function hideSuggestions() {
  if (!suggestionsBox) return;
  suggestionsBox.innerHTML = "";
  suggestionsBox.classList.add("hidden");
}

function showSuggestions(items) {
  if (!suggestionsBox) return;

  if (!items.length) {
    hideSuggestions();
    return;
  }

  suggestionsBox.innerHTML = items
    .map(
      ({ id, member }) => `
        <button
          type="button"
          class="search-suggestion-item w-full text-left px-4 py-3 text-sm hover:bg-stone-50 transition border-b border-stone-100 last:border-b-0"
          data-member-id="${id}"
        >
          <span class="font-medium text-primary">${member.name || "Tanpa Nama"}</span>
          <span class="block text-stone-500 text-xs mt-1">${member.phone || "-"}</span>
        </button>
      `
    )
    .join("");

  suggestionsBox.classList.remove("hidden");

  suggestionsBox.querySelectorAll(".search-suggestion-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const memberId = btn.dataset.memberId;
      selectMember(memberId);
    });
  });
}

function setLoggedOutUI() {
  if (loginSection) loginSection.classList.remove("hidden");
  if (adminSection) adminSection.classList.add("hidden");
  if (statusBar) statusBar.classList.add("hidden");
  if (adminEmailDisplay) adminEmailDisplay.textContent = "-";
  clearSelectedMember();
}

function setLoggedInUI(email) {
  if (loginSection) loginSection.classList.add("hidden");
  if (adminSection) adminSection.classList.remove("hidden");
  if (statusBar) statusBar.classList.remove("hidden");
  if (adminEmailDisplay) adminEmailDisplay.textContent = email || "-";
}

async function checkAdminAccess(user) {
  if (!user || !user.uid) return false;
  const adminRef = ref(db, `admins/${user.uid}`);
  const snap = await get(adminRef);
  return snap.exists();
}

function detachAllListeners() {
  if (typeof unsubscribeMembers === "function") {
    unsubscribeMembers();
    unsubscribeMembers = null;
  }

  if (typeof unsubscribeMemberLogs === "function") {
    unsubscribeMemberLogs();
    unsubscribeMemberLogs = null;
  }
}

function clearSelectedMember() {
  selectedMemberId = null;
  selectedMemberLogs = [];

  if (memberDetailSection) memberDetailSection.classList.add("hidden");
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
  if (!member) {
    clearSelectedMember();
    return;
  }

  if (detailMemberName) detailMemberName.textContent = member.name || "-";
  if (detailMemberPhone) detailMemberPhone.textContent = member.phone || "-";
  if (detailTotalPoints) detailTotalPoints.textContent = `${Number(member.points || 0)} pts`;
  if (detailTotalVisits) detailTotalVisits.textContent = `${Number(member.visits || 0)} visit`;
  if (detailStatus) detailStatus.textContent = member.active ? "Aktif" : "Nonaktif";

  if (memberDetailSection) memberDetailSection.classList.remove("hidden");
}

function renderMemberLogs(logs) {
  if (!memberLogList) return;

  if (!logs.length) {
    memberLogList.innerHTML = `
      <div class="rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-sm text-stone-500">
        Belum ada riwayat visit untuk member ini.
      </div>
    `;
    return;
  }

  memberLogList.innerHTML = logs
    .map((item) => {
      const log = item.data;
      const pointValue = normalizePoints(log);

      return `
        <div class="rounded-2xl border border-stone-200 px-4 py-4">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p class="font-medium text-primary">+${pointValue} pts</p>
              <p class="text-sm text-stone-500">${log.note || "Visit"}</p>
              <p class="text-xs text-stone-400 mt-1">${formatDate(log.createdAt)}</p>
            </div>

            <button
              type="button"
              class="delete-visit-btn inline-flex items-center justify-center rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
              data-log-id="${item.id}"
            >
              Hapus Visit
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  memberLogList.querySelectorAll(".delete-visit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const logId = btn.dataset.logId;
      await deleteVisit(logId);
    });
  });
}

function filterMembers(keyword) {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];

  return Object.entries(membersCache)
    .filter(([, member]) => {
      const name = (member.name || "").toLowerCase();
      return name.includes(q);
    })
    .sort((a, b) => {
      const nameA = (a[1].name || "").toLowerCase();
      const nameB = (b[1].name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    })
    .slice(0, 8)
    .map(([id, member]) => ({ id, member }));
}

/* ===============================
   AUTH
================================ */
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    hideMessage(loginMessage);

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!email || !password) {
      showMessage(loginMessage, "Email dan password wajib diisi.", "error");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Memproses...";

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      const isAdmin = await checkAdminAccess(user);
      if (!isAdmin) {
        await signOut(auth);
        showMessage(
          loginMessage,
          "Akun ini berhasil login, tetapi tidak terdaftar sebagai admin.",
          "error"
        );
        return;
      }

      currentAdminEmail = user.email || "";
      setLoggedInUI(currentAdminEmail);
      loadMembers();
    } catch (error) {
      console.error("Login error:", error);
      showMessage(
        loginMessage,
        "Login gagal. Cek email/password, config Firebase, dan node admin.",
        "error"
      );
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Login";
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentAdminEmail = "";
    detachAllListeners();
    setLoggedOutUI();
    return;
  }

  try {
    const isAdmin = await checkAdminAccess(user);

    if (!isAdmin) {
      await signOut(auth);
      currentAdminEmail = "";
      detachAllListeners();
      setLoggedOutUI();
      return;
    }

    currentAdminEmail = user.email || "";
    setLoggedInUI(currentAdminEmail);
    loadMembers();
  } catch (error) {
    console.error("Auth state error:", error);
    currentAdminEmail = "";
    detachAllListeners();
    setLoggedOutUI();
  }
});

/* ===============================
   MEMBERS CACHE + SEARCH
================================ */
function loadMembers() {
  if (typeof unsubscribeMembers === "function") {
    unsubscribeMembers();
    unsubscribeMembers = null;
  }

  unsubscribeMembers = onValue(ref(db, "members"), (snap) => {
    membersCache = {};

    if (!snap.exists()) {
      hideSuggestions();
      if (selectedMemberId) clearSelectedMember();
      return;
    }

    snap.forEach((child) => {
      membersCache[child.key] = child.val() || {};
    });

    // Jika member terpilih sudah terhapus
    if (selectedMemberId && !membersCache[selectedMemberId]) {
      clearSelectedMember();
      if (searchInput) searchInput.value = "";
      showMessage(searchMessage, "Member yang dipilih sudah tidak ada.", "neutral");
    }

    // Refresh summary jika member masih ada
    if (selectedMemberId && membersCache[selectedMemberId]) {
      renderMemberDetail(membersCache[selectedMemberId]);
    }

    // Refresh suggestion saat user sedang mengetik
    const currentKeyword = searchInput ? searchInput.value.trim() : "";
    if (currentKeyword) {
      const results = filterMembers(currentKeyword);
      showSuggestions(results);
    }
  });
}

function selectMember(memberId) {
  const member = membersCache[memberId];
  if (!member) {
    showMessage(searchMessage, "Member tidak ditemukan.", "error");
    return;
  }

  selectedMemberId = memberId;

  if (searchInput) searchInput.value = member.name || "";
  hideSuggestions();
  hideMessage(searchMessage);

  renderMemberDetail(member);
  loadLogsForMember(memberId);
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const keyword = searchInput.value.trim();

    if (!keyword) {
      hideSuggestions();
      hideMessage(searchMessage);
      return;
    }

    const results = filterMembers(keyword);

    if (!results.length) {
      showMessage(searchMessage, "Tidak ada member yang cocok.", "neutral");
      hideSuggestions();
      return;
    }

    hideMessage(searchMessage);
    showSuggestions(results);
  });

  searchInput.addEventListener("focus", () => {
    const keyword = searchInput.value.trim();
    if (!keyword) return;

    const results = filterMembers(keyword);
    showSuggestions(results);
  });
}

document.addEventListener("click", (event) => {
  if (!searchInput) return;
  const wrapper = searchInput.closest(".relative");
  if (wrapper && !wrapper.contains(event.target)) {
    hideSuggestions();
  }
});

/* ===============================
   ADD MEMBER
================================ */
if (addMemberBtn) {
  addMemberBtn.addEventListener("click", async () => {
    hideMessage(memberMessage);

    const name = memberNameInput ? memberNameInput.value.trim() : "";
    const phone = memberPhoneInput ? memberPhoneInput.value.trim() : "";

    if (!name) {
      showMessage(memberMessage, "Nama member wajib diisi.", "error");
      return;
    }

    addMemberBtn.disabled = true;
    addMemberBtn.textContent = "Menyimpan...";

    try {
      const memberRef = push(ref(db, "members"));
      await set(memberRef, {
        name,
        phone,
        points: 0,
        visits: 0,
        active: true,
        createdAt: new Date().toISOString()
      });

      if (memberNameInput) memberNameInput.value = "";
      if (memberPhoneInput) memberPhoneInput.value = "";

      showMessage(memberMessage, "Member berhasil ditambahkan.", "success");
    } catch (error) {
      console.error("Add member error:", error);
      showMessage(memberMessage, "Gagal menambahkan member.", "error");
    } finally {
      addMemberBtn.disabled = false;
      addMemberBtn.textContent = "Simpan Member";
    }
  });
}

/* ===============================
   MEMBER LOGS
================================ */
function loadLogsForMember(memberId) {
  if (typeof unsubscribeMemberLogs === "function") {
    unsubscribeMemberLogs();
    unsubscribeMemberLogs = null;
  }

  const memberLogsQuery = query(
    ref(db, "point_logs"),
    orderByChild("memberId"),
    equalTo(memberId)
  );

  unsubscribeMemberLogs = onValue(memberLogsQuery, (snap) => {
    const rows = [];

    if (snap.exists()) {
      snap.forEach((child) => {
        rows.push({
          id: child.key,
          data: child.val() || {}
        });
      });
    }

    // urut terbaru di atas
    rows.sort((a, b) => {
      const dateA = new Date(a.data.createdAt || 0).getTime();
      const dateB = new Date(b.data.createdAt || 0).getTime();
      return dateB - dateA;
    });

    selectedMemberLogs = rows;
    renderMemberLogs(selectedMemberLogs);
  });
}

/* ===============================
   ADD VISIT (+POINT)
================================ */
if (addVisitBtn) {
  addVisitBtn.addEventListener("click", async () => {
    hideMessage(visitMessage);

    if (!selectedMemberId || !membersCache[selectedMemberId]) {
      showMessage(visitMessage, "Pilih member terlebih dahulu.", "error");
      return;
    }

    const points = visitPointsInput ? parseInt(visitPointsInput.value, 10) : NaN;
    const note = visitNoteInput ? visitNoteInput.value.trim() : "";

    if (Number.isNaN(points) || points <= 0) {
      showMessage(visitMessage, "Point visit harus angka dan lebih dari 0.", "error");
      return;
    }

    if (!note) {
      showMessage(visitMessage, "Catatan visit wajib diisi.", "error");
      return;
    }

    const member = membersCache[selectedMemberId];
    if (!member) {
      showMessage(visitMessage, "Member tidak ditemukan.", "error");
      return;
    }

    addVisitBtn.disabled = true;
    addVisitBtn.textContent = "Menyimpan...";

    try {
      const logRef = push(ref(db, "point_logs"));
      await set(logRef, {
        memberId: selectedMemberId,
        memberName: member.name || "-",
        points: points,
        note,
        createdAt: new Date().toISOString(),
        createdBy: currentAdminEmail || "-"
      });

      await update(ref(db, `members/${selectedMemberId}`), {
        points: Number(member.points || 0) + points,
        visits: Number(member.visits || 0) + 1
      });

      if (visitPointsInput) visitPointsInput.value = "";
      if (visitNoteInput) visitNoteInput.value = "";

      showMessage(visitMessage, "Visit berhasil ditambahkan.", "success");
    } catch (error) {
      console.error("Add visit error:", error);
      showMessage(visitMessage, "Gagal menambahkan visit.", "error");
    } finally {
      addVisitBtn.disabled = false;
      addVisitBtn.textContent = "Simpan Visit";
    }
  });
}

/* ===============================
   DELETE SINGLE VISIT
================================ */
async function deleteVisit(logId) {
  if (!selectedMemberId || !membersCache[selectedMemberId]) return;

  const targetLog = selectedMemberLogs.find((item) => item.id === logId);
  if (!targetLog) return;

  const pointValue = normalizePoints(targetLog.data);

  const ok = window.confirm(
    `Hapus visit ini?\n\nCatatan: ${targetLog.data.note || "-"}\nPoint: ${pointValue} pts\n\nTindakan ini akan mengurangi total point dan total visit secara permanen.`
  );

  if (!ok) return;

  try {
    const member = membersCache[selectedMemberId];
    const newPoints = Math.max(0, Number(member.points || 0) - pointValue);
    const newVisits = Math.max(0, Number(member.visits || 0) - 1);

    await remove(ref(db, `point_logs/${logId}`));

    await update(ref(db, `members/${selectedMemberId}`), {
      points: newPoints,
      visits: newVisits
    });

    showMessage(visitMessage, "Visit berhasil dihapus.", "success");
  } catch (error) {
    console.error("Delete visit error:", error);
    showMessage(visitMessage, "Gagal menghapus visit.", "error");
  }
}

/* ===============================
   HARD DELETE MEMBER + ALL LOGS
================================ */
if (deleteMemberBtn) {
  deleteMemberBtn.addEventListener("click", async () => {
    hideMessage(visitMessage);

    if (!selectedMemberId || !membersCache[selectedMemberId]) {
      showMessage(visitMessage, "Belum ada member yang dipilih.", "error");
      return;
    }

    const member = membersCache[selectedMemberId];
    const confirmDelete = window.confirm(
      `Hapus seluruh data member ini secara permanen?\n\nNama: ${member.name || "-"}\nTotal point: ${Number(member.points || 0)} pts\nTotal visit: ${Number(member.visits || 0)}\n\nSEMUA riwayat visit juga akan dihapus.`
    );

    if (!confirmDelete) return;

    try {
      const logsQuery = query(
        ref(db, "point_logs"),
        orderByChild("memberId"),
        equalTo(selectedMemberId)
      );

      const logsSnap = await get(logsQuery);

      if (logsSnap.exists()) {
        const promises = [];
        logsSnap.forEach((child) => {
          promises.push(remove(ref(db, `point_logs/${child.key}`)));
        });
        await Promise.all(promises);
      }

      await remove(ref(db, `members/${selectedMemberId}`));

      clearSelectedMember();
      if (searchInput) searchInput.value = "";
      hideSuggestions();

      showMessage(
        searchMessage,
        "Member dan seluruh riwayat visit berhasil dihapus.",
        "success"
      );
    } catch (error) {
      console.error("Delete member error:", error);
      showMessage(visitMessage, "Gagal menghapus member.", "error");
    }
  });
}
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

/* ===============================
   ELEMENTS
================================ */
const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");
const statusBar = document.getElementById("status-bar");
const adminEmailDisplay = document.getElementById("admin-email-display");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginMessage = document.getElementById("login-message");

const addMemberBtn = document.getElementById("add-member-btn");
const memberNameInput = document.getElementById("member-name");
const memberPhoneInput = document.getElementById("member-phone");
const memberMessage = document.getElementById("member-message");

const searchInput = document.getElementById("member-search");
