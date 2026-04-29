const API_URL = "https://script.google.com/macros/s/AKfycbwT_rKDh46m7hyl0wWlcN2TflR-2VoOjRsYpIZT51-jxodGTUJgNYYrCsG5QKGK5Q4cbw/exec";

const ADMIN_ID = localStorage.getItem("manupi_adminId");
const ADMIN_TOKEN = localStorage.getItem("manupi_adminToken");

let allMembers = [];
// Variabel global untuk menyimpan ID member yang sedang dipilih
let selectedMemberId = null;

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

async function refreshMemberList() {
  const res = await callApi("listMembers");
  if (res.ok) {
    allMembers = res.data;
  }
}

// --- LOGIKA PENCARIAN ---
const searchInput = document.getElementById("member-search");
const suggestionsEl = document.getElementById("member-suggestions");

searchInput?.addEventListener("input", (e) => {
  const keyword = e.target.value.toLowerCase().trim();
  suggestionsEl.innerHTML = "";

  if (keyword.length < 2) {
    suggestionsEl.classList.add("hidden");
    return;
  }

  const filtered = allMembers.filter(m => 
    m.name.toLowerCase().includes(keyword) || 
    String(m.phone).includes(keyword) ||
    m.memberId.toLowerCase().includes(keyword)
  );

  if (filtered.length > 0) {
    filtered.slice(0, 5).forEach(m => {
      const div = document.createElement("div");
      div.className = "px-4 py-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0 transition";
      div.innerHTML = `
        <p class="font-bold text-primary text-sm">${m.name}</p>
        <p class="text-[10px] text-stone-400 uppercase tracking-wider">${m.memberId} • ${m.phone}</p>
      `;
      div.onclick = () => selectMember(m);
      suggestionsEl.appendChild(div);
    });
    suggestionsEl.classList.remove("hidden");
  } else {
    suggestionsEl.classList.add("hidden");
  }
});

function selectMember(member) {
  searchInput.value = member.name;
  suggestionsEl.classList.add("hidden");
  
  // Simpan ID member ke variabel global
  selectedMemberId = member.memberId;
  
  // Tampilkan Detail
  const detailSec = document.getElementById("member-detail-section");
  detailSec.classList.remove("hidden");
  
  document.getElementById("detail-member-name").textContent = member.name;
  document.getElementById("detail-member-phone").textContent = member.phone;
  document.getElementById("detail-total-points").textContent = `${member.totalPoints} pts`;
  document.getElementById("detail-total-visits").textContent = `${member.totalVisits} visit`;
}

// --- LOGIKA TAMBAH POINT ---
document.getElementById("add-visit-btn")?.addEventListener("click", async () => {
  const pointsInput = document.getElementById("points-to-add");
  const btn = document.getElementById("add-visit-btn");

  if (!selectedMemberId) {
    alert("Silakan cari dan pilih member terlebih dahulu!");
    return;
  }

  const points = parseInt(pointsInput.value);
  if (isNaN(points) || points <= 0) {
    alert("Masukkan jumlah point yang valid!");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Memproses...";

  const res = await callApi("addVisit", { 
    payload: { memberId: selectedMemberId, points: points } 
  });

  if (res.ok) {
    alert("Point berhasil ditambahkan!");
    pointsInput.value = "1"; // Reset input
    
    // Refresh data agar angka di layar terupdate
    await refreshMemberList();
    
    // Update tampilan detail dengan data terbaru
    const updatedMember = allMembers.find(m => m.memberId === selectedMemberId);
    if (updatedMember) selectMember(updatedMember);
  } else {
    alert("Gagal menambah point: " + res.error);
  }

  btn.disabled = false;
  btn.textContent = "Tambah Point";
});

// --- SISTEM PENDAFTARAN ---
document.getElementById("add-member-btn")?.addEventListener("click", async () => {
  const nameEl = document.getElementById("member-name");
  const phoneEl = document.getElementById("member-phone");
  const btn = document.getElementById("add-member-btn");

  if (!nameEl.value || !phoneEl.value) {
    showStatus("member-message", "Nama dan Nomor wajib diisi!", true);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  const res = await callApi("addMember", { 
    payload: { name: nameEl.value, phone: phoneEl.value } 
  });

  if (res.ok) {
    showStatus("member-message", `Berhasil! ID: ${res.data.memberId}`, false);
    nameEl.value = "";
    phoneEl.value = "";
    await refreshMemberList();
  } else {
    showStatus("member-message", res.error, true);
  }

  btn.disabled = false;
  btn.textContent = "Simpan Member";
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

document.addEventListener("DOMContentLoaded", refreshMemberList);
