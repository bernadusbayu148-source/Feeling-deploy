// ====== KONFIGURASI ======
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwT_rKDh46m7hyl0wWlcN2TflR-2VoOjRsYpIZT51-jxodGTUJgNYYrCsG5QKGK5Q4cbw/exec";

const KEY_ADMIN_ID = "manupi_adminId";
const KEY_TOKEN = "manupi_adminToken";

// ====== ELEMENTS ======
const logoutBtn = document.getElementById("logout-btn");

const memberNameInput = document.getElementById("member-name");
const memberPhoneInput = document.getElementById("member-phone");
const addMemberBtn = document.getElementById("add-member-btn");
const memberMessage = document.getElementById("member-message");

const searchInput = document.getElementById("member-search");
const suggestionsBox = document.getElementById("member-suggestions");
const searchMessage = document.getElementById("search-message");

const memberDetailSection = document.getElementById("member-detail-section");
const detailMemberName = document.getElementById("detail-member-name");
const detailMemberPhone = document.getElementById("detail-member-phone");
const detailTotalPoints = document.getElementById("detail-total-points");
const detailTotalVisits = document.getElementById("detail-total-visits");
const detailStatus = document.getElementById("detail-status");

const visitPointsInput = document.getElementById("visit-points");
// NOTE: visit-note sudah tidak dipakai
const addVisitBtn = document.getElementById("add-visit-btn");
const visitMessage = document.getElementById("visit-message");

const memberLogList = document.getElementById("member-log-list");
const deleteMemberBtn = document.getElementById("delete-member-btn");

// ====== STATE ======
let membersCache = [];
let selectedMemberId = null;

// ====== HELPERS ======
function showMsg(el, text, type = "success") {
  if (!el) return;
  el.textContent = text;
  el.classList.remove("hidden", "text-red-600", "text-emerald-700", "text-stone-500");
  el.classList.add(
    type === "error" ? "text-red-600" : type === "neutral" ? "text-stone-500" : "text-emerald-700"
  );
}
function hideMsg(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso || "-";
  }
}
function getAuth() {
  return {
    adminId: localStorage.getItem(KEY_ADMIN_ID) || "",
    token: localStorage.getItem(KEY_TOKEN) || ""
  };
}

// ====== API CALL ======
async function api(action, extra = {}) {
  const { adminId, token } = getAuth();
  const payload = { action, adminId, token, ...extra };

  // Hindari preflight/CORS pada Apps Script web app: text/plain + redirect follow [3](https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script)[4](https://basescripts.com/google-apps-script-web-apps-comprehensive-guide)
  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API error");
  return data.data;
}

// ====== MEMBERS ======
async function loadMembers() {
  membersCache = await api("listMembers");
}

function filterMembers(q) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return membersCache
    .filter((m) => (m.name || "").toLowerCase().includes(s))
    .slice(0, 10);
}

function renderSuggestions(list) {
  if (!suggestionsBox) return;
  suggestionsBox.innerHTML = "";

  if (!list.length) {
    suggestionsBox.classList.add("hidden");
    return;
  }

  suggestionsBox.classList.remove("hidden");

  list.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "w-full text-left px-4 py-3 text-sm hover:bg-stone-50 transition border-b border-stone-100 last:border-b-0";
    btn.innerHTML = `<div class="font-medium text-primary">${m.name}</div>
                     <div class="text-xs text-stone-500 mt-1">${m.phone || "-"}</div>`;
    btn.addEventListener("click", () => selectMember(m.memberId));
    suggestionsBox.appendChild(btn);
  });
}

async function selectMember(memberId) {
  selectedMemberId = memberId;
  suggestionsBox?.classList.add("hidden");
  hideMsg(searchMessage);
  hideMsg(visitMessage);

  const m = await api("getMember", { memberId });

  memberDetailSection?.classList.remove("hidden");
  detailMemberName.textContent = m.name || "-";
  detailMemberPhone.textContent = m.phone || "-";
  detailTotalPoints.textContent = `${m.totalPoints || 0} pts`;
  detailTotalVisits.textContent = `${m.totalVisits || 0} visit`;
  detailStatus.textContent = m.active ? "Aktif" : "Nonaktif";

  await loadVisits(memberId);
}

async function addMember() {
  hideMsg(memberMessage);
  const name = (memberNameInput?.value || "").trim();
  const phone = (memberPhoneInput?.value || "").trim();
  if (!name) return showMsg(memberMessage, "Nama member wajib diisi.", "error");

  await api("addMember", { payload: { name, phone } });
  memberNameInput.value = "";
  memberPhoneInput.value = "";
  showMsg(memberMessage, "Member berhasil ditambahkan.", "success");

  await loadMembers();
}

// ====== VISITS (COMPACT ROW + EDIT) ======
async function loadVisits(memberId) {
  const visits = await api("listVisits", { memberId });

  if (!memberLogList) return;

  if (!visits.length) {
    memberLogList.innerHTML = `
      <div class="rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-sm text-stone-500">
        Belum ada riwayat visit.
      </div>`;
    return;
  }

  // Buat nomor visit berdasarkan urutan tanggal paling lama -> paling baru
  const asc = [...visits].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const visitNoById = {};
  asc.forEach((v, i) => (visitNoById[v.visitId] = i + 1));

  // Render compact row (terbaru di atas sesuai data API)
  memberLogList.innerHTML = visits
    .map((v) => {
      const visitNo = visitNoById[v.visitId] || "-";
      const dateText = formatDate(v.createdAt);

      return `
        <div class="rounded-xl border border-stone-200 bg-white/70 px-4 py-3">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-2 md:items-center">
            
            <div class="md:col-span-3">
              <div class="text-xs uppercase tracking-[0.18em] text-stone-400">Visit</div>
              <div class="font-semibold text-primary">Ke-${visitNo}</div>
            </div>

            <div class="md:col-span-6">
              <div class="text-xs uppercase tracking-[0.18em] text-stone-400">Tanggal</div>
              <div class="text-sm text-stone-700">${dateText}</div>
            </div>

            <div class="md:col-span-2 md:text-right">
              <div class="text-xs uppercase tracking-[0.18em] text-stone-400">Poin</div>
              <div class="font-semibold text-emerald-700">+${v.points} pts</div>
            </div>

            <div class="md:col-span-1 md:text-right">
              <button
                type="button"
                class="edit-visit-btn inline-flex items-center justify-center rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition w-full md:w-auto"
                data-id="${v.visitId}"
                data-points="${v.points}"
              >
                Edit
              </button>
            </div>

          </div>
        </div>
      `;
    })
    .join("");

  // Handler Edit → panggil API editVisit
  memberLogList.querySelectorAll(".edit-visit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const visitId = btn.dataset.id;
      const current = parseInt(btn.dataset.points || "0", 10);

      const input = prompt("Ubah poin visit (angka > 0):", String(current));
      if (input === null) return;

      const newPoints = parseInt(input, 10);
      if (Number.isNaN(newPoints) || newPoints <= 0) {
        alert("Poin harus angka dan > 0");
        return;
      }

      try {
        await api("editVisit", { visitId, newPoints });
        showMsg(visitMessage, "Poin visit berhasil diubah.", "success");
        await selectMember(selectedMemberId); // refresh summary + list
      } catch (e) {
        console.error(e);
        showMsg(visitMessage, "Gagal edit visit: " + e.message, "error");
      }
    });
  });
}

async function addVisit() {
  hideMsg(visitMessage);
  if (!selectedMemberId) return showMsg(visitMessage, "Pilih member dulu.", "error");

  const points = parseInt(visitPointsInput?.value || "", 10);
  if (Number.isNaN(points) || points <= 0) return showMsg(visitMessage, "Point harus > 0.", "error");

  // Kirim TANPA note → backend akan otomatis isi Visit ke-N
  await api("addVisit", { memberId: selectedMemberId, payload: { points } });

  visitPointsInput.value = "";
  showMsg(visitMessage, "Visit berhasil ditambahkan.", "success");

  await selectMember(selectedMemberId);
}

async function deleteMember() {
  hideMsg(visitMessage);
  if (!selectedMemberId) return;
  if (!confirm("Hapus PERMANEN member ini dan semua visit?")) return;

  await api("deleteMember", { memberId: selectedMemberId });
  showMsg(searchMessage, "Member berhasil dihapus.", "success");

  memberDetailSection?.classList.add("hidden");
  selectedMemberId = null;
  searchInput.value = "";
  await loadMembers();
}

// ====== EVENTS ======
logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem(KEY_ADMIN_ID);
  localStorage.removeItem(KEY_TOKEN);
  location.href = "admin-login.html";
});

addMemberBtn?.addEventListener("click", addMember);
addVisitBtn?.addEventListener("click", addVisit);
deleteMemberBtn?.addEventListener("click", deleteMember);

searchInput?.addEventListener("input", () => {
  const q = searchInput.value.trim();
  if (!q) {
    hideMsg(searchMessage);
    renderSuggestions([]);
    return;
  }
  const results = filterMembers(q);
  if (!results.length) showMsg(searchMessage, "Tidak ada member yang cocok.", "neutral");
  else hideMsg(searchMessage);
  renderSuggestions(results);
});

document.addEventListener("click", (e) => {
  const wrapper = searchInput?.closest(".relative");
  if (wrapper && !wrapper.contains(e.target)) suggestionsBox?.classList.add("hidden");
});

// ====== START ======
(async function start() {
  try {
    const { adminId, token } = getAuth();
    if (!adminId || !token) return (location.href = "admin-login.html");

    await api("ping");
    await loadMembers();
  } catch (err) {
    console.error(err);
    localStorage.removeItem(KEY_TOKEN);
    showMsg(searchMessage, "Auth/API gagal: " + err.message, "error");
    setTimeout(() => (location.href = "admin-login.html"), 900);
  }
})();
