// ============================================================
// Роутер между экранами Mini App
// ============================================================
const SCREEN_IDS = [
  "loading", "onboarding", "home", "profile",
  "exercises", "workout-log", "history", "plans", "premium", "habits",
];

const NAV_SCREENS = ["home", "exercises", "history", "plans", "profile"];

const Screens = {
  current: "loading",

  show(name) {
    TG.haptic("selection");
    SCREEN_IDS.forEach((id) => document.getElementById(`screen-${id}`)?.classList.add("hidden"));
    const el = document.getElementById(`screen-${name}`);
    el?.classList.remove("hidden");
    el?.classList.add("animate-in");
    this.current = name;

    const nav = document.getElementById("bottom-nav");
    nav.classList.toggle("hidden", !NAV_SCREENS.includes(name));

    const fab = document.querySelector(".fab-habits");
    const hideFabOn = ["loading", "onboarding", "workout-log", "habits"];
    fab?.classList.toggle("hidden", hideFabOn.includes(name));

    NAV_SCREENS.forEach((s) => {
      const btn = document.getElementById(`nav-${s}`);
      if (!btn) return;
      btn.classList.toggle("nav-active", s === name);
    });

    TG.hideMainButton();

    if (name === "profile") Profile.load();
    if (name === "exercises") Exercises.load();
    if (name === "history") History.load();
    if (name === "plans") Plans.load();
    if (name === "premium") Payments.loadStatus();
    if (name === "habits") Habits.load();
    if (name === "home") Home.render();

    requestAnimationFrame(() => window.lucide?.createIcons());
  },
};
