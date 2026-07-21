// ============================================================
// Точка входа: загружаем профиль и решаем, что показать
// ============================================================
const App = {
  profile: null,

  async init() {
    if (!TG.initData) {
      // Приложение открыто не из Telegram — покажем заглушку вместо падения
      document.getElementById("screen-loading").innerHTML = `
        <div class="text-center px-6">
          <p class="text-5xl mb-4">📱</p>
          <p class="font-semibold mb-2">Открой это приложение через Telegram-бота</p>
          <p class="text-tg-hint text-sm">Mini App работает только внутри Telegram</p>
        </div>`;
      return;
    }

    try {
      this.profile = await API.get("/api/profile/me");
    } catch (e) {
      TG.showAlert("Ошибка загрузки профиля: " + e.message);
      return;
    }

    document.getElementById("screen-loading").classList.add("hidden");

    if (!this.profile.onboarded) {
      document.getElementById("screen-onboarding").classList.remove("hidden");
      Onboarding.start();
    } else {
      Screens.show("home");
    }
  },
};

const Home = {
  render() {
    const p = App.profile;
    if (!p) return;

    document.getElementById("home-nickname").textContent = p.nickname || "Атлет";
    document.getElementById("home-level").textContent = p.level;
    document.getElementById("home-streak").textContent = p.streak_days;
    document.getElementById("home-calories").textContent = p.calories ? `${p.calories} ккал` : "—";
    document.getElementById("home-bmi").textContent = p.bmi ?? "—";
    document.getElementById("home-protein").textContent = p.protein_g ? `${p.protein_g}г` : "—";
    document.getElementById("home-fat").textContent = p.fat_g ? `${p.fat_g}г` : "—";
    document.getElementById("home-carbs").textContent = p.carbs_g ? `${p.carbs_g}г` : "—";

    API.get("/api/gamification/me").then(g => {
      document.getElementById("home-xp-text").textContent = `${g.xp} / ${g.xp + g.xp_to_next_level}`;
      document.getElementById("home-xp-bar").style.width = `${g.progress_percent}%`;
    });
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
