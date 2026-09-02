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

// --- LOAD RIWAYAT KUNJUNGAN & KUNCI TOMBOL KLAIM ---
async function loadVisitHistory(memberId) {
  const logList = document.getElementById("member-log-list");
  if (!logList) return;
  logList.innerHTML = "<p class='text-xs p-4 text-center animate-pulse'>Memuat riwayat...</p>";
  const res = await callApi("listVisits", { memberId });
  
  let claimedLevels = []; // Menyimpan level yang sudah diklaim sebagai angka
  
  if (res.ok && res.data.length > 0) {
    logList.innerHTML = res.data.map(v => {
      const isMinus = v.pointsAdded < 0;
      
      // Jika ini adalah transaksi klaim (ada text note)
      if (v.note && v.note.startsWith("Claim reward level")) {
        const lvlStr = v.note.replace("Claim reward level ", "").trim();
        const lvlInt = parseInt(lvlStr, 10);
        if (!isNaN(lvlInt)) claimedLevels.push(lvlInt); // Catat angka levelnya
      }
      
      // Tampilan nama riwayat
      const displayTitle = v.note ? `<span class="text-amber-600 font-bold"><span class="material-symbols-outlined text-[12px] align-middle mr-1">star</span>${v.note}</span>` : `${isMinus ? '' : '+'}${v.pointsAdded} Points`;
      
      return `
      <div class="flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-100 mb-3 shadow-sm transition hover:border-primary">
        <div>
          <p class="text-sm font-bold ${isMinus ? 'text-red-500' : 'text-primary'}">${displayTitle}</p>
          <p class="text-[11px] text-stone-400 font-medium">${new Date(v.timestamp).toLocaleString('id-ID')}</p>
          <span class="text-[9px] font-mono text-stone-300 block mt-1">${v.visitId}</span>
        </div>
        <button onclick="window.promptEditVisit('${v.visitId}', ${v.pointsAdded})" class="px-3 py-1.5 bg-stone-100 text-primary text-[10px] font-bold rounded-xl hover:bg-primary hover:text-white transition uppercase tracking-wider">Edit</button>
      </div>`;
    }).join("");
  } else { logList.innerHTML = "<p class='text-sm text-stone-400 italic p-4 text-center'>Belum ada riwayat.</p>"; }
  
  // LOGIKA PENGUNCIAN TOMBOL (Mencari Level Tertinggi)
  const maxClaimedLevel = claimedLevels.length > 0 ? Math.max(...claimedLevels) : 0;
  
  const claimBtns = document.querySelectorAll('.claim-lvl-btn');
  const curMember = allMembers.find(m => m.memberId === memberId);
  const curPts = curMember ? curMember.totalPoints : 0;
  
  claimBtns.forEach(btn => {
     const lvl = parseInt(btn.getAttribute('data-level'), 10);
     const minPts = parseInt(btn.getAttribute('data-min'), 10);
     
     // Skenario 1: Level ini atau level di bawahnya sudah hangus karena ada klaim level lebih tinggi
     if (lvl <= maxClaimedLevel) {
         btn.disabled = true;
         btn.className = "claim-lvl-btn w-full rounded-xl bg-stone-200 px-4 py-3 text-sm font-semibold text-stone-500 transition shadow-sm flex justify-between items-center cursor-not-allowed border border-stone-300";
         btn.innerHTML = `<span>Level ${lvl}</span> <span class="text-[10px] bg-stone-300 px-2 py-1 rounded-md uppercase tracking-widest text-stone-600"><span class="material-symbols-outlined text-[10px] align-middle mr-0.5">check_circle</span>Selesai</span>`;
     } 
     // Skenario 2: Poin belum mencukupi
     else if (curPts < minPts) {
         btn.disabled = true;
         btn.className = "claim-lvl-btn w-full rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-400 transition shadow-sm flex justify-between items-center cursor-not-allowed border border-amber-200";
         btn.innerHTML = `<span>Level ${lvl}</span> <span class="text-[10px] bg-amber-200 px-2 py-1 rounded-md uppercase tracking-widest text-amber-500"><span class="material-symbols-outlined text-[10px] align-middle mr-0.5">lock</span>Min. ${minPts} pts</span>`;
     } 
     // Skenario 3: Siap Diklaim
     else {
         btn.disabled = false;
         btn.className = "claim-lvl-btn w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition shadow-sm flex justify-between items-center cursor-pointer";
         btn.innerHTML = `<span>Level ${lvl}</span> <span class="text-[10px] bg-amber-600 px-2 py-1 rounded-md uppercase tracking-widest">Klaim Sekarang</span>`;
     }
  });
}

// --- AKSI KLAIM LEVEL ---
document.querySelectorAll('.claim-lvl-btn').forEach(btn => {
   btn.addEventListener('click', async (e) => {
       const lvl = e.currentTarget.getAttribute('data-level');
       if (!confirm(`Tindak Lanjut Klaim: \n\nYakin memproses klaim Reward untuk Level ${lvl}?\n(Poin utama Kerabat tidak akan berkurang).`)) return;
       
       toggleLoading(true, e.currentTarget);
       const res = await callApi("addVisit", { 
           memberId: selectedMemberId, 
           payload: { 
               memberId: selectedMemberId, 
               points: 0, 
               note: `Claim reward level ${lvl}`,
               adminId: ADMIN_ID 
           } 
       });
       toggleLoading(false, e.currentTarget);
       
       if (res.ok) { 
           alert(`Klaim Level ${lvl} berhasil dicatat!`);
           await refreshMemberList(); 
           const updated = allMembers.find(m => m.memberId === selectedMemberId); 
           if (updated) selectMember(updated); 
       } else {
           alert("Gagal memproses klaim: " + res.error);
       }
   });
});

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
  
  bdayEl.classList.add("hidden");
  bdayBadge.classList.add("hidden");

  if (member.birthday) {
    const bDate = new Date(member.birthday);
    bdayText.textContent = bDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
    bdayEl.classList.remove("hidden"); 
    
    const today = new Date();
    if (bDate.getDate() === today.getDate() && bDate.getMonth() === today.getMonth()) {
       bdayBadge.classList.remove("hidden");
    }
  }
  
  loadVisitHistory(member.memberId);
}

document.addEventListener("DOMContentLoaded", refreshMemberList);

// =========================================================
// QR SCANNER DENGAN FITUR SWITCH KAMERA
// =========================================================
let html5QrCode = null;
let currentCameraMode = "environment"; 
let isScanning = false;

const btnOpenScanner = document.getElementById('btn-open-scanner');
const btnCloseScanner = document.getElementById('btn-close-scanner');
const btnSwitchCamera = document.getElementById('btn-switch-camera'); 
const modalScanner = document.getElementById('modal-scanner');

function startScanner(mode) {
  if (!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");
  
  const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
  
  if (isScanning) {
    html5QrCode.stop().then(() => {
      isScanning = false;
      html5QrCode.start({ facingMode: mode }, config, onScanSuccess, onScanFailure)
        .then(() => isScanning = true)
        .catch(err => console.log(err));
    });
  } else {
    html5QrCode.start({ facingMode: mode }, config, onScanSuccess, onScanFailure)
      .then(() => isScanning = true)
      .catch(err => alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan."));
  }
}

if (btnOpenScanner && modalScanner) {
  btnOpenScanner.addEventListener('click', () => {
    modalScanner.classList.remove('hidden');
    setTimeout(() => {
      currentCameraMode = "environment"; 
      startScanner(currentCameraMode);
    }, 300);
  });
}

if (btnSwitchCamera) {
  btnSwitchCamera.addEventListener('click', () => {
    currentCameraMode = (currentCameraMode === "environment") ? "user" : "environment";
    startScanner(currentCameraMode);
  });
}

function stopScanner() {
  modalScanner.classList.add('hidden');
  if (html5QrCode && isScanning) {
    html5QrCode.stop().then(() => {
      isScanning = false;
      html5QrCode.clear();
    }).catch(err => console.log(err));
  }
}

if (btnCloseScanner) {
  btnCloseScanner.addEventListener('click', stopScanner);
}

function onScanSuccess(decodedText) {
  stopScanner(); 
  
  if (searchInput) {
    searchInput.value = decodedText;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    const foundMember = allMembers.find(m => m.memberId.toLowerCase() === decodedText.toLowerCase().trim());
    if (foundMember) selectMember(foundMember);
  }
}

function onScanFailure() {}
