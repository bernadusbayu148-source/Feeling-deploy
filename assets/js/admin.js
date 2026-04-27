console.log("✅ admin.js benar-benar ter-load");

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("login-btn");
  if (!btn) {
    console.warn("login-btn tidak ditemukan");
    return;
  }

  btn.addEventListener("click", () => {
    alert("Klik Login terdeteksi ✅");
  });
});
