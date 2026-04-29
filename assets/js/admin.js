const API_URL = "https://script.google.com/macros/s/AKfycbwT_rKDh46m7hyl0wWlcN2TflR-2VoOjRsYpIZT51-jxodGTUJgNYYrCsG5QKGK5Q4cbw/exec";

// Ambil data admin dari localStorage
const ADMIN_ID = localStorage.getItem("manupi_adminId");
const ADMIN_TOKEN = localStorage.getItem("manupi_adminToken");

let allMembers = [];
let selectedMemberId = null;

// Fungsi Utama Call API
async function callApi(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action,
        adminId: ADMIN_ID,
        token: ADMIN_TOKEN,
        ...payload
      })
    });
    return await response.json();
  } catch (error) {
    return { ok: false, error: "Gagal terhubung ke server." };
  }
}

// Inisialisasi: Ambil Daftar Member
async function init() {
  const res = await callApi("listMembers");
  if (res.ok) {
    allMembers = res.data;
  }
}

// Tampilkan Pesan Status
function showStatus(elId, message, isError = false) {
  const el = document.getElementById(elId);
  el.textContent = message;
  el.classList.remove("hidden", "text-red-600", "text-emerald-600");
  el.classList.add(isError ? "text-red-600" : "text-emerald-600");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

// Tambah Member Baru
document.getElementById("add-member-btn")?.addEventListener("click", async () => {
  const name = document.getElementById("member-name").value;
  const phone = document.getElementById("member-phone").value;
  const btn = document.getElementById("add-member-btn");

  if (!name || !phone) {
    showStatus("member-message", "Nama dan Nomor wajib diisi!", true);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  const res = await callApi("addMember", { payload: { name, phone } });

  if (res.ok) {
    showStatus("member-message", `Berhasil! ID: ${res.data.memberId}`);
    document.getElementById("member-name").value = "";
    document.getElementById("member-phone").value = "";
    await init(); // Refresh list
  } else {
    // Menampilkan pesan error duplikat dari Code.gs
    showStatus("member-message", res.error, true);
  }

  btn.disabled = false;
  btn.textContent = "Simpan Member";
});

// Logout
document.getElementById("logout-btn")?.addEventListener("click", () => {
  localStorage.removeItem("manupi_adminId");
  localStorage.removeItem("manupi_adminToken");
  window.location.href = "admin-login.html";
});

// Jalankan init
init();
