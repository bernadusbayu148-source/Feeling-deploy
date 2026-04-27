import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  ref,
  push,
  set,
  get,
  update,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const loginBtn = document.getElementById("login-btn");
const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");

loginBtn.addEventListener("click", async () => {
  const email = email.value;
  const password = password.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginSection.classList.add("hidden");
    adminSection.classList.remove("hidden");
    loadMembers();
  } catch (err) {
    alert("Login gagal");
  }
});

// ADD MEMBER
document.getElementById("add-member-btn").addEventListener("click", async () => {
  const name = document.getElementById("member-name").value;
  const phone = document.getElementById("member-phone").value;

  const memberRef = push(ref(db, "members"));
  await set(memberRef, {
    name,
    phone,
    points: 0,
    visits: 0,
    active: true,
    createdAt: new Date().toISOString()
  });

  loadMembers();
});

// LOAD MEMBERS
function loadMembers() {
  const list = document.getElementById("member-list");
  const select = document.getElementById("member-select");

  onValue(ref(db, "members"), (snap) => {
    list.innerHTML = "";
    select.innerHTML = "";

    snap.forEach((child) => {
      const m = child.val();
      const id = child.key;

      list.innerHTML += `<div>${m.name} — ${m.points} pts</div>`;
      select.innerHTML += `<option value="${id}">${m.name}</option>`;
    });
  });
}

// ADD POINT
document.getElementById("add-point-btn").addEventListener("click", async () => {
  const memberId = document.getElementById("member-select").value;
  const change = parseInt(document.getElementById("point-value").value);
  const note = document.getElementById("point-note").value;

  const memberRef = ref(db, `members/${memberId}`);
  const snap = await get(memberRef);
  const member = snap.val();

  await update(memberRef, {
    points: member.points + change,
    visits: member.visits + (change > 0 ? 1 : 0)
  });

  await push(ref(db, "point_logs"), {
    memberId,
    memberName: member.name,
    change,
    note,
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser.email
  });
});
