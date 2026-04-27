import { auth, db } from "./firebase-config.js";import { auth, db.classList.add("hidden");
  statusBar.classList.add("hidden");
}

function setLoggedInUI(email) {
  loginSection.classList.add("hidden");
  adminSection.classList.remove("hidden");
  statusBar.classList.remove("hidden");
  adminEmailDisplay.textContent = email;
}

async function checkAdminAccess(user) {
  const snap = await get(ref(db, `admins/${user.uid}`));
  return snap.exists();
}

// ================= LOGIN =================
loginBtn.addEventListener("click", async () => {
  hideMsg(loginMessage);

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMsg(loginMessage, "Email dan password wajib diisi", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Memproses...";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const isAdmin = await checkAdminAccess(cred.user);

    if (!isAdmin) {
      await signOut(auth);
      showMsg(loginMessage, "Akun ini bukan admin", "error");
      return;
    }

    currentAdminEmail = cred.user.email;
    setLoggedInUI(currentAdminEmail);
    loadMembers();
  } catch (err) {
    console.error(err);
    showMsg(loginMessage, err.message, "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

// ================= MEMBERS =================
function loadMembers() {
  onValue(ref(db,"members"), snap => {
    membersCache = {};
    if (snap.exists()) {
      snap.forEach(ch => membersCache[ch.key] = ch.val());
    }
    console.log("✅ members loaded:", Object.keys(membersCache).length);
  });
}

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  suggestionsBox.innerHTML = "";

  if (!q) return;

  Object.entries(membersCache)
    .filter(([,m]) => (m.name||"").toLowerCase().includes(q))
    .slice(0,8)
    .forEach(([id,m]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-full text-left px-4 py-2 hover:bg-stone-50";
      btn.textContent = m.name;
      suggestionsBox.appendChild(btn);
    });
});

// ================= ADD MEMBER =================
addMemberBtn.addEventListener("click", async () => {
  hideMsg(memberMessage);

  const name = memberNameInput.value.trim();
  const phone = memberPhoneInput.value.trim();

  if (!name) {
    showMsg(memberMessage, "Nama wajib diisi", "error");
    return;
  }

  await set(push(ref(db,"members")), {
    name, phone,
    points:0, visits:0,
    createdAt: new Date().toISOString()
  });

  memberNameInput.value="";
  memberPhoneInput.value="";
  showMsg(memberMessage,"Member berhasil ditambahkan");
});

// ================= AUTH STATE =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setLoggedOutUI();
    return;
  }

  const ok = await checkAdminAccess(user);
  if (!ok) {
    await signOut(auth);
    setLoggedOutUI();
    return;
  }

  currentAdminEmail = user.email;
  setLoggedInUI(currentAdminEmail);
  loadMembers();
});
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

console.log("✅ admin.js loaded FINAL");

// ================= ELEMENTS =================
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

// ================= STATE =================
let currentAdminEmail = "";
let membersCache = {};

// ================= HELPERS =================
function showMsg(el, text, type="success") {
  el.textContent = text;
  el.classList.remove("hidden");
  el.classList.remove("text-red-600","text-emerald-700","text-stone-500");
  el.classList.add(
    type==="error" ? "text-red-600" :
    type==="neutral" ? "text-stone-500" :
    "text-emerald-700"
  );
}

function hideMsg(el) {
  el.textContent = "";
  el.classList.add("hidden");
}

function setLoggedOutUI() {
  loginSection.classList.remove("hidden");
