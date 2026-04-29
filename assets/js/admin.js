const API_URL = "https://script.google.com/macros/s/AKfycbwT_rKDh46m7hyl0wWlcN2TflR-2VoOjRsYpIZT51-jxodGTUJgNYYrCsG5QKGK5Q4cbw/exec";

const ADMIN_ID = localStorage.getItem("manupi_adminId");
const ADMIN_TOKEN = localStorage.getItem("manupi_adminToken");

let allMembers = [];
let selectedMemberId = null;

// --- LOADING UI ---
function toggleLoading(isLoading, btn) {
  const overlay = document.getElementById("global-loading");
  if (isLoading) {
    if(btn) { btn.disabled = true; btn.dataset.txt = btn.innerHTML; btn.innerHTML = "Memproses..."; }
    overlay?.classList.remove("hidden");
  } else {
    if(btn) { btn.disabled = false; btn.innerHTML = btn.dataset.txt || btn.innerHTML; }
    overlay?.classList.add("hidden");
  }
}

async function callApi(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, adminId: ADMIN_ID, token: ADMIN_TOKEN, ...payload })
    });
    return await response.json();
  } catch (error) { return { ok: false, error: "Koneksi gagal." }; }
}

document.getElementById("logout-btn")?.addEventListener("click", () => { localStorage.clear(); window.location.href = "admin-login.html"; });

async function refreshMemberList() {
  const res = await callApi("listMembers");
  if (res.ok) allMembers = res.data;
}

async function loadVisitHistory(memberId) {
  const logList = document.getElementById("member-log-list");
  if (!logList) return;
  logList.innerHTML = "<p class='text-xs p-4 text-center animate-pulse'>Memuat riwayat...</p>";
  const res = await callApi("listVisits", { memberId });
  if (res.ok && res.data.length > 0) {
    logList.innerHTML = res.data.map(v => {
      const isMinus = v.pointsAdded < 0;
      return `
      <div class="flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-100 mb-3 shadow-sm transition hover:border-primary">
        <div>
          <p class="text-sm font-bold ${isMinus ? 'text-red-500' : 'text-primary'}">${isMinus ? '' : '+'}${v.pointsAdded} Points</p>
          <p class="text-[11px] text-stone-400 font-medium">${new Date(v.timestamp).toLocaleString('id-ID')}</p>
          <span class="text-[9px] font-mono text-stone-300 block mt-1">${v.visitId}</span>
        </div>
        <button onclick="window.promptEditVisit('${v.visitId}', ${v.pointsAdded})" class="px-3 py-1.5 bg-stone-100 text-primary text-[10px] font-bold rounded-xl hover:bg-primary hover:text-white transition uppercase tracking-wider">Edit</button>
      </div>`;
    }).join("");
  } else { logList.innerHTML = "<p class='text-sm text-stone-400 italic p-4 text-center'>Belum ada riwayat.</p>"; }
}

window.promptEditVisit = async function(visitId, oldPoints) {
  const newPoints = prompt(`Ubah poin (gunakan minus untuk redeem):`, oldPoints);
  if (newPoints === null || newPoints.trim() === "" || isNaN(newPoints)) return;
  toggleLoading(true);
  const res = await callApi("editVisit", { payload: { visitId, memberId: selectedMemberId, newPoints: parseInt(newPoints) } });
  toggleLoading(false);
  if (res.ok) { await refreshMemberList(); const updated = allMembers.find(m => m.memberId === selectedMemberId); if (updated) selectMember(updated); }
};

// --- TAMBAH VISIT & REDEEM ---
document.getElementById("add-visit-btn")?.addEventListener("click", async () => {
  const pointsInput = document.getElementById("visit-points");
  const btn = document.getElementById("add-visit-btn");
  if (!selectedMemberId) return;

  // Pembersihan Input Teks agar hanya angka & minus
  let cleanVal = pointsInput.value.replace(/[^0-9-]/g, '');
  const pts = parseInt(cleanVal);
  if (isNaN(pts) || pts === 0) { alert("Masukkan angka valid!"); return; }

  const cur = allMembers.find(m => m.memberId === selectedMemberId);
  if (pts < 0 && Math.abs(pts) > cur.totalPoints) { alert("Poin tidak cukup!"); return; }

  toggleLoading(true, btn);
  const res = await callApi("addVisit", { memberId: selectedMemberId, payload: { memberId: selectedMemberId, points: pts, adminId: ADMIN_ID } });
  toggleLoading(false, btn);

  if (res.ok) { pointsInput.value = "1"; await refreshMemberList(); const updated = allMembers.find(m => m.memberId === selectedMemberId); if (updated) selectMember(updated); }
});

// --- TAMBAH MEMBER ---
document.getElementById("add-member-btn")?.addEventListener("click", async () => {
  const nameEl = document.getElementById("member-name"), phoneEl = document.getElementById("member-phone"), btn = document.getElementById("add-member-btn");
  if (!nameEl.value || !phoneEl.value) return;
  toggleLoading(true, btn);
  const res = await callApi("addMember", { payload: { name: nameEl.value, phone: phoneEl.value } });
  toggleLoading(false, btn);
  if (res.ok) { nameEl.value = ""; phoneEl.value = ""; await refreshMemberList(); alert("Member didaftarkan!"); } else { alert(res.error); }
});

// --- PENCARIAN & SELEKSI ---
const searchInput = document.getElementById("member-search"), suggestionsEl = document.getElementById("member-suggestions");
searchInput?.addEventListener("input", (e) => {
  const keyword = e.target.value.toLowerCase().trim();
  suggestionsEl.innerHTML = "";
  if (keyword.length < 1) { suggestionsEl.classList.add("hidden"); return; }
  const filtered = allMembers.filter(m => m.name.toLowerCase().includes(keyword) || String(m.phone).includes(keyword) || m.memberId.toLowerCase().includes(keyword));
  if (filtered.length > 0) {
    filtered.slice(0, 5).forEach(m => {
      const div = document.createElement("div");
      div.className = "px-4 py-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0 text-sm";
      div.innerHTML = `<p class="font-bold text-primary">${m.name}</p><p class="text-[10px] text-stone-400">${m.memberId} • ${m.phone}</p>`;
      div.onclick = () => selectMember(m);
      suggestionsEl.appendChild(div);
    });
    suggestionsEl.classList.remove("hidden");
  } else { suggestionsEl.classList.add("hidden"); }
});

function selectMember(member) {
  selectedMemberId = member.memberId;
  searchInput.value = member.name;
  suggestionsEl.classList.add("hidden");
  document.getElementById("member-detail-section").classList.remove("hidden");
  document.getElementById("detail-member-name").textContent = member.name;
  document.getElementById("detail-member-phone").textContent = member.phone;
  document.getElementById("detail-total-points").textContent = `${member.totalPoints} pts`;
  document.getElementById("detail-total-visits").textContent = `${member.totalVisits} visit`;
  loadVisitHistory(member.memberId);
}

document.getElementById("delete-member-btn")?.addEventListener("click", async () => {
  if (!selectedMemberId || !confirm("Hapus permanen?")) return;
  toggleLoading(true);
  const res = await callApi("deleteMember", { memberId: selectedMemberId });
  toggleLoading(false);
  if (res.ok) location.reload();
});

document.addEventListener("DOMContentLoaded", refreshMemberList);
