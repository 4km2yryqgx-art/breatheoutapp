// ============================================================
// Профиль: данные аккаунта, замеры, графики, ачивки
// ============================================================
const Profile = {
  weightChart: null,
  bodyChart: null,

  async load() {
    const p = App.profile;
    document.getElementById("profile-nickname").value = p.nickname || "";
    document.getElementById("profile-email").value = p.email || "";
    document.getElementById("profile-avatar-url").value = p.avatar_url || "";
    document.getElementById("profile-avatar").src = p.avatar_url || "";

    await Measurements.load();
    await Gamification.loadAchievements();
  },

  async save() {
    const nickname = document.getElementById("profile-nickname").value;
    const email = document.getElementById("profile-email").value;
    const avatar_url = document.getElementById("profile-avatar-url").value;

    try {
      App.profile = await API.put("/api/profile/update", { nickname, email, avatar_url });
      document.getElementById("profile-avatar").src = avatar_url;
      TG.haptic("success");
      TG.showAlert("Профиль сохранён!");
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },

  renderCharts(measurements) {
    const labels = measurements.map(m => m.date);

    const ctxWeight = document.getElementById("chart-weight");
    if (this.weightChart) this.weightChart.destroy();
    this.weightChart = new Chart(ctxWeight, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Вес, кг",
          data: measurements.map(m => m.weight),
          borderColor: "#00e5a0",
          backgroundColor: "rgba(0,229,160,0.15)",
          tension: 0.35,
          fill: true,
        }],
      },
      options: chartBaseOptions("Динамика веса"),
    });

    const ctxBody = document.getElementById("chart-body");
    if (this.bodyChart) this.bodyChart.destroy();
    this.bodyChart = new Chart(ctxBody, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Талия", data: measurements.map(m => m.waist), borderColor: "#ff6b6b", tension: 0.35 },
          { label: "Бицепс", data: measurements.map(m => m.biceps), borderColor: "#4d9bff", tension: 0.35 },
          { label: "Бёдра", data: measurements.map(m => m.hips), borderColor: "#ffd93d", tension: 0.35 },
          { label: "Грудь", data: measurements.map(m => m.chest), borderColor: "#a78bfa", tension: 0.35 },
        ],
      },
      options: chartBaseOptions("Объёмы тела, см"),
    });
  },
};

function chartBaseOptions(title) {
  return {
    responsive: true,
    plugins: {
      legend: { labels: { color: "#8a8f98", font: { size: 11 } } },
      title: { display: true, text: title, color: "#fff" },
    },
    scales: {
      x: { ticks: { color: "#8a8f98" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#8a8f98" }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };
}

const Measurements = {
  async load() {
    const data = await API.get("/api/measurements");
    Profile.renderCharts(data);
  },

  async add() {
    const payload = {
      date: new Date().toISOString().slice(0, 10),
      weight: numOrNull("m-weight"),
      waist: numOrNull("m-waist"),
      biceps: numOrNull("m-biceps"),
      hips: numOrNull("m-hips"),
      chest: numOrNull("m-chest"),
    };
    try {
      await API.post("/api/measurements", payload);
      TG.haptic("success");
      ["m-weight", "m-waist", "m-biceps", "m-hips", "m-chest"].forEach(id => document.getElementById(id).value = "");
      await this.load();
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};

function numOrNull(id) {
  const v = document.getElementById(id).value;
  return v ? parseFloat(v) : null;
}

const Gamification = {
  async loadAchievements() {
    const data = await API.get("/api/gamification/me");
    const list = document.getElementById("achievements-list");
    list.innerHTML = data.achievements.map(a => `
      <div class="achievement-card bg-tg-secondary rounded-xl p-3 text-center ${a.unlocked ? '' : 'opacity-30'}">
        <div class="text-2xl mb-1">${a.icon}</div>
        <p class="text-xs font-semibold">${a.title}</p>
        <p class="text-[10px] text-tg-hint">${a.description}</p>
      </div>
    `).join("");
  },
};
