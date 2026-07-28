const API_URL = "https://script.google.com/macros/s/AKfycbxkZF_BzMKra69DLhr64DGwNw_YkT9pyWeflG_8GH1q4RA5pMgM127vMaP6fHMBATX9/exec";

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

// --- CALL API ---
async function callApi(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, adminId: ADMIN_ID, token: ADMIN_TOKEN, ...payload })
    });
    return await response.json();
  } catch (error) { return { ok: false, error: "Koneksi gagal." }; }
}

// --- LOGOUT ---
document.getElementById("logout-btn")?.addEventListener("click", () => { localStorage.clear(); window.location.href = "admin-login.html"; });

// --- FETCH & REFRESH MEMBERS ---
async function refreshMemberList() {
  const res = await callApi("listMembers");
  if (res.ok) allMembers = res.data;
}

// TOMBOL SINKRONISASI DATA MANUAL
document.getElementById("btn-refresh-data")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const icon = btn.querySelector('span');
  
  icon.classList.add('animate-spin');
  await refreshMemberList();
  icon.classList.remove('animate-spin');
  
  const searchInput = document.getElementById("member-search");
  const suggestionsEl = document.getElementById("member-suggestions");
  if (searchInput) searchInput.value = "";
  if (suggestionsEl) suggestionsEl.classList.add("hidden");
});

// --- LOAD RIWAYAT KUNJUNGAN ---
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

// --- EDIT VISIT ---
window.promptEditVisit = async function(visitId, oldPoints) {
  const newPoints = prompt(`Ubah poin (gunakan minus untuk redeem):`, oldPoints);
  if (newPoints === null || newPoints.trim() === "" || isNaN(newPoints)) return;
  toggleLoading(true);
  const res = await callApi("editVisit", { payload: { visitId, memberId: selectedMemberId, newPoints: parseInt(newPoints) } });
  toggleLoading(false);
  if (res.ok) { await refreshMemberList(); const updated = allMembers.find(m => m.memberId === selectedMemberId); if (updated) selectMember(updated); }
};

// --- TAMBAH VISIT (POIN) ---
document.getElementById("add-visit-btn")?.addEventListener("click", async () => {
  const pointsInput = document.getElementById("visit-points");
  const btn = document.getElementById("add-visit-btn");
  if (!selectedMemberId) return;

  let cleanVal = pointsInput.value.replace(/[^0-9-]/g, '');
  const pts = parseInt(cleanVal);
  if (isNaN(pts) || pts === 0) { alert("Masukkan angka valid!"); return; }

  const cur = allMembers.find(m => m.memberId === selectedMemberId);
  if (pts < 0 && Math.abs(pts) > cur.totalPoints) { alert("Poin tidak cukup!"); return; }

  toggleLoading(true, btn);
  const res = await callApi("addVisit", { memberId: selectedMemberId, payload: { memberId: selectedMemberId, points: pts, adminId: ADMIN_ID } });
  toggleLoading(false, btn);

  if (res.ok) { pointsInput.value = ""; await refreshMemberList(); const updated = allMembers.find(m => m.memberId === selectedMemberId); if (updated) selectMember(updated); }
});

// --- TAMBAH MEMBER MANUAL ---
document.getElementById("add-member-btn")?.addEventListener("click", async () => {
  const nameEl = document.getElementById("member-name"), phoneEl = document.getElementById("member-phone"), btn = document.getElementById("add-member-btn");
  if (!nameEl.value || !phoneEl.value) return;
  toggleLoading(true, btn);
  const res = await callApi("addMember", { payload: { name: nameEl.value, phone: phoneEl.value } });
  toggleLoading(false, btn);
  if (res.ok) { nameEl.value = ""; phoneEl.value = ""; await refreshMemberList(); alert("Member didaftarkan!"); } else { alert(res.error); }
});

// --- RESET SANDI (PIN) ---
document.getElementById("reset-pin-btn")?.addEventListener("click", async () => {
  if (!selectedMemberId) return;
  const confirmReset = confirm("Yakin ingin mereset Kata Sandi member ini? \n\nSetelah direset, beritahu member untuk membuat sandi baru melalui menu 'Klaim Akun Lama'.");
  
  if (confirmReset) {
    toggleLoading(true);
    const res = await callApi("resetPin", { payload: { memberId: selectedMemberId } });
    toggleLoading(false);
    
    if (res.ok) {
      alert("Kata Sandi berhasil direset! Silakan arahkan member untuk melakukan Klaim Akun.");
    } else {
      alert("Gagal mereset sandi: " + res.error);
    }
  }
});

// --- HAPUS MEMBER ---
document.getElementById("delete-member-btn")?.addEventListener("click", async () => {
  if (!selectedMemberId || !confirm("Hapus permanen?")) return;
  toggleLoading(true);
  const res = await callApi("deleteMember", { memberId: selectedMemberId });
  toggleLoading(false);
  if (res.ok) location.reload();
});

// --- PENCARIAN & SELEKSI ---
const searchInput = document.getElementById("member-search");
const suggestionsEl = document.getElementById("member-suggestions");

searchInput?.addEventListener("input", (e) => {
  const keyword = e.target.value.toLowerCase().trim();
  suggestionsEl.innerHTML = "";
  
  if (keyword.length < 1) { 
    suggestionsEl.classList.add("hidden"); 
    return; 
  }

  const filtered = allMembers.filter(m => {
    const safeName = m.name ? String(m.name).toLowerCase() : "";
    const safePhone = m.phone ? String(m.phone).toLowerCase() : "";
    const safeId = m.memberId ? String(m.memberId).toLowerCase() : "";
    return safeName.includes(keyword) || safePhone.includes(keyword) || safeId.includes(keyword);
  });

  if (filtered.length > 0) {
    filtered.slice(0, 15).forEach(m => {
      const div = document.createElement("div");
      div.className = "px-4 py-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0 text-sm flex justify-between items-center";
      
      // Menambahkan ikon kecil jika hari ini ultah (di dropdown pencarian)
      let bdayIcon = "";
      if (m.birthday) {
        const bDate = new Date(m.birthday);
        const today = new Date();
        if (bDate.getDate() === today.getDate() && bDate.getMonth() === today.getMonth()) {
          bdayIcon = `<span class="material-symbols-outlined text-amber-500 text-sm" title="Ulang Tahun Hari Ini!">cake</span>`;
        }
      }

      div.innerHTML = `
        <div>
          <p class="font-bold text-primary">${m.name || 'Tanpa Nama'}</p>
          <p class="text-[10px] text-stone-400">${m.memberId} • ${m.phone}</p>
        </div>
        ${bdayIcon}
      `;
      div.onclick = () => selectMember(m);
      suggestionsEl.appendChild(div);
    });
    suggestionsEl.classList.remove("hidden");
  } else { 
    suggestionsEl.classList.add("hidden"); 
  }
});

// --- TAMPILKAN DETAIL MEMBER & LOGIKA ULANG TAHUN ---
function selectMember(member) {
  selectedMemberId = member.memberId;
  searchInput.value = member.name || member.memberId;
  suggestionsEl.classList.add("hidden");
  
  document.getElementById("member-detail-section").classList.remove("hidden");
  document.getElementById("detail-member-name").textContent = member.name || "Tanpa Nama";
  document.getElementById("detail-member-phone").textContent = member.phone || "-";
  document.getElementById("detail-total-points").textContent = `${member.totalPoints} pts`;
  document.getElementById("detail-total-visits").textContent = `${member.totalVisits} visit`;

  // Logika Menampilkan Ulang Tahun
  const bdayEl = document.getElementById("detail-member-birthday");
  const bdayText = document.getElementById("bday-text");
  const bdayBadge = document.getElementById("badge-birthday");
  
  // Sembunyikan by default
  bdayEl.classList.add("hidden");
  bdayBadge.classList.add("hidden");

  if (member.birthday) {
    const bDate = new Date(member.birthday);
    bdayText.textContent = bDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
    bdayEl.classList.remove("hidden"); // Tampilkan teks tanggal lahir
    
    // Cek apakah hari ini
    const today = new Date();
    if (bDate.getDate() === today.getDate() && bDate.getMonth() === today.getMonth()) {
       bdayBadge.classList.remove("hidden"); // Tampilkan Lencana!
    }
  }
  
  loadVisitHistory(member.memberId);
}

// FETCH DATA PERTAMA KALI SAAT HALAMAN DIMUAT
document.addEventListener("DOMContentLoaded", refreshMemberList);

// =========================================================
// QR SCANNER
// =========================================================
let html5QrCode = null;
const btnOpenScanner = document.getElementById('btn-open-scanner');
const btnCloseScanner = document.getElementById('btn-close-scanner');
const modalScanner = document.getElementById('modal-scanner');

if (btnOpenScanner && modalScanner) {
  btnOpenScanner.addEventListener('click', () => {
    modalScanner.classList.remove('hidden');
    setTimeout(() => {
      if (!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        onScanSuccess,
        onScanFailure
      ).catch((err) => { alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan."); });
    }, 300);
  });
}

if (btnCloseScanner && modalScanner) {
  btnCloseScanner.addEventListener('click', () => {
    modalScanner.classList.add('hidden');
    if (html5QrCode) {
      html5QrCode.stop().then(() => html5QrCode.clear()).catch(err => console.log(err));
    }
  });
}

function onScanSuccess(decodedText) {
  modalScanner.classList.add('hidden');
  if (html5QrCode) {
    html5QrCode.stop().then(() => html5QrCode.clear()).catch(err => console.log(err));
  }
  if (searchInput) {
    searchInput.value = decodedText;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    const foundMember = allMembers.find(m => m.memberId.toLowerCase() === decodedText.toLowerCase().trim());
    if (foundMember) selectMember(foundMember);
  }
}
function onScanFailure() {}
