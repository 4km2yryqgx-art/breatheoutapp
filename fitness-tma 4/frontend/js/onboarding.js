// ============================================================
// Онбординг: слайдеры для чисел, тактильные карточки для выбора
// ============================================================
const Onboarding = {
  data: {},
  stepIndex: 0,

  steps: [
    { key: "gender", title: "Твой пол", subtitle: "Это нужно для точного расчёта нормы калорий", type: "choice",
      options: [{ v: "male", l: "Мужской", icon: "person-standing" }, { v: "female", l: "Женский", icon: "user" }] },
    { key: "age", title: "Сколько тебе лет?", type: "slider", min: 14, max: 80, step: 1, unit: "лет", default: 25 },
    { key: "weight", title: "Твой текущий вес", type: "slider", min: 35, max: 180, step: 1, unit: "кг", default: 70 },
    { key: "height", title: "Твой рост", type: "slider", min: 120, max: 220, step: 1, unit: "см", default: 175 },
    { key: "goal", title: "Какая у тебя цель?", type: "choice",
      options: [
        { v: "lose", l: "Похудение", icon: "flame" }, { v: "gain", l: "Набор массы", icon: "dumbbell" },
        { v: "relief", l: "Рельеф", icon: "sparkles" }, { v: "endurance", l: "Выносливость", icon: "wind" },
      ] },
    { key: "activity_level", title: "Уровень активности", subtitle: "Не считая тренировок", type: "slider",
      min: 1, max: 5, step: 1, unit: "", default: 3, isLevel: true },
    { key: "experience", title: "Твой опыт тренировок?", type: "choice",
      options: [
        { v: "beginner", l: "Новичок", icon: "seedling" }, { v: "mid", l: "Средний уровень", icon: "trending-up" },
        { v: "advanced", l: "Продвинутый", icon: "trophy" },
      ] },
  ],

  start() {
    this.data = {};
    this.stepIndex = 0;
    this.renderStep();
  },

  renderStep() {
    const container = document.getElementById("onboarding-steps");
    const step = this.steps[this.stepIndex];
    if (!step) { this.submit(); return; }

    const progressDots = this.steps.map((_, i) =>
      `<div class="h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= this.stepIndex ? 'bg-accent' : 'bg-white/10'}"></div>`
    ).join("");

    let inner = "";
    if (step.type === "choice") {
      inner = `<div class="space-y-3">` + step.options.map((opt) => `
        <button class="w-full text-left glass-card rounded-2xl p-4 flex items-center gap-4 active-press animate-in"
          onclick="Onboarding.selectChoice('${step.key}', '${opt.v}')">
          <div class="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <i data-lucide="${opt.icon}" class="w-5 h-5 text-accent"></i>
          </div>
          <span class="font-semibold">${opt.l}</span>
        </button>`).join("") + `</div>`;
    } else if (step.type === "slider") {
      const val = this.data[step.key] ?? step.default;
      inner = `
        <div class="glass-card rounded-3xl p-6 text-center animate-in">
          <p class="text-5xl font-extrabold text-accent mb-1" id="slider-value">${step.isLevel ? levelLabel(val) : val}</p>
          <p class="text-tg-hint text-sm mb-6">${step.unit}</p>
          <input type="range" id="onboarding-slider" min="${step.min}" max="${step.max}" step="${step.step}" value="${val}"
            class="fit-slider w-full" oninput="Onboarding.onSlide('${step.key}', this.value, ${!!step.isLevel})">
        </div>
        <button class="w-full bg-accent text-black font-bold py-4 rounded-2xl mt-4 active-press"
          onclick="Onboarding.confirmSlider('${step.key}')">Далее</button>`;
    }

    container.innerHTML = `
      <div class="flex gap-1.5 mb-5">${progressDots}</div>
      <h2 class="text-xl font-bold mb-1">${step.title}</h2>
      ${step.subtitle ? `<p class="text-tg-hint text-sm mb-4">${step.subtitle}</p>` : '<div class="mb-4"></div>'}
      ${inner}
    `;
    window.lucide?.createIcons();
  },

  onSlide(key, value, isLevel) {
    TG.haptic("selection");
    this.data[key] = Number(value);
    document.getElementById("slider-value").textContent = isLevel ? levelLabel(Number(value)) : value;
  },

  confirmSlider(key) {
    if (this.data[key] === undefined) {
      const step = this.steps[this.stepIndex];
      this.data[key] = step.default;
    }
    TG.haptic("medium");
    this.stepIndex++;
    this.renderStep();
  },

  selectChoice(key, value) {
    TG.haptic("medium");
    this.data[key] = value;
    this.stepIndex++;
    this.renderStep();
  },

  async submit() {
    try {
      const profile = await API.post("/api/profile/onboarding", this.data);
      TG.haptic("success");
      App.profile = profile;
      document.getElementById("screen-onboarding").classList.add("hidden");
      Screens.show("home");
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};

function levelLabel(v) {
  const labels = { 1: "Сидячий образ жизни", 2: "Лёгкая активность", 3: "Средняя активность", 4: "Высокая активность", 5: "Очень высокая" };
  return labels[v] || v;
}
