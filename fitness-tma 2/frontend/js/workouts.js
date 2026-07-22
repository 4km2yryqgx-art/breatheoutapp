// ============================================================
// Дневник тренировок: запись подходов, таймер отдыха, сохранение
// ============================================================
const Workouts = {
  entries: [],
  timerInterval: null,
  timerTotal: 0,

  reset() {
    this.entries = [];
    document.getElementById("workout-title").value = "";
    clearInterval(this.timerInterval);
    document.getElementById("rest-timer").classList.add("hidden");
    this.render();
  },

  openExercisePicker() {
    Modal.openPicker((ex) => {
      TG.haptic("success");
      this.entries.push({ exercise_id: ex.id, exercise_name: ex.name, sets: [{ weight: 0, reps: 0 }] });
      this.render();
    });
  },

  render() {
    const container = document.getElementById("workout-entries");
    if (this.entries.length === 0) {
      container.innerHTML = `<div class="text-center py-10 text-tg-hint">
        <i data-lucide="dumbbell" class="w-9 h-9 mx-auto mb-2 opacity-40"></i>
        <p class="text-sm">Добавь первое упражнение</p></div>`;
      window.lucide?.createIcons();
      return;
    }
    container.innerHTML = this.entries.map((entry, ei) => `
      <div class="glass-card rounded-2xl p-4 animate-in">
        <div class="flex justify-between items-center mb-3">
          <p class="font-semibold text-sm">${entry.exercise_name}</p>
          <button onclick="Workouts.removeEntry(${ei})" class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center active-press">
            <i data-lucide="x" class="w-4 h-4 text-tg-hint"></i>
          </button>
        </div>
        <div class="space-y-2">
          ${entry.sets.map((s, si) => `
            <div class="flex gap-2 items-center text-sm">
              <span class="w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0">${si + 1}</span>
              <input type="number" inputmode="decimal" value="${s.weight || ''}" placeholder="кг"
                oninput="Workouts.updateSet(${ei},${si},'weight',this.value)" class="input-field flex-1">
              <i data-lucide="x" class="w-3.5 h-3.5 text-tg-hint shrink-0"></i>
              <input type="number" inputmode="numeric" value="${s.reps || ''}" placeholder="повт."
                oninput="Workouts.updateSet(${ei},${si},'reps',this.value)" class="input-field flex-1">
              <button onclick="Workouts.removeSet(${ei},${si})" class="text-tg-hint shrink-0"><i data-lucide="minus-circle" class="w-4 h-4"></i></button>
            </div>
          `).join("")}
        </div>
        <button onclick="Workouts.addSet(${ei})" class="text-accent text-xs mt-3 font-semibold flex items-center gap-1 active-press">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i> Подход
        </button>
      </div>
    `).join("");
    window.lucide?.createIcons();
  },

  addSet(entryIndex) {
    TG.haptic("light");
    const last = this.entries[entryIndex].sets.at(-1) || { weight: 0, reps: 0 };
    this.entries[entryIndex].sets.push({ weight: last.weight, reps: last.reps });
    this.render();
  },

  removeSet(entryIndex, setIndex) {
    TG.haptic("light");
    this.entries[entryIndex].sets.splice(setIndex, 1);
    if (this.entries[entryIndex].sets.length === 0) this.entries[entryIndex].sets.push({ weight: 0, reps: 0 });
    this.render();
  },

  updateSet(entryIndex, setIndex, field, value) {
    this.entries[entryIndex].sets[setIndex][field] = parseFloat(value) || 0;
  },

  removeEntry(entryIndex) {
    TG.haptic("light");
    this.entries.splice(entryIndex, 1);
    this.render();
  },

  startRestTimer(seconds) {
    TG.haptic("medium");
    clearInterval(this.timerInterval);
    let remaining = seconds;
    this.timerTotal = seconds;
    const el = document.getElementById("rest-timer");
    const ring = document.getElementById("rest-timer-ring");
    el.classList.remove("hidden");

    const update = () => {
      const m = Math.floor(remaining / 60).toString().padStart(2, "0");
      const s = (remaining % 60).toString().padStart(2, "0");
      document.getElementById("rest-timer-text").textContent = `${m}:${s}`;
      const pct = 1 - remaining / this.timerTotal;
      ring.style.setProperty("--pct", pct);
    };
    update();

    this.timerInterval = setInterval(() => {
      remaining--;
      update();
      if (remaining <= 0) {
        clearInterval(this.timerInterval);
        el.classList.add("hidden");
        TG.haptic("success");
        TG.showAlert("Отдых окончен! Погнали дальше 💪");
      }
    }, 1000);
  },

  stopRestTimer() {
    clearInterval(this.timerInterval);
    document.getElementById("rest-timer").classList.add("hidden");
    TG.haptic("light");
  },

  async save() {
    if (this.entries.length === 0) { TG.showAlert("Добавь хотя бы одно упражнение"); return; }
    const payload = {
      date: new Date().toISOString().slice(0, 10),
      title: document.getElementById("workout-title").value || "Тренировка",
      entries: this.entries,
    };
    try {
      const result = await API.post("/api/workouts", payload);
      TG.haptic("success");

      App.profile.xp += result.xp_earned;
      App.profile.level = result.new_level;
      App.profile.streak_days = result.streak_days;

      this.reset();
      Screens.show("home");
      Home.celebrate(result.xp_earned, result.new_achievements.length);
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};

// ============================================================
// ИИ-генерация тренировки под самочувствие/оборудование
// ============================================================
const AI = {
  openGenerator() {
    document.getElementById("ai-generate-modal").classList.remove("hidden");
    requestAnimationFrame(() => document.getElementById("ai-generate-modal").classList.add("modal-open"));
  },

  closeGenerator() {
    const m = document.getElementById("ai-generate-modal");
    m.classList.remove("modal-open");
    setTimeout(() => m.classList.add("hidden"), 200);
  },

  selectPill(group, value, btn) {
    TG.haptic("selection");
    document.querySelectorAll(`.pill-${group}`).forEach((b) => b.classList.remove("chip-active"));
    btn.classList.add("chip-active");
    this[`_${group}`] = value;
  },

  async generate() {
    const location = this._location || "gym";
    const feeling = this._feeling || "normal";

    try {
      TG.haptic("medium");
      const res = await API.post("/api/plans/ai/generate-workout", { location, feeling });
      Workouts.reset();
      Workouts.entries = res.exercises.map((e) => ({
        exercise_id: e.exercise_id,
        exercise_name: `${e.exercise_name} · ${e.recommended_sets}×${e.recommended_reps}`,
        sets: Array.from({ length: e.recommended_sets }, () => ({ weight: 0, reps: 0 })),
      }));
      this.closeGenerator();
      Screens.show("workout-log");
      Workouts.render();
      TG.haptic("success");
    } catch (e) {
      TG.showAlert("Ошибка ИИ-генерации: " + e.message);
    }
  },
};
