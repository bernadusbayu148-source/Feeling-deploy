const API =
  "https://script.google.com/macros/s/AKfycbwT_rKDh46m7hyl0wWlcN2TflR-2VoOjRsYpIZT51-jxodGTUJgNYYrCsG5QKGK5Q4cbw/exec?action=publicLeaderboard&limit=10";

const el = (id) => document.getElementById(id);

function meta(rank, pts) {
  return `Rank ${rank} • ${pts} pts`;
}

async function loadLeaderboard() {
  try {
    const res = await fetch(API);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);

    const d = json.data || [];

    // Rank 1
    if (d[0]) {
      el("lb-featured-name").textContent = d[0].name;
      el("lb-featured-id").textContent = d[0].memberId;
      el("lb-featured-meta").textContent = meta(1, d[0].totalPoints);
    }

    // Rank 2 & 3
    [2, 3].forEach((rank, i) => {
      const m = d[i + 1];
      if (!m) return;
      el(`lb-${rank}-name`).textContent = m.name;
      el(`lb-${rank}-id`).textContent = m.memberId;
      el(`lb-${rank}-meta`).textContent = meta(rank, m.totalPoints);
    });

    // Rank 4–10
    const list = el("lb-top-list");
    list.innerHTML = "";

    d.slice(3, 10).forEach((m, i) => {
      const rank = i + 4;
      const row = document.createElement("div");
      row.className = "flex justify-between px-5 py-3 text-sm";
      row.innerHTML = `
        <div>
          <div>${rank}. ${m.name}</div>
          <div class="text-xs text-stone-400">${m.memberId}</div>
        </div>
        <div class="font-semibold text-primary">${m.totalPoints} pts</div>
      `;
      list.appendChild(row);
    });

    // Search
    el("lb-search").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = d.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q)
      );
      list.innerHTML = "";
      filtered.slice(3).forEach((m, i) => {
        const row = document.createElement("div");
        row.className = "flex justify-between px-5 py-3 text-sm";
        row.innerHTML = `
          <div>${i + 4}. ${m.name}</div>
          <div>${m.totalPoints} pts</div>
        `;
        list.appendChild(row);
      });
    });

  } catch (e) {
    el("lb-status").textContent = "Gagal memuat leaderboard";
    el("lb-status").classList.remove("hidden");
  }
}

document.addEventListener("DOMContentLoaded", loadLeaderboard);
