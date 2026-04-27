import { auth, db } from "./firebase-config.js";const detailTotalPoints = document.querySelectorAll("#detail-total-points");
const detailTotalVisits = document.querySelectorAll("#detail-total-visits");
const detailStatuses = document.querySelectorAll("#detail-status");

const addVisitBtns = document.querySelectorAll("#add-visit-btn");
const visitPointsInputs = document.querySelectorAll("#visit-points");
const visitNoteInputs = document.querySelectorAll("#visit-note");
const visitMessages = document.querySelectorAll("#visit-message");

const memberLogLists = document.querySelectorAll("#member-log-list");
const deleteMemberBtns = document.querySelectorAll("#delete-member-btn");

// ---- state ----
let currentAdminEmail = "";
let membersCache = {};
let selectedMemberId = null;
let selectedMemberLogs = [];
let unsubMembers = null;
let unsubLogs = null;

// ---- helpers UI ----
function showAll(nodes){ nodes.forEach(n => n?.classList?.remove("hidden")); }
function hideAll(nodes){ nodes.forEach(n => n?.classList?.add("hidden")); }
function setTextAll(nodes, t){ nodes.forEach(n => { if(n) n.textContent = t; }); }

function showMsg(nodes, text, type="success"){
  nodes.forEach(el=>{
    if(!el) return;
    el.textContent = text;
    el.classList.remove("hidden","text-red-600","text-emerald-700","text-stone-500");
    if(type==="success") el.classList.add("text-emerald-700");
    if(type==="error") el.classList.add("text-red-600");
    if(type==="neutral") el.classList.add("text-stone-500");
  });
}
function hideMsg(nodes){
  nodes.forEach(el=>{
    if(!el) return;
    el.textContent = "";
    el.classList.add("hidden");
  });
}

function normalizePoints(log){
  return Number(log?.points ?? log?.change ?? 0);
}
function formatDate(iso){
  try{ return new Date(iso).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}); }
  catch{ return iso || "-"; }
}

async function checkAdminAccess(user){
  const snap = await get(ref(db, `admins/${user.uid}`));
  return snap.exists();
}

function detachListeners(){
  if(typeof unsubMembers === "function") unsubMembers();
  if(typeof unsubLogs === "function") unsubLogs();
  unsubMembers = null;
  unsubLogs = null;
}

function setLoggedOutUI(){
  showAll(loginSections);
  hideAll(adminSections);
  hideAll(statusBars);
  setTextAll(adminEmailDisplays, "-");
  clearSelectedMemberUI();
}
function setLoggedInUI(email){
  hideAll(loginSections);
  showAll(adminSections);
  showAll(statusBars);
  setTextAll(adminEmailDisplays, email || "-");
}

function clearSelectedMemberUI(){
  selectedMemberId = null;
  selectedMemberLogs = [];
  hideAll(memberDetailSections);
  setTextAll(detailMemberNames, "-");
  setTextAll(detailMemberPhones, "-");
  setTextAll(detailTotalPoints, "0 pts");
  setTextAll(detailTotalVisits, "0 visit");
  setTextAll(detailStatuses, "Aktif");
  visitPointsInputs.forEach(i => i && (i.value=""));
  visitNoteInputs.forEach(i => i && (i.value=""));
  memberLogLists.forEach(l => l && (l.innerHTML=""));
}

function renderMemberDetail(member){
  if(!member) return clearSelectedMemberUI();
  showAll(memberDetailSections);
  setTextAll(detailMemberNames, member.name || "-");
  setTextAll(detailMemberPhones, member.phone || "-");
  setTextAll(detailTotalPoints, `${Number(member.points||0)} pts`);
  setTextAll(detailTotalVisits, `${Number(member.visits||0)} visit`);
  setTextAll(detailStatuses, member.active ? "Aktif" : "Nonaktif");
}

// ---- suggestions ----
function hideSuggestions(){
  suggestionBoxes.forEach(box=>{
    if(!box) return;
    box.innerHTML="";
    box.classList.add("hidden");
  });
}

function showSuggestionsFor(inputEl, items){
  // cari suggestionBox yang paling dekat dengan input yang diketik
  const wrapper = inputEl.closest(".relative");
  const box = wrapper?.querySelector("#member-suggestions") || suggestionBoxes[0];
  if(!box) return;

  if(!items.length){
    box.innerHTML="";
    box.classList.add("hidden");
    return;
  }

  box.innerHTML = items.map(({id, member}) => `
    <button type="button"
      class="w-full text-left px-4 py-3 text-sm hover:bg-stone-50 transition border-b border-stone-100 last:border-b-0"
      data-id="${id}">
      <div class="font-medium text-primary">${member.name || "Tanpa Nama"}</div>
      <div class="text-xs text-stone-500 mt-1">${member.phone || "-"}</div>
    </button>
  `).join("");

  box.classList.remove("hidden");

  box.querySelectorAll("button[data-id]").forEach(btn=>{
    btn.addEventListener("click", ()=> selectMember(btn.dataset.id));
  });
}

function filterMembers(keyword){
  const q = keyword.trim().toLowerCase();
  if(!q) return [];
  return Object.entries(membersCache)
    .filter(([,m]) => (m.name||"").toLowerCase().includes(q))
    .sort((a,b)=> (a[1].name||"").localeCompare(b[1].name||""))
    .slice(0,10)
    .map(([id,member])=>({id,member}));
}

// ---- load members (dengan error callback) ----
function loadMembers(){
  if(typeof unsubMembers === "function") unsubMembers();

  unsubMembers = onValue(
    ref(db,"members"),
    (snap)=>{
      membersCache = {};
      if(snap.exists()){
        snap.forEach(ch => { membersCache[ch.key] = ch.val() || {}; });
      }
      console.log("✅ members loaded:", Object.keys(membersCache).length);
    },
    (err)=>{
      console.error("members read error:", err);
      showMsg(searchMessages, "Gagal membaca data members (permission denied?). Cek Rules.", "error");
    }
  );
}

function loadLogsForMember(memberId){
  if(typeof unsubLogs === "function") unsubLogs();

  const qLogs = query(ref(db,"point_logs"), orderByChild("memberId"), equalTo(memberId));
  unsubLogs = onValue(qLogs, (snap)=>{
    const rows=[];
    if(snap.exists()){
      snap.forEach(ch => rows.push({id: ch.key, data: ch.val() || {}}));
    }
    rows.sort((a,b)=> new Date(b.data.createdAt||0) - new Date(a.data.createdAt||0));
    selectedMemberLogs = rows;

    memberLogLists.forEach(list=>{
      if(!list) return;
      if(!rows.length){
        list.innerHTML = `<div class="rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-sm text-stone-500">Belum ada riwayat visit.</div>`;
        return;
      }
      list.innerHTML = rows.map(({id,data})=>{
        const pts = normalizePoints(data);
        return `
          <div class="rounded-2xl border border-stone-200 px-4 py-4">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p class="font-medium text-primary">+${pts} pts</p>
                <p class="text-sm text-stone-500">${data.note || "Visit"}</p>
                <p class="text-xs text-stone-400 mt-1">${formatDate(data.createdAt)}</p>
              </div>
              <button type="button"
                class="delete-visit-btn rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
                data-log="${id}">
                Hapus Visit
              </button>
            </div>
          </div>`;
      }).join("");

      list.querySelectorAll(".delete-visit-btn").forEach(btn=>{
        btn.addEventListener("click", ()=> deleteVisit(btn.dataset.log));
      });
    });
  });
}

function selectMember(memberId){
  const member = membersCache[memberId];
  if(!member){
    showMsg(searchMessages,"Member tidak ditemukan.","error");
    return;
  }
  selectedMemberId = memberId;
  searchInputs.forEach(inp => inp && (inp.value = member.name || ""));
  hideSuggestions();
  hideMsg(searchMessages);
  renderMemberDetail(member);
  loadLogsForMember(memberId);
}

// ---- actions ----
async function addMember(name, phone){
  await set(push(ref(db,"members")), {
    name, phone,
    points: 0,
    visits: 0,
    active: true,
    createdAt: new Date().toISOString()
  });
}

async function addVisit(points, note){
  if(!selectedMemberId) throw new Error("Pilih member terlebih dahulu.");
  const member = membersCache[selectedMemberId];
  await set(push(ref(db,"point_logs")), {
    memberId: selectedMemberId,
    memberName: member.name || "-",
    points,
    note,
    createdAt: new Date().toISOString(),
    createdBy: currentAdminEmail || "-"
  });

  await update(ref(db, `members/${selectedMemberId}`), {
    points: Number(member.points||0) + points,
    visits: Number(member.visits||0) + 1
  });
}

async function deleteVisit(logId){
  const target = selectedMemberLogs.find(x=>x.id===logId);
  if(!target) return;
  const pts = normalizePoints(target.data);
  if(!confirm(`Hapus visit ini?\n${target.data.note||"-"}\n+${pts} pts`)) return;

  const member = membersCache[selectedMemberId];
  await remove(ref(db, `point_logs/${logId}`));
  await update(ref(db, `members/${selectedMemberId}`), {
    points: Math.max(0, Number(member.points||0)-pts),
    visits: Math.max(0, Number(member.visits||0)-1)
  });
  showMsg(visitMessages,"Visit berhasil dihapus.","success");
}

async function hardDeleteMember(){
  if(!selectedMemberId) return;
  const member = membersCache[selectedMemberId];
  if(!confirm(`HAPUS PERMANEN?\n${member.name}\n${member.points} pts / ${member.visits} visit`)) return;

  const qLogs = query(ref(db,"point_logs"), orderByChild("memberId"), equalTo(selectedMemberId));
  const snap = await get(qLogs);

  const tasks = [];
  if(snap.exists()) snap.forEach(ch => tasks.push(remove(ref(db, `point_logs/${ch.key}`))));
  tasks.push(remove(ref(db, `members/${selectedMemberId}`)));
  await Promise.all(tasks);

  clearSelectedMemberUI();
  searchInputs.forEach(inp => inp && (inp.value=""));
  hideSuggestions();
  showMsg(searchMessages,"Member dan semua visit berhasil dihapus.","success");
}

// ---- wire events ----
loginBtns.forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    hideMsg(loginMessages);

    const container = btn.closest("#login-section") || document;
    const emailEl = container.querySelector("#email") || document.querySelector("#email");
    const passEl  = container.querySelector("#password") || document.querySelector("#password");

    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    if(!email || !password){
      showMsg(loginMessages,"Email dan password wajib diisi.","error");
      return;
    }

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Memproses...";

    try{
      const cred = await signInWithEmailAndPassword(auth,email,password);
      const ok = await checkAdminAccess(cred.user);
      if(!ok){
        await signOut(auth);
        showMsg(loginMessages,"Akun ini bukan admin.","error");
        return;
      }
      currentAdminEmail = cred.user.email || "";
      setLoggedInUI(currentAdminEmail);
      loadMembers();
    }catch(e){
      console.error(e);
      showMsg(loginMessages, `Login gagal: ${e.code||e.message}`, "error");
    }finally{
      btn.disabled = false;
      btn.textContent = old;
    }
  });
});

logoutBtns.forEach(btn=>{
  btn.addEventListener("click", ()=> signOut(auth));
});

// Search event (untuk SEMUA input search)
searchInputs.forEach(inp=>{
  inp.addEventListener("input", ()=>{
    const keyword = inp.value.trim();
    if(!keyword){
      hideSuggestions();
      hideMsg(searchMessages);
      return;
    }

    const results = filterMembers(keyword);
    if(!results.length){
      showSuggestionsFor(inp, []);
      showMsg(searchMessages,"Tidak ada member yang cocok.","neutral");
      return;
    }
    hideMsg(searchMessages);
    showSuggestionsFor(inp, results);
  });
});

// click outside -> hide suggestions
document.addEventListener("click",(e)=>{
  const inside = [...searchInputs].some(inp => inp?.closest(".relative")?.contains(e.target));
  if(!inside) hideSuggestions();
});

// Add member
addMemberBtns.forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    hideMsg(memberMessages);
    const name = (memberNameInputs[0]?.value || "").trim();
    const phone = (memberPhoneInputs[0]?.value || "").trim();
    if(!name){
      showMsg(memberMessages,"Nama member wajib diisi.","error");
      return;
    }
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Menyimpan...";
    try{
      await addMember(name, phone);
      if(memberNameInputs[0]) memberNameInputs[0].value = "";
      if(memberPhoneInputs[0]) memberPhoneInputs[0].value = "";
      showMsg(memberMessages,"Member berhasil ditambahkan.","success");
    }catch(e){
      console.error(e);
      showMsg(memberMessages,"Gagal menambahkan member.","error");
    }finally{
      btn.disabled=false;
      btn.textContent=old;
    }
  });
});

// Add visit
addVisitBtns.forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    hideMsg(visitMessages);
    const points = parseInt(visitPointsInputs[0]?.value || "", 10);
    const note = (visitNoteInputs[0]?.value || "").trim();
    if(Number.isNaN(points) || points<=0){
      showMsg(visitMessages,"Point visit harus > 0.","error");
      return;
    }
    if(!note){
      showMsg(visitMessages,"Catatan wajib diisi.","error");
      return;
    }
    btn.disabled=true;
    const old=btn.textContent;
    btn.textContent="Menyimpan...";
    try{
      await addVisit(points, note);
      if(visitPointsInputs[0]) visitPointsInputs[0].value="";
      if(visitNoteInputs[0]) visitNoteInputs[0].value="";
      showMsg(visitMessages,"Visit berhasil ditambahkan.","success");
    }catch(e){
      console.error(e);
      showMsg(visitMessages,e.message || "Gagal tambah visit.","error");
    }finally{
      btn.disabled=false;
      btn.textContent=old;
    }
  });
});

// Delete member
deleteMemberBtns.forEach(btn=>{
  btn.addEventListener("click", hardDeleteMember);
});

// Auth state
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    currentAdminEmail="";
    detachListeners();
    setLoggedOutUI();
    return;
  }
  try{
    const ok = await checkAdminAccess(user);
    if(!ok){
      await signOut(auth);
      setLoggedOutUI();
      return;
    }
    currentAdminEmail = user.email || "";
    setLoggedInUI(currentAdminEmail);
    loadMembers();
  }catch(e){
    console.error(e);
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

console.log("✅ admin.js loaded", new Date().toISOString());

// ---- ambil elemen (pakai querySelectorAll supaya aman kalau ada duplikat) ----
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
