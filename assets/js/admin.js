const API_URL = "https://script.google.com/macros/s/AKfycbwT_rKDh46m7hyl0wWlcN2TflR-2VoOjRsYpIZT51-jxodGTUJgNYYrCsG5QKGK5Q4cbw/exec";

const ADMIN_ID = localStorage.getItem("manupi_adminId");
const ADMIN_TOKEN = localStorage.getItem("manupi_adminToken");

let allMembers = [];
let selectedMemberId = null;

// --- 1. CORE API CALL ---
async function callApi(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, adminId: ADMIN_ID, token: ADMIN_TOKEN, ...payload })
    });
    return await response.json();
  } catch (error) {
    return { ok: false, error: "Gagal terhubung ke server." };
  }
}

// --- 2. INITIALIZATION & REFRESH ---
async function init() {
  const res = await callApi("listMembers");
  if (res.ok) {
    allMembers = res.data;
  }
}

// --- 3. SEARCH LOGIC ---
const searchInput = document.getElementById("member-search");
const suggestionsEl = document.getElementById("member-suggestions");

searchInput?.addEventListener("input", (e) => {
  const keyword = e.target.value.toLowerCase().trim();
  suggestionsEl.innerHTML = "";
  if (keyword.length < 2) { suggestionsEl.classList.add("hidden"); return; }

  const filtered = allMembers.filter(m => 
    m.name.toLowerCase().includes(keyword) || m.phone.includes(keyword) || m.memberId.toLowerCase().includes(keyword)
  );

  if (filtered.length > 0) {
    filtered.slice(0, 5).forEach(m => {
      const div = document.createElement("div");
      div.className = "px-4 py-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0 text-sm";
      div.innerHTML = `<p class="font-bold text-primary">${m.name}</p><p class="text-[10px] text-stone-400">${m.memberId} • ${m.phone}</p>`;
      div.onclick = () => selectMember(m);
      suggestionsEl.appendChild(div);
    });
    suggestionsEl.classList.remove("hidden");
  } else {
    suggestionsEl.classList.add("hidden");
  }
});

// --- 4. SELECT MEMBER & LOAD VISITS ---
async function selectMember(member) {
  selectedMemberId = member.memberId;
  searchInput.value = member.name;
  suggestionsEl.classList.add("hidden");

  // Update UI Detail
  document.getElementById("member-detail-section").classList.remove("hidden");
  document.getElementById("detail-member-name").textContent = member.name;
  document.getElementById("detail-member-phone").textContent = member.phone;
  document.getElementById("detail-total-points").textContent = `${member.totalPoints} pts`;
  document.getElementById("detail-total-visits").textContent = `${member.totalVisits} visit`;

  // Load Visit History
  loadVisitHistory(member.memberId);
}

async function loadVisitHistory(memberId) {
  const logList = document.getElementById("member-log-list");
  logList.innerHTML = "<p class='text-xs text-stone-400 animate-pulse'>Memuat riwayat...</p>";
  
  const res = await callApi("listVisits", { memberId });
  if (res.ok && res.data.length > 0) {
    logList.innerHTML = res.data.map(v => `
      <div class="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
        <div>
          <p class="text-xs font-bold text-primary">${v.pointsAdded} Points</p>
          <p class="text-[10px] text-stone-400">${new Date(v.timestamp).toLocaleString('id-ID')}</p>
        </div>
        <span class="text-[9px] font-mono text-stone-300">${v.visitId}</span>
      </div>
    `).join("");
  } else {
    logList.innerHTML = "<p class='text-xs text-stone-400 italic'>Belum ada riwayat kunjungan.</p>";
  }
}

// --- 5. FUNGSI SIMPAN VISIT ---
document.getElementById("add-visit-btn")?.addEventListener("click", async () => {
  const pointsInput = document.getElementById("visit-points");
  const btn = document.getElementById("add-visit-btn");
  const msg = document.getElementById("visit-message");

  if (!selectedMemberId) { alert("Pilih member dulu!"); return; }
  const pts = parseInt(pointsInput.value);
  if (isNaN(pts) || pts <= 0) { alert("Masukkan poin valid!"); return; }

  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  const res = await callApi("addVisit", { payload: { memberId: selectedMemberId, points: pts } });
  
  if (res.ok) {
    showStatus("visit-message", "Visit berhasil disimpan!", false);
    pointsInput.value = "";
    // Refresh data member & log
    await init();
    const updated = allMembers.find(m => m.memberId === selectedMemberId);
    if (updated) selectMember(updated);
  } else {
    showStatus("visit-message", res.error, true);
  }
  btn.disabled = false;
  btn.textContent = "Simpan Visit";
});

// --- 6. FUNGSI TAMBAH MEMBER ---
document.getElementById("add-member-btn")?.addEventListener("click", async () => {
  const nameEl = document.getElementById("member-name");
  const phoneEl = document.getElementById("member-phone");
  const btn = document.getElementById("add-member-btn");

  if (!nameEl.value || !phoneEl.value) { showStatus("member-message", "Data tidak lengkap!", true); return; }

  btn.disabled = true;
  const res = await callApi("addMember", { payload: { name: nameEl.value, phone: phoneEl.value } });

  if (res.ok) {
    showStatus("member-message", `Berhasil! ID: ${res.data.memberId}`, false);
    nameEl.value = ""; phoneEl.value = "";
    await init();
  } else {
    showStatus("member-message", res.error, true);
  }
  btn.disabled = false;
});

// --- 7. FUNGSI HAPUS MEMBER ---
document.getElementById("delete-member-btn")?.addEventListener("click", async () => {
  if (!selectedMemberId) return;
  if (!confirm("Hapus member ini secara permanen? Data point & riwayat akan hilang.")) return;

  const res = await callApi("deleteMember", { memberId: selectedMemberId });
  if (res.ok) {
    alert("Member berhasil dihapus.");
    location.reload();
  } else {
    alert(res.error);
  }
});

function showStatus(elId, message, isError = false) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden", "text-red-600", "text-emerald-600");
  el.classList.add(isError ? "text-red-600" : "text-emerald-600");
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

document.addEventListener("DOMContentLoaded", init);

document.getElementById("logout-btn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "admin-login.html";
});
