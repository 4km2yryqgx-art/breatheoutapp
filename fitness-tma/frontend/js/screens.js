// ============================================================
// Простой роутер между экранами Mini App
// ============================================================
const SCREEN_IDS = [
  "loading", "onboarding", "home", "profile",
  "exercises", "workout-log", "history", "plans", "premium",
];

const Screens = {
  current: "loading",

  show(name) {
    TG.haptic("selection");
    SCREEN_IDS.forEach((id) => {
      document.getElementById(`screen-${id}`)?.classList.add("hidden");
    });
    document.getElementById(`screen-${name}`)?.classList.remove("hidden");
    this.current = name;

    const nav = document.getElementById("bottom-nav");
    const hideNavOn = ["loading", "onboarding", "workout-log"];
    nav.classList.toggle("hidden", hideNavOn.includes(name));

    TG.hideMainButton();

    // Ленивая подгрузка данных при переходе на экран
    if (name === "profile") Profile.load();
    if (name === "exercises") Exercises.load();
    if (name === "history") History.load();
    if (name === "plans") Plans.load();
    if (name === "premium") Payments.loadStatus();
    if (name === "home") Home.render();
  },
};
