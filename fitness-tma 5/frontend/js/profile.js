// ============================================================
// Профиль: аватар из Telegram/галереи, замеры, графики, титулы
// ============================================================
const Profile = {
  weightChart: null,
  bodyChart: null,

  async load() {
    const p = App.profile;
    document.getElementById("profile-nickname").value = p.nickname || "";
    this.renderAvatar();
    document.getElementById("profile-titles").innerHTML = Titles.renderFullList(p.level);

    await Measurements.load();
    await Gamification.loadAchievements();
    window.lucide?.createIcons();
  },

  renderAvatar() {
    const p = App.profile;
    const url = p.avatar_url || TG.user?.photo_url;
    const box = document.getElementById("profile-avatar-box");
    if (url) {
      box.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-3xl" />`;
    } else {
      const initial = (p.nickname || "A")[0].toUpperCase();
      box.innerHTML = `<div class="w-full h-full rounded-3xl bg-gradient-to-br from-accent to-emerald-700 flex items-center justify-center text-3xl font-extrabold text-black">${initial}</div>`;
    }
  },

  onAvatarPick(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Сжимаем до 256x256, чтобы не раздувать базу данных
        const canvas = document.createElement("canvas");
        const size = 256;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        App.profile.avatar_url = dataUrl;
        this.renderAvatar();
        API.put("/api/profile/update", { avatar_url: dataUrl })
          .then(() => TG.haptic("success"))
          .catch((err) => TG.showAlert("Ошибка загрузки: " + err.message));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  async saveNickname() {
    const nickname = document.getElementById("profile-nickname").value.trim();
    if (!nickname) return;
    try {
      App.profile = await API.put("/api/profile/update", { nickname });
      TG.haptic("success");
      Home.render();
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};

function chartBaseOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: "easeOutQuart" },
    plugins: {
      legend: { labels: { color: "#8a8f98", font: { size: 11 }, usePointStyle: true } },
      title: { display: true, text: title, color: "#fff", font: { size: 13, weight: "600" } },
    },
    scales: {
      x: { ticks: { color: "#8a8f98", font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: "#8a8f98", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.06)" } },
    },
  };
}

const Measurements = {
  async load() {
    const data = await API.get("/api/measurements");
    this.renderCharts(data);
    this.renderEmptyState(data.length);
  },

  renderEmptyState(count) {
    document.getElementById("charts-wrap").classList.toggle("hidden", count === 0);
    document.getElementById("charts-empty").classList.toggle("hidden", count > 0);
  },

  renderCharts(measurements) {
    if (measurements.length === 0) return;
    const labels = measurements.map((m) => m.date.slice(5));

    const ctxWeight = document.getElementById("chart-weight");
    if (Profile.weightChart) Profile.weightChart.destroy();
    Profile.weightChart = new Chart(ctxWeight, {
      type: "line",
      data: { labels, datasets: [{
        label: "Вес, кг", data: measurements.map((m) => m.weight),
        borderColor: "#00e5a0", backgroundColor: "rgba(0,229,160,0.15)",
        tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: "#00e5a0",
      }] },
      options: chartBaseOptions("Динамика веса"),
    });

    const ctxBody = document.getElementById("chart-body");
    if (Profile.bodyChart) Profile.bodyChart.destroy();
    Profile.bodyChart = new Chart(ctxBody, {
      type: "line",
      data: { labels, datasets: [
        { label: "Талия", data: measurements.map((m) => m.waist), borderColor: "#ff6b6b", tension: 0.4 },
        { label: "Бицепс", data: measurements.map((m) => m.biceps), borderColor: "#4d9bff", tension: 0.4 },
        { label: "Бёдра", data: measurements.map((m) => m.hips), borderColor: "#ffd93d", tension: 0.4 },
        { label: "Грудь", data: measurements.map((m) => m.chest), borderColor: "#a78bfa", tension: 0.4 },
      ] },
      options: chartBaseOptions("Объёмы тела, см"),
    });
  },

  async add() {
    const payload = {
      date: new Date().toISOString().slice(0, 10),
      weight: numOrNull("m-weight"), waist: numOrNull("m-waist"),
      biceps: numOrNull("m-biceps"), hips: numOrNull("m-hips"), chest: numOrNull("m-chest"),
    };
    if (Object.values(payload).every((v) => v === null)) {
      TG.showAlert("Заполни хотя бы одно значение"); return;
    }
    try {
      await API.post("/api/measurements", payload);
      TG.haptic("success");
      ["m-weight", "m-waist", "m-biceps", "m-hips", "m-chest"].forEach((id) => document.getElementById(id).value = "");
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
    list.innerHTML = data.achievements.map((a, i) => `
      <div class="achievement-card glass-card rounded-2xl p-3 text-center ${a.unlocked ? 'animate-in' : 'opacity-30'}" style="animation-delay:${i * 30}ms">
        <div class="w-10 h-10 mx-auto mb-1 rounded-xl bg-accent/15 flex items-center justify-center">
          <i data-lucide="${a.unlocked ? 'award' : 'lock'}" class="w-5 h-5 text-accent"></i>
        </div>
        <p class="text-xs font-semibold leading-tight">${a.title}</p>
        <p class="text-[10px] text-tg-hint leading-tight mt-0.5">${a.description}</p>
      </div>
    `).join("");
    window.lucide?.createIcons();
  },
};
