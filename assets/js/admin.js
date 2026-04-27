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
  limitToLast
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ===============================
   ELEMENT REFERENCES
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

const memberNameInput = document.getElementById("member-name");
const memberPhoneInput = document.getElementById("member-phone");
const addMemberBtn = document.getElementById("add-member-btn");
const memberMessage = document.getElementById("member-message");

const memberSelect = document.getElementById("member-select");
const pointValueInput = document.getElementById("point-value");
const pointNoteInput = document.getElementById("point-note");
const addPointBtn = document.getElementById("add-point-btn");
const pointMessage = document.getElementById("point-message");

const memberList = document.getElementById("member-list");
const pointLogList = document.getElementById("point-log-list");

/* ===============================
   STATE
================================ */
let currentAdminEmail = "";
let membersCache = {};
let membersUnsub = null;
let logsUnsub = null;

/* ===============================
   UTIL
================================ */
function show(el, msg, ok = true) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden", "text-red-600", "text-emerald-700");
  el.classList.add(ok ? "text-emerald-700" : "text-red-600");
}

function clear(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function logoutUI() {
  loginSection.classList.remove("hidden");
  adminSection.classList.add("hidden");
  statusBar.classList.add("hidden");
  adminEmailDisplay.textContent = "-";
}

function loginUI(email) {
  loginSection.classList.add("hidden");
  adminSection.classList.remove("hidden");
  statusBar.classList.remove("hidden");
  adminEmailDisplay.textContent = email;
}

async function isAdmin(user) {
  const snap = await get(ref(db, `admins/${user.uid}`));
  return snap.exists();
}

/* ===============================
   AUTH
================================ */
loginBtn.addEventListener("click", async () => {
  clear(loginMessage);

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    show(loginMessage, "Email dan password wajib diisi.", false);
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Memproses...";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    if (!(await isAdmin(cred.user))) {
      await signOut(auth);
      show(loginMessage, "Login berhasil tapi akun bukan admin.", false);
      return;
    }

    currentAdminEmail = cred.user.email;
    loginUI(currentAdminEmail);
    loadMembers();
    loadLogs();
  } catch (err) {
    console.error(err);
    show(loginMessage, "Login gagal. Cek Firebase config / akun.", false);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    stopListeners();
    logoutUI();
    return;
  }

  if (!(await isAdmin(user))) {
    await signOut(auth);
    stopListeners();
    logoutUI();
    return;
  }

  currentAdminEmail = user.email;
  loginUI(currentAdminEmail);
  loadMembers();
  loadLogs();
});

/* ===============================
   MEMBERS
================================ */
addMemberBtn.addEventListener("click", async () => {
  clear(memberMessage);

  const name = memberNameInput.value.trim();
  const phone = memberPhoneInput.value.trim();

  if (!name) {
    show(memberMessage, "Nama member wajib diisi.", false);
    return;
  }

  addMemberBtn.disabled = true;
  addMemberBtn.textContent = "Menyimpan...";

  try {
    const refNew = push(ref(db, "members"));
    await set(refNew, {
      name,
      phone,
      points: 0,
      visits: 0,
      active: true,
      createdAt: new Date().toISOString()
    });

    memberNameInput.value = "";
    memberPhoneInput.value = "";
    show(memberMessage, "Member berhasil ditambahkan.");
  } catch (err) {
    console.error(err);
    show(memberMessage, "Gagal menambah member.", false);
  } finally {
    addMemberBtn.disabled = false;
    addMemberBtn.textContent = "Simpan Member";
  }
});

function loadMembers() {
  if (membersUnsub) membersUnsub();

  membersUnsub = onValue(ref(db, "members"), (snap) => {
    membersCache = {};
    memberList.innerHTML = "";
    memberSelect.innerHTML = `<option value="">-- Pilih member --</option>`;

    if (!snap.exists()) {
      memberList.innerHTML = `<p class="text-sm text-stone-500">Belum ada member.</p>`;
      return;
    }

    snap.forEach((c) => {
      const m = c.val();
      membersCache[c.key] = m;

      memberSelect.innerHTML += `<option value="${c.key}">${m.name}</option>`;

      memberList.innerHTML += `
        <div class="border rounded-xl p-3">
          <strong>${m.name}</strong> — ${m.points} pts, ${m.visits} visits
        </div>
      `;
    });
  });
}

/* ===============================
   POINTS + LOG
================================ */
addPointBtn.addEventListener("click", async () => {
  clear(pointMessage);

  const memberId = memberSelect.value;
  const change = parseInt(pointValueInput.value, 10);
  const note = pointNoteInput.value.trim();

  if (!memberId || !membersCache[memberId]) {
    show(pointMessage, "Member tidak valid.", false);
    return;
  }
  if (!change || change === 0) {
    show(pointMessage, "Point tidak boleh 0.", false);
    return;
  }
  if (!note) {
    show(pointMessage, "Catatan wajib diisi.", false);
    return;
  }

  addPointBtn.disabled = true;
  addPointBtn.textContent = "Menyimpan...";

  try {
    const m = membersCache[memberId];
    await update(ref(db, `members/${memberId}`), {
      points: (m.points || 0) + change,
      visits: (m.visits || 0) + (change > 0 ? 1 : 0)
    });

    await set(push(ref(db, "point_logs")), {
      memberId,
      memberName: m.name,
      change,
      note,
      createdAt: new Date().toISOString(),
      createdBy: currentAdminEmail
    });

    pointValueInput.value = "";
    pointNoteInput.value = "";
    show(pointMessage, "Point berhasil diperbarui.");
  } catch (err) {
    console.error(err);
    show(pointMessage, "Gagal update point.", false);
  } finally {
    addPointBtn.disabled = false;
    addPointBtn.textContent = "Simpan Perubahan Point";
  }
});

function loadLogs() {
  if (logsUnsub) logsUnsub();

  logsUnsub = onValue(
    query(ref(db, "point_logs"), limitToLast(20)),
    (snap) => {
      pointLogList.innerHTML = "";
      if (!snap.exists()) {
        pointLogList.innerHTML = `<p class="text-sm text-stone-500">Belum ada log.</p>`;
        return;
      }

      const rows = [];
      snap.forEach((c) => {
        const l = c.val();
        rows.push(
          `<div class="border rounded-xl p-3">
            <strong>${l.memberName}</strong> ${l.change > 0 ? "+" : ""}${l.change} pts<br/>
            <small>${l.note} — ${l.createdBy}</small>
          </div>`
        );
      });

      pointLogList.innerHTML = rows.reverse().join("");
    }
  );
}

function stopListeners() {
  if (membersUnsub) membersUnsub();
  if (logsUnsub) logsUnsub();
  membersUnsub = null;
  logsUnsub = null;
}
