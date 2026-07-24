// ============================================================
// Магазин готовых Premium-тренировок (покупка за Telegram Stars)
// ============================================================
const Shop = {
  templates: [],
  activeGoal: null,
  activeGender: null,
  activeLevel: null,

  GOALS: [
    { v: "lose", l: "Похудение" }, { v: "gain", l: "Набор массы" },
    { v: "relief", l: "Рельеф" }, { v: "back", l: "Спина" }, { v: "arms", l: "Руки" },
  ],
  GENDERS: [{ v: "male", l: "Для парней" }, { v: "female", l: "Для девушек" }, { v: "any", l: "Универсально" }],
  LEVELS: [{ v: "beginner", l: "Новичок" }, { v: "advanced", l: "Опытный" }],

  async load() {
    const res = await API.get("/api/shop/templates");
    this.templates = res.templates;
    this.renderFilters();
    this.render();
    window.lucide?.createIcons();
  },

  renderFilters() {
    const mkChip = (list, active, groupKey) => list.map((o) =>
      `<button class="chip ${active === o.v ? 'chip-active' : ''}" onclick="Shop.setFilter('${groupKey}','${o.v}')">${o.l}</button>`
    ).join("");

    document.getElementById("shop-filters-goal").innerHTML =
      `<button class="chip ${!this.activeGoal ? 'chip-active' : ''}" onclick="Shop.setFilter('goal',null)">Все цели</button>` + mkChip(this.GOALS, this.activeGoal, "goal");
    document.getElementById("shop-filters-gender").innerHTML =
      `<button class="chip ${!this.activeGender ? 'chip-active' : ''}" onclick="Shop.setFilter('gender',null)">Любой пол</button>` + mkChip(this.GENDERS, this.activeGender, "gender");
    document.getElementById("shop-filters-level").innerHTML =
      `<button class="chip ${!this.activeLevel ? 'chip-active' : ''}" onclick="Shop.setFilter('level',null)">Любой уровень</button>` + mkChip(this.LEVELS, this.activeLevel, "level");
  },

  setFilter(group, value) {
    TG.haptic("selection");
    if (group === "goal") this.activeGoal = value;
    if (group === "gender") this.activeGender = value;
    if (group === "level") this.activeLevel = value;
    this.renderFilters();
    this.render();
  },

  render() {
    let list = this.templates;
    if (this.activeGoal) list = list.filter((t) => t.goal === this.activeGoal);
    if (this.activeGender) list = list.filter((t) => t.gender === this.activeGender || t.gender === "any");
    if (this.activeLevel) list = list.filter((t) => t.level === this.activeLevel);

    const box = document.getElementById("shop-list");
    if (list.length === 0) {
      box.innerHTML = `<div class="text-center py-8 text-tg-hint text-sm">Нет тренировок под эти фильтры</div>`;
      return;
    }
    box.innerHTML = list.map((t, i) => `
      <button onclick="Shop.openDetail('${t.id}')" class="w-full text-left rounded-2xl p-4 animate-in active-press ${t.owned ? 'shop-card-owned' : 'glass-card'}" style="animation-delay:${i * 40}ms">
        <div class="flex justify-between items-start gap-2">
          <div class="min-w-0">
            <p class="font-bold text-sm flex items-center gap-1.5">
              ${t.owned ? '<i data-lucide="badge-check" class="w-4 h-4 text-accent shrink-0"></i>' : ''}${t.title}
            </p>
            <p class="text-xs text-tg-hint mt-1 line-clamp-2">${t.description}</p>
            <div class="flex gap-1 flex-wrap mt-2">
              <span class="text-[10px] bg-white/5 rounded-full px-2 py-0.5">${t.goal_label}</span>
              <span class="text-[10px] bg-white/5 rounded-full px-2 py-0.5">${t.gender_label}</span>
              <span class="text-[10px] bg-white/5 rounded-full px-2 py-0.5">${t.level_label}</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            ${t.owned
              ? `<span class="text-[11px] font-bold text-accent">Куплено</span>`
              : `<span class="text-sm font-bold text-yellow-400">${t.price_stars} ⭐</span>`}
          </div>
        </div>
      </button>
    `).join("");
    window.lucide?.createIcons();
  },

  openDetail(templateId) {
    const t = this.templates.find((x) => x.id === templateId);
    if (!t) return;
    TG.haptic("light");
    this._activeTemplate = t;

    document.getElementById("shop-detail-title").textContent = t.title;
    document.getElementById("shop-detail-description").textContent = t.description;
    document.getElementById("shop-detail-exercises").innerHTML = t.exercises.map((e, i) => `
      <div class="glass-card-flat rounded-xl p-3 flex items-center gap-3">
        <span class="w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0">${i + 1}</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium truncate">${e.exercise_name}</p>
          <p class="text-[11px] text-tg-hint">${e.hint}</p>
        </div>
        ${e.muscle_group === "cardio" ? '<i data-lucide="heart-pulse" class="w-4 h-4 text-accent shrink-0"></i>' : ''}
      </div>
    `).join("");

    const actionBox = document.getElementById("shop-detail-action");
    if (t.owned) {
      actionBox.innerHTML = `<button onclick="Shop.startWorkout()" class="w-full btn-primary"><i data-lucide="play" class="w-5 h-5"></i> Начать эту тренировку</button>`;
    } else {
      actionBox.innerHTML = `<button onclick="Shop.buy()" class="w-full btn-gold"><i data-lucide="star" class="w-5 h-5"></i> Купить за ${t.price_stars} ⭐</button>`;
    }

    const modal = document.getElementById("shop-detail-modal");
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("modal-open"));
    window.lucide?.createIcons();
  },

  closeDetail() {
    const m = document.getElementById("shop-detail-modal");
    m.classList.remove("modal-open");
    setTimeout(() => m.classList.add("hidden"), 200);
  },

  async buy() {
    const t = this._activeTemplate;
    if (!t) return;
    try {
      TG.haptic("medium");
      const { invoice_link } = await API.post(`/api/shop/purchase/${t.id}/create-invoice-link`);
      TG.openInvoice(invoice_link, async (status) => {
        if (status === "paid") {
          TG.haptic("success");
          TG.showPopup({ title: "Готово! 🎉", message: `«${t.title}» теперь твоя. Можешь начинать в любое время!`, buttons: [{ type: "ok" }] });
          this.closeDetail();
          await this.load();
        } else if (status !== "cancelled") {
          TG.haptic("error");
        }
      });
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },

  startWorkout() {
    const t = this._activeTemplate;
    if (!t) return;
    TG.haptic("success");

    Workouts.reset();
    Workouts.entries = t.exercises.map((e) => {
      const isCardio = e.muscle_group === "cardio";
      return {
        exercise_id: e.exercise_id, exercise_name: `${e.exercise_name} · ${e.hint}`, muscle_group: e.muscle_group,
        sets: [isCardio ? { speed: 0, duration: 10 } : { weight: 0, reps: 0 }],
      };
    });
    document.getElementById("workout-title").value = t.title;

    this.closeDetail();
    Screens.show("workout-log");
    Workouts.render();
    Workouts.loadPRsForEntries();
  },
};
