const API_URL = "https://script.google.com/macros/s/AKfycbwT_rKDh46m7hyl0wWlcN2TflR-2VoOjRsYpIZT51-jxodGTUJgNYYrCsG5QKGK5Q4cbw/exec";

const ADMIN_ID = localStorage.getItem("manupi_adminId");
const ADMIN_TOKEN = localStorage.getItem("manupi_adminToken");

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

function showStatus(elId, message, isError = false) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden", "text-red-600", "text-emerald-600");
  el.classList.add(isError ? "text-red-600" : "text-emerald-600");
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

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
  } else {
    // Menangkap pesan error spesifik "Nomor WhatsApp sudah terdaftar"
    showStatus("member-message", res.error || "Gagal mendaftarkan member", true);
  }

  btn.disabled = false;
  btn.textContent = "Simpan Member";
});

document.getElementById("logout-btn")?.addEventListener("click", () => {
  localStorage.removeItem("manupi_adminId");
  localStorage.removeItem("manupi_adminToken");
  window.location.href = "admin-login.html";
});
