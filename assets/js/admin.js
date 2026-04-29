const API_URL = "https://script.google.com/macros/s/AKfycbwT_rKDh46m7hyl0wWlcN2TflR-2VoOjRsYpIZT51-jxodGTUJgNYYrCsG5QKGK5Q4cbw/exec";

const ADMIN_ID = localStorage.getItem("manupi_adminId");
const ADMIN_TOKEN = localStorage.getItem("manupi_adminToken");

let allMembers = [];
let selectedMemberId = null;

async function callApi(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, adminId: ADMIN_ID, token: ADMIN_TOKEN, ...payload })
    });
    return await response.json();
  } catch (error) { return { ok: false, error: "Koneksi gagal." }; }
}

async function refreshMemberList() {
  const res = await callApi("listMembers");
  if (res.ok) allMembers = res.data;
}

// --- HISTORY & EDIT ---
async function loadVisitHistory(memberId) {
  const logList = document.getElementById("member-log-list");
  if (!logList) return;
  logList.innerHTML = "<p class='text-xs text-stone-400 animate-pulse'>Memuat riwayat...</p>";
  
  const res = await callApi("listVisits", { memberId });
  if (res.ok && res.data.length > 0) {
    logList.innerHTML = res.data.map(v => `
      <div class="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100 mb-2 hover:border-primary transition cursor-pointer" 
           onclick="promptEditVisit('${v.visitId}', ${v.pointsAdded})">
        <div>
          <p class="text-xs font-bold text-primary">+${v.pointsAdded} Points</p>
          <p class="text-[10px] text-stone-400">${new Date(v.timestamp).toLocaleString('id-ID')}</p>
        </div>
        <div class="text-right">
          <span class="text-[9px] font-mono text-stone-300 block">${v.visitId}</span>
          <span class="text-[8px] text-primary italic">Klik untuk edit</span>
        </div>
      </div>
    `).join("");
  } else { logList.innerHTML = "<p class='text-xs text-stone-400 italic px-2'>Belum ada riwayat.</p>"; }
}

async function promptEditVisit(visitId, oldPoints) {
  const newPoints = prompt(`Edit Poin untuk transaksi ${visitId}:`, oldPoints);
  if (newPoints === null || newPoints === "" || isNaN(newPoints)) return;

  const res = await callApi("editVisit", { 
    payload: { visitId, memberId: selectedMemberId, newPoints: parseInt(newPoints) } 
  });

  if (res.ok) {
    await refreshMemberList();
    const updated = allMembers.find(m => m.memberId === selectedMemberId);
    if (updated) selectMember(updated);
  } else { alert(res.error); }
}

// --- PENCARIAN ---
const searchInput = document.getElementById("member-search");
const suggestionsEl = document.getElementById("member-suggestions");

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

// --- SIMPAN VISIT BARU ---
document.getElementById("add-visit-btn")?.addEventListener("click", async () => {
  const pointsInput = document.getElementById("visit-points");
  if (!selectedMemberId) return;
  const pts = parseInt(pointsInput.value);
  if (isNaN(pts) || pts <= 0) return;

  const res = await callApi("addVisit", { payload: { memberId: selectedMemberId, points: pts } });
  if (res.ok) {
    pointsInput.value = "";
    await refreshMemberList();
    const updated = allMembers.find(m => m.memberId === selectedMemberId);
    if (updated) selectMember(updated);
  }
});

// --- TAMBAH MEMBER ---
document.getElementById("add-member-btn")?.addEventListener("click", async () => {
  const nameEl = document.getElementById("member-name");
  const phoneEl = document.getElementById("member-phone");
  if (!nameEl.value || !phoneEl.value) return;
  const res = await callApi("addMember", { payload: { name: nameEl.value, phone: phoneEl.value } });
  if (res.ok) {
    nameEl.value = ""; phoneEl.value = "";
    await refreshMemberList();
    alert("Member berhasil didaftarkan!");
  } else { alert(res.error); }
});

// --- HAPUS MEMBER ---
document.getElementById("delete-member-btn")?.addEventListener("click", async () => {
  if (!selectedMemberId || !confirm("Hapus permanen?")) return;
  const res = await callApi("deleteMember", { memberId: selectedMemberId });
  if (res.ok) location.reload();
});

document.addEventListener("DOMContentLoaded", refreshMemberList);
