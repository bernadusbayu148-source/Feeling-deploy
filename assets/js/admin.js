const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwT_rKDh46m7hyl0wWlcN2TflR-2VoOjRsYpIZT51-jxodGTUJgNYYrCsG5QKGK5Q4cbw/exec";

const KEY_ADMIN_ID = "manupi_adminId";
const KEY_TOKEN = "manupi_adminToken";

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
const visitNoteInput = document.getElementById("visit-note");
const addVisitBtn = document.getElementById("add-visit-btn");
const visitMessage = document.getElementById("visit-message");

const memberLogList = document.getElementById("member-log-list");
const deleteMemberBtn = document.getElementById("delete-member-btn");

let membersCache = [];
let selectedMemberId = null;

function showMsg(el, text, type = "success") {
  if (!el) return;
  el.textContent = text;
  el.classList.remove("hidden", "text-red-600", "text-emerald-700", "text-stone-500");
  el.classList.add(type === "error" ? "text-red-600" : type === "neutral" ? "text-stone-500" : "text-emerald-700");
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

async function api(action, extra = {}) {
  const { adminId, token } = getAuth();
  const payload = { action, adminId, token, ...extra };

  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }); // [2](https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script)[3](https://basescripts.com/google-apps-script-web-apps-comprehensive-guide)

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API error");
  return data.data;
}

async function loadMembers() {
  membersCache = await api("listMembers");
}

function filterMembers(q) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return membersCache.filter(m => (m.name || "").toLowerCase().includes(s)).slice(0, 10);
}

function renderSuggestions(list) {
  if (!suggestionsBox) return;
  suggestionsBox.innerHTML = "";
  if (!list.length) {
    suggestionsBox.classList.add("hidden");
    return;
  }
  suggestionsBox.classList.remove("hidden");

  list.forEach(m => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "w-full text-left px-4 py-3 text-sm hover:bg-stone-50 transition border-b border-stone-100 last:border-b-0";
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

async function loadVisits(memberId) {
  const visits = await api("listVisits", { memberId });

  if (!memberLogList) return;
  if (!visits.length) {
    memberLogList.innerHTML = `<div class="rounded-2xl border border-dashed border-stone-200 px-4 py-5 text-sm text-stone-500">Belum ada riwayat visit.</div>`;
    return;
  }

  memberLogList.innerHTML = visits.map(v => `
    <div class="rounded-2xl border border-stone-200 px-4 py-4">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p class="font-medium text-primary">+${v.points} pts</p>
          <p class="text-sm text-stone-500">${v.note || "Visit"}</p>
          <p class="text-xs text-stone-400 mt-1">${formatDate(v.createdAt)}</p>
        </div>
        <button type="button"
          class="delete-visit-btn rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
          data-id="${v.visitId}">
          Hapus Visit
        </button>
      </div>
    </div>
  `).join("");

  memberLogList.querySelectorAll(".delete-visit-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await deleteVisit(btn.dataset.id);
    });
  });
}

async function addVisit() {
  hideMsg(visitMessage);
  if (!selectedMemberId) return showMsg(visitMessage, "Pilih member dulu.", "error");

  const points = parseInt(visitPointsInput?.value || "", 10);
  const note = (visitNoteInput?.value || "").trim();
  if (Number.isNaN(points) || points <= 0) return showMsg(visitMessage, "Point harus > 0.", "error");
  if (!note) return showMsg(visitMessage, "Catatan wajib diisi.", "error");

  await api("addVisit", { memberId: selectedMemberId, payload: { points, note } });
  visitPointsInput.value = "";
  visitNoteInput.value = "";
  showMsg(visitMessage, "Visit berhasil ditambahkan.", "success");

  await selectMember(selectedMemberId);
}

async function deleteVisit(visitId) {
  hideMsg(visitMessage);
  if (!confirm("Hapus visit ini?")) return;

  await api("deleteVisit", { visitId });
  showMsg(visitMessage, "Visit berhasil dihapus.", "success");
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

(async function start() {
  try {
    const { adminId, token } = getAuth();
    if (!adminId || !token) return (location.href = "admin-login.html");

    await api("ping"); // ensure auth works & endpoint reachable
    await loadMembers();
  } catch (err) {
    console.error(err);
    localStorage.removeItem(KEY_TOKEN);
    showMsg(searchMessage, "Auth/API gagal: " + err.message, "error");
    setTimeout(() => (location.href = "admin-login.html"), 900);
  }
})();
``
