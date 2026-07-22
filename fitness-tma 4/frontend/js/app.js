// ============================================================
// Точка входа приложения
// ============================================================
const App = {
  profile: null,

  async init() {
    if (!TG.initData) {
      document.getElementById("screen-loading").innerHTML = `
        <div class="text-center px-6 animate-in">
          <div class="w-16 h-16 mx-auto mb-4 rounded-3xl bg-accent/15 flex items-center justify-center">
            <i data-lucide="smartphone" class="w-8 h-8 text-accent"></i>
          </div>
          <p class="font-semibold mb-2">Открой это приложение через Telegram-бота</p>
          <p class="text-tg-hint text-sm">Mini App работает только внутри Telegram</p>
        </div>`;
      window.lucide?.createIcons();
      return;
    }

    // Мгновенно показываем имя/аватар из Telegram, не дожидаясь бэкенда
    if (TG.user) {
      const nameEl = document.getElementById("loading-name");
      if (nameEl) nameEl.textContent = TG.user.first_name || "";
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
      Workouts.checkDraftOnStart();
    }
    window.lucide?.createIcons();
  },
};

const Home = {
  render() {
    const p = App.profile;
    if (!p) return;

    document.getElementById("home-nickname").textContent = p.nickname || TG.user?.first_name || "Атлет";
    document.getElementById("home-title-badge").innerHTML = Titles.renderHomeBadge(p.level);
    document.getElementById("home-streak").textContent = p.streak_days;
    document.getElementById("home-calories").textContent = p.calories ? `${p.calories}` : "—";
    document.getElementById("home-bmi").textContent = p.bmi ?? "—";
    document.getElementById("home-protein").textContent = p.protein_g ? `${p.protein_g}г` : "—";
    document.getElementById("home-fat").textContent = p.fat_g ? `${p.fat_g}г` : "—";
    document.getElementById("home-carbs").textContent = p.carbs_g ? `${p.carbs_g}г` : "—";

    const avatarUrl = p.avatar_url || TG.user?.photo_url;
    const avatarBox = document.getElementById("home-avatar");
    if (avatarUrl) {
      avatarBox.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-2xl">`;
    } else {
      avatarBox.innerHTML = `<div class="w-full h-full rounded-2xl bg-gradient-to-br from-accent to-emerald-700 flex items-center justify-center font-extrabold text-black">${(p.nickname || "A")[0].toUpperCase()}</div>`;
    }

    API.get("/api/gamification/me").then((g) => {
      document.getElementById("home-level-num").textContent = g.level;
      const totalForLevel = g.xp + g.xp_to_next_level;
      document.getElementById("home-xp-text").textContent = `${g.xp} / ${totalForLevel} XP`;
      const bar = document.getElementById("home-xp-bar");
      bar.style.width = "0%";
      requestAnimationFrame(() => { bar.style.width = `${g.progress_percent}%`; });
    });

    window.lucide?.createIcons();
  },

  celebrate(xp, achievementsCount) {
    const overlay = document.getElementById("celebrate-overlay");
    overlay.innerHTML = `
      <div class="celebrate-card animate-pop">
        <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent to-emerald-600 flex items-center justify-center">
          <i data-lucide="party-popper" class="w-10 h-10 text-black"></i>
        </div>
        <p class="text-2xl font-extrabold mb-1">+${xp} XP</p>
        <p class="text-tg-hint text-sm mb-5">${achievementsCount > 0 ? `Плюс ${achievementsCount} новое достижение! 🏆` : "Тренировка записана в дневник"}</p>
        <button onclick="Home.closeCelebrate()" class="w-full bg-accent text-black font-bold py-3 rounded-2xl active-press">Продолжить</button>
      </div>`;
    overlay.classList.remove("hidden");
    window.lucide?.createIcons();
    Home.render();
  },

  closeCelebrate() {
    TG.haptic("light");
    document.getElementById("celebrate-overlay").classList.add("hidden");
  },

  toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.remove("hidden");
    el.classList.add("toast-show");
    setTimeout(() => { el.classList.remove("toast-show"); setTimeout(() => el.classList.add("hidden"), 300); }, 2200);
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
