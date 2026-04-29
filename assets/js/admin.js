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
    console.error("API Error:", error);
    return { ok: false, error: "Gagal terhubung ke server." };
  }
}

// --- 2. REFRESH DATA DARI SPREADSHEET ---
async function refreshMemberList() {
  console.log("Mengambil data member terbaru...");
  const res = await callApi("listMembers");
  if (res.ok) {
    allMembers = res.data;
    console.log("Data berhasil dimuat:", allMembers.length, "member");
  } else {
    console.error("Gagal memuat member:", res.error);
  }
}

// --- 3. LOGIKA PENCARIAN (FIXED) ---
const searchInput = document.getElementById("member-search");
const suggestionsEl = document.getElementById("member-suggestions");

searchInput?.addEventListener("input", (e) => {
  const keyword = e.target.value.toLowerCase().trim();
  suggestionsEl.innerHTML = "";

  if (keyword.length < 1) {
    suggestionsEl.classList.add("hidden");
    return;
  }

  // Filter mencakup Nama, No HP, dan Member ID
  const filtered = allMembers.filter(m => {
    const nameMatch = m.name.toLowerCase().includes(keyword);
    const phoneMatch = String(m.phone).includes(keyword);
    const idMatch = m.memberId.toLowerCase().includes(keyword);
    return nameMatch || phoneMatch || idMatch;
  });

  if (filtered.length > 0) {
    filtered.slice(0, 8).forEach(m => {
      const div = document.createElement("div");
      div.className = "px-4 py-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0 text-sm";
      div.innerHTML = `
        <p class="font-bold text-primary">${m.name}</p>
        <p class="text-[10px] text-stone-400 uppercase tracking-wider">${m.memberId} • ${m.phone}</p>
      `;
      div.onclick = () => selectMember(m);
      suggestionsEl.appendChild(div);
    });
    suggestionsEl.classList.remove("hidden");
  } else {
    const noResult = document.createElement("div");
    noResult.className = "px-4 py-3 text-xs text-stone-400 italic";
    noResult.textContent = "Member tidak ditemukan...";
    suggestionsEl.appendChild(noResult);
    suggestionsEl.classList.remove("hidden");
  }
});

// --- 4. SELECT MEMBER & DETAIL ---
function selectMember(member) {
  selectedMemberId = member.memberId;
  searchInput.value = member.name;
  suggestionsEl.classList.add("hidden");

  // Tampilkan UI Detail
  document.getElementById("member-detail-section").classList.remove("hidden");
  document.getElementById("detail-member-name").textContent = member.name;
  document.getElementById("detail-member-phone").textContent = member.phone;
  document.getElementById("detail-total-points").textContent = `${member.totalPoints} pts`;
  document.getElementById("detail-total-visits").textContent = `${member.totalVisits} visit`;

  // Scroll otomatis ke detail agar admin tahu data sudah terpilih
  document.getElementById("member-detail-section").scrollIntoView({ behavior: 'smooth' });
}

// --- 5. SIMPAN VISIT ---
document.getElementById("add-visit-btn")?.addEventListener("click", async () => {
  const pointsInput = document.getElementById("visit-points");
  const btn = document.getElementById("add-visit-btn");

  if (!selectedMemberId) { alert("Pilih member dulu!"); return; }
  const pts = parseInt(pointsInput.value);
  if (isNaN(pts) || pts <= 0) { alert("Masukkan poin!"); return; }

  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  const res = await callApi("addVisit", { payload: { memberId: selectedMemberId, points: pts } });
  
  if (res.ok) {
    showStatus("visit-message", "Poin berhasil ditambahkan!", false);
    pointsInput.value = "";
    // Update data di memori
    await refreshMemberList();
    // Update tampilan detail
    const updated = allMembers.find(m => m.memberId === selectedMemberId);
    if (updated) selectMember(updated);
  } else {
    showStatus("visit-message", res.error, true);
  }
  btn.disabled = false;
  btn.textContent = "Simpan Visit";
});

// --- 6. TAMBAH MEMBER ---
document.getElementById("add-member-btn")?.addEventListener("click", async () => {
  const nameEl = document.getElementById("member-name");
  const phoneEl = document.getElementById("member-phone");
  const btn = document.getElementById("add-member-btn");

  if (!nameEl.value || !phoneEl.value) {
    showStatus("member-message", "Nama & WA wajib diisi!", true);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Sedang mendaftarkan...";

  const res = await callApi("addMember", { 
    payload: { name: nameEl.value, phone: phoneEl.value } 
  });

  if (res.ok) {
    showStatus("member-message", `Berhasil! ID: ${res.data.memberId}`, false);
    nameEl.value = ""; phoneEl.value = "";
    await refreshMemberList(); // Penting: agar member baru langsung bisa dicari
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

// Inisialisasi awal saat halaman dibuka
document.addEventListener("DOMContentLoaded", refreshMemberList);

document.getElementById("logout-btn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "admin-login.html";
});
