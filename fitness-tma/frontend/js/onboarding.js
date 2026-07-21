// ============================================================
// Пошаговая анкета при первом входе
// ============================================================
const Onboarding = {
  data: {},
  stepIndex: 0,

  steps: [
    {
      key: "gender", title: "Твой пол?", type: "choice",
      options: [{ v: "male", l: "Мужской 🙋‍♂️" }, { v: "female", l: "Женский 🙋‍♀️" }],
    },
    { key: "age", title: "Сколько тебе лет?", type: "number", placeholder: "Например, 25" },
    { key: "weight", title: "Твой текущий вес (кг)?", type: "number", placeholder: "Например, 70" },
    { key: "height", title: "Твой рост (см)?", type: "number", placeholder: "Например, 175" },
    {
      key: "goal", title: "Какая у тебя цель?", type: "choice",
      options: [
        { v: "lose", l: "🔥 Похудение" }, { v: "gain", l: "💪 Набор массы" },
        { v: "relief", l: "🏆 Рельеф" }, { v: "endurance", l: "🏃 Выносливость" },
      ],
    },
    {
      key: "activity_level", title: "Уровень активности (не считая тренировок)?", type: "choice",
      options: [
        { v: 1, l: "1 — Сидячий образ жизни" }, { v: 2, l: "2 — Лёгкая активность" },
        { v: 3, l: "3 — Средняя активность" }, { v: 4, l: "4 — Высокая активность" },
        { v: 5, l: "5 — Очень высокая (спорт ежедневно)" },
      ],
    },
    {
      key: "experience", title: "Твой опыт тренировок?", type: "choice",
      options: [
        { v: "beginner", l: "🌱 Новичок" }, { v: "mid", l: "📈 Средний уровень" },
        { v: "advanced", l: "🏅 Продвинутый" },
      ],
    },
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

    let html = `<div class="mb-4">
      <div class="flex gap-1 mb-4">
        ${this.steps.map((_, i) => `<div class="h-1 flex-1 rounded-full ${i <= this.stepIndex ? 'bg-accent' : 'bg-white/10'}"></div>`).join("")}
      </div>
      <h2 class="text-lg font-semibold mb-3">${step.title}</h2>`;

    if (step.type === "choice") {
      html += `<div class="space-y-2">`;
      step.options.forEach((opt) => {
        html += `<button class="w-full text-left bg-tg-secondary rounded-xl p-3"
          onclick="Onboarding.selectChoice('${step.key}', '${opt.v}')">${opt.l}</button>`;
      });
      html += `</div>`;
    } else {
      html += `<input id="onboarding-input" type="${step.type}" placeholder="${step.placeholder || ""}"
        class="w-full bg-tg-secondary rounded-xl p-3 mb-3" />
        <button class="w-full bg-accent text-black font-bold py-3 rounded-xl"
          onclick="Onboarding.selectNumber('${step.key}')">Далее</button>`;
    }

    html += `</div>`;
    container.innerHTML = html;
  },

  selectChoice(key, value) {
    TG.haptic("medium");
    this.data[key] = isNaN(value) ? value : Number(value);
    this.stepIndex++;
    this.renderStep();
  },

  selectNumber(key) {
    const input = document.getElementById("onboarding-input");
    const val = parseFloat(input.value);
    if (!val || val <= 0) { TG.haptic("error"); TG.showAlert("Введи корректное значение"); return; }
    TG.haptic("medium");
    this.data[key] = val;
    this.stepIndex++;
    this.renderStep();
  },

  async submit() {
    try {
      const profile = await API.post("/api/profile/onboarding", this.data);
      TG.haptic("success");
      App.profile = profile;
      Screens.show("home");
      Home.render();
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
