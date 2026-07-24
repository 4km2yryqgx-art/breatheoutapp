// ============================================================
// Дневник тренировок: запись подходов, таймер отдыха, автосейв,
// личный рекорд под названием упражнения, сохранение
// ============================================================
const Workouts = {
  entries: [],
  timerInterval: null,
  timerTotal: 0,
  draftSaveTimeout: null,

  reset() {
    this.entries = [];
    document.getElementById("workout-title").value = "";
    clearInterval(this.timerInterval);
    document.getElementById("rest-timer").classList.add("hidden");
    this.render();
  },

  // ============================================================
  // Автосейв черновика: debounce 1.2с после любого изменения
  // ============================================================
  scheduleDraftSave() {
    clearTimeout(this.draftSaveTimeout);
    this.draftSaveTimeout = setTimeout(() => this.saveDraftNow(), 1200);
  },

  async saveDraftNow() {
    if (this.entries.length === 0) return;
    try {
      await API.put("/api/workouts/draft", {
        title: document.getElementById("workout-title")?.value || "",
        entries: this.entries.map((e) => ({
          exercise_id: e.exercise_id, exercise_name: e.exercise_name, sets: e.sets,
        })),
      });
    } catch (e) { /* автосейв тихий, не мешаем тренировке ошибками сети */ }
  },

  async checkDraftOnStart() {
    try {
      const draft = await API.get("/api/workouts/draft");
      if (draft && draft.entries?.length > 0) {
        this._pendingDraft = draft;
        const modal = document.getElementById("draft-restore-modal");
        modal.classList.remove("hidden");
        requestAnimationFrame(() => modal.classList.add("modal-open"));
      }
    } catch (e) { /* нет черновика — и ладно */ }
  },

  resumeDraft() {
    TG.haptic("success");
    const draft = this._pendingDraft;
    this._closeDraftModal();
    if (!draft) return;
    this.entries = draft.entries.map((e) => ({ ...e }));
    document.getElementById("workout-title").value = draft.title || "";
    Screens.show("workout-log");
    this.render();
  },

  async discardDraft() {
    TG.haptic("light");
    this._closeDraftModal();
    try { await API.del("/api/workouts/draft"); } catch (e) {}
  },

  _closeDraftModal() {
    const modal = document.getElementById("draft-restore-modal");
    modal.classList.remove("modal-open");
    setTimeout(() => modal.classList.add("hidden"), 200);
  },

  // ============================================================
  // Запуск тренировки: сегодня по расписанию / выбранный день плана / с нуля
  // ============================================================
  async openStartModal() {
    // Сначала проверяем дневной лимит — если исчерпан, даже не открываем выбор
    try {
      const limitInfo = await API.get("/api/workouts/today-count");
      if (limitInfo.reached) {
        TG.haptic("error");
        TG.showAlert("Вы уже выполнили 2 тренировки сегодня. Мы не рекомендуем тренироваться больше ради вашей безопасности и эффективности.");
        return;
      }
    } catch (e) { /* если проверка не удалась — не блокируем, сервер всё равно защитит */ }

    let days = [];
    let schedule = [];
    try {
      [days, schedule] = await Promise.all([
        API.get("/api/plans/training-days"),
        API.get("/api/plans/schedule"),
      ]);
    } catch (e) {
      TG.showAlert("Ошибка загрузки планов: " + e.message);
      return;
    }
    this._cachedDays = days;

    const todayWeekday = (new Date().getDay() + 6) % 7;
    const todayEntry = schedule.find((s) => s.weekday === todayWeekday && s.training_day_id);
    const todayDay = todayEntry ? days.find((d) => d.id === todayEntry.training_day_id) : null;

    let html = "";
    if (todayDay) {
      html += `
        <button class="w-full btn-primary mb-4" onclick="Workouts.startFromDay(${todayDay.id})">
          <i data-lucide="calendar-check" class="w-5 h-5"></i> Сегодня по плану: ${todayDay.name}
        </button>`;
    }
    if (days.length > 0) {
      html += `<p class="text-xs text-tg-hint mb-2 font-medium">Выбрать день из плана</p>
        <div class="space-y-2 mb-4">` + days.map((d) => `
          <button class="w-full text-left glass-card-flat rounded-2xl p-3 flex items-center gap-3 active-press" onclick="Workouts.startFromDay(${d.id})">
            <div class="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <i data-lucide="dumbbell" class="w-4 h-4 text-accent"></i>
            </div>
            <span class="text-sm font-medium">${d.name}</span>
          </button>`).join("") + `</div>`;
    } else {
      html += `<div class="glass-card-flat rounded-2xl p-4 text-center text-tg-hint text-sm mb-4">
        У тебя ещё нет сохранённых дней тренировки. Создай их в разделе «Планы» — и здесь появится быстрый запуск по шаблону.
      </div>`;
    }
    html += `<button class="w-full btn-secondary" onclick="Workouts.startEmpty()">
      <i data-lucide="plus" class="w-5 h-5"></i> Тренировка с нуля
    </button>`;

    document.getElementById("start-workout-content").innerHTML = html;
    const modal = document.getElementById("start-workout-modal");
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("modal-open"));
    window.lucide?.createIcons();
  },

  closeStartModal() {
    const modal = document.getElementById("start-workout-modal");
    modal.classList.remove("modal-open");
    setTimeout(() => modal.classList.add("hidden"), 200);
  },

  startEmpty() {
    TG.haptic("medium");
    this.closeStartModal();
    this.reset();
    Screens.show("workout-log");
  },

  async startFromDay(dayId) {
    TG.haptic("success");
    let day = (this._cachedDays || []).find((d) => d.id === dayId);
    if (!day) {
      try {
        const days = await API.get("/api/plans/training-days");
        this._cachedDays = days;
        day = days.find((d) => d.id === dayId);
      } catch (e) {
        TG.showAlert("Ошибка: " + e.message);
        return;
      }
    }
    if (!day) { TG.showAlert("День плана не найден"); return; }

    if (Modal.cachedExercises.length === 0) {
      Modal.cachedExercises = await API.get("/api/exercises");
    }

    this.entries = day.exercise_ids.map((id) => {
      const ex = Modal.cachedExercises.find((e) => e.id === id);
      const isCardio = ex?.muscle_group === "cardio";
      return {
        exercise_id: id, exercise_name: ex ? ex.name : `Упражнение #${id}`, muscle_group: ex?.muscle_group,
        sets: [isCardio ? { speed: 0, duration: 0 } : { weight: 0, reps: 0 }],
      };
    });

    document.getElementById("workout-title").value = day.name;
    this.closeStartModal();
    Screens.show("workout-log");
    this.render();
    this.loadPRsForEntries();
  },

  openExercisePicker() {
    Modal.openPicker((ex) => {
      TG.haptic("success");
      const isCardio = ex.muscle_group === "cardio";
      this.entries.push({
        exercise_id: ex.id, exercise_name: ex.name, muscle_group: ex.muscle_group,
        sets: [isCardio ? { speed: 0, duration: 0 } : { weight: 0, reps: 0 }],
      });
      this.render();
      this.loadPRForEntry(this.entries.length - 1, ex.id);
      this.scheduleDraftSave();
    });
  },

  // Подгружает личный рекорд для каждого упражнения (не блокирует рендер)
  async loadPRsForEntries() {
    this.entries.forEach((entry, i) => this.loadPRForEntry(i, entry.exercise_id));
  },

  async loadPRForEntry(index, exerciseId) {
    try {
      const pr = await API.get(`/api/exercises/${exerciseId}/pr`);
      if (this.entries[index]) {
        this.entries[index].pr = pr;
        this.render();
      }
    } catch (e) { /* нет истории — ничего страшного */ }
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
    container.innerHTML = this.entries.map((entry, ei) => {
      const isCardio = entry.muscle_group === "cardio";
      const prLine = entry.pr?.has_history
        ? (entry.pr.is_cardio
            ? `<p class="text-[11px] text-accent/90 mb-3 flex items-center gap-1"><i data-lucide="trophy" class="w-3 h-3"></i>
                Рекорд: ${entry.pr.best_speed} км/ч, ${entry.pr.best_duration} мин · сессий: ${entry.pr.total_sessions}</p>`
            : `<p class="text-[11px] text-accent/90 mb-3 flex items-center gap-1"><i data-lucide="trophy" class="w-3 h-3"></i>
                Рекорд: ${entry.pr.best_weight} кг × ${entry.pr.best_reps} повт. · всего подходов: ${entry.pr.total_sets}</p>`)
        : `<div class="mb-2"></div>`;

      const setsHtml = entry.sets.map((s, si) => isCardio ? `
        <div class="flex gap-2 items-center text-sm">
          <span class="w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0">${si + 1}</span>
          <input type="number" inputmode="decimal" value="${s.speed || ''}" placeholder="км/ч"
            oninput="Workouts.updateSet(${ei},${si},'speed',this.value)" class="input-field flex-1">
          <i data-lucide="gauge" class="w-3.5 h-3.5 text-tg-hint shrink-0"></i>
          <input type="number" inputmode="numeric" value="${s.duration || ''}" placeholder="мин"
            oninput="Workouts.updateSet(${ei},${si},'duration',this.value)" class="input-field flex-1">
          <button onclick="Workouts.removeSet(${ei},${si})" class="text-tg-hint shrink-0"><i data-lucide="minus-circle" class="w-4 h-4"></i></button>
        </div>` : `
        <div class="flex gap-2 items-center text-sm">
          <span class="w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0">${si + 1}</span>
          <input type="number" inputmode="decimal" value="${s.weight || ''}" placeholder="кг"
            oninput="Workouts.updateSet(${ei},${si},'weight',this.value)" class="input-field flex-1">
          <i data-lucide="x" class="w-3.5 h-3.5 text-tg-hint shrink-0"></i>
          <input type="number" inputmode="numeric" value="${s.reps || ''}" placeholder="повт."
            oninput="Workouts.updateSet(${ei},${si},'reps',this.value)" class="input-field flex-1">
          <button onclick="Workouts.removeSet(${ei},${si})" class="text-tg-hint shrink-0"><i data-lucide="minus-circle" class="w-4 h-4"></i></button>
        </div>`).join("");

      return `
      <div class="glass-card rounded-2xl p-4 animate-in">
        <div class="flex justify-between items-center mb-1">
          <p class="font-semibold text-sm flex items-center gap-1.5">
            ${isCardio ? '<i data-lucide="heart-pulse" class="w-3.5 h-3.5 text-accent"></i>' : ''}${entry.exercise_name}
          </p>
          <button onclick="Workouts.removeEntry(${ei})" class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center active-press">
            <i data-lucide="x" class="w-4 h-4 text-tg-hint"></i>
          </button>
        </div>
        ${prLine}
        <div class="space-y-2">${setsHtml}</div>
        <button onclick="Workouts.addSet(${ei})" class="text-accent text-xs mt-3 font-semibold flex items-center gap-1 active-press">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i> ${isCardio ? "Интервал" : "Подход"}
        </button>
      </div>`;
    }).join("");
    window.lucide?.createIcons();
  },

  addSet(entryIndex) {
    TG.haptic("light");
    const entry = this.entries[entryIndex];
    const isCardio = entry.muscle_group === "cardio";
    const last = entry.sets.at(-1) || (isCardio ? { speed: 0, duration: 0 } : { weight: 0, reps: 0 });
    entry.sets.push(isCardio ? { speed: last.speed, duration: last.duration } : { weight: last.weight, reps: last.reps });
    this.render();
    this.scheduleDraftSave();
  },

  removeSet(entryIndex, setIndex) {
    TG.haptic("light");
    const entry = this.entries[entryIndex];
    entry.sets.splice(setIndex, 1);
    if (entry.sets.length === 0) {
      entry.sets.push(entry.muscle_group === "cardio" ? { speed: 0, duration: 0 } : { weight: 0, reps: 0 });
    }
    this.render();
    this.scheduleDraftSave();
  },

  updateSet(entryIndex, setIndex, field, value) {
    this.entries[entryIndex].sets[setIndex][field] = parseFloat(value) || 0;
    this.scheduleDraftSave();
  },

  removeEntry(entryIndex) {
    TG.haptic("light");
    this.entries.splice(entryIndex, 1);
    this.render();
    this.scheduleDraftSave();
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
    if (this._saving) return; // защита от двойного тапа
    if (this.entries.length === 0) { TG.showAlert("Добавь хотя бы одно упражнение"); return; }

    const payload = {
      date: new Date().toISOString().slice(0, 10),
      title: document.getElementById("workout-title").value || "Тренировка",
      entries: this.entries.map((e) => ({ exercise_id: e.exercise_id, exercise_name: e.exercise_name, sets: e.sets })),
      local_hour: new Date().getHours(),
    };

    this._saving = true;
    const btn = document.getElementById("save-workout-btn");
    if (btn) { btn.disabled = true; btn.classList.add("opacity-50"); btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Сохраняем...`; window.lucide?.createIcons(); }

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
    } finally {
      this._saving = false;
      if (btn) { btn.disabled = false; btn.classList.remove("opacity-50"); btn.innerHTML = `<i data-lucide="check-circle-2" class="w-5 h-5"></i> Завершить и сохранить`; window.lucide?.createIcons(); }
    }
  },
};

// ============================================================
// ИИ-генерация тренировки под цель анкеты/самочувствие/оборудование
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
      Workouts.entries = res.exercises.map((e) => {
        const isCardio = e.muscle_group === "cardio";
        return {
          exercise_id: e.exercise_id, muscle_group: e.muscle_group,
          exercise_name: isCardio ? `${e.exercise_name} · 10 мин` : `${e.exercise_name} · ${e.recommended_sets}×${e.recommended_reps}`,
          sets: isCardio
            ? [{ speed: 0, duration: 10 }]
            : Array.from({ length: e.recommended_sets }, () => ({ weight: 0, reps: 0 })),
        };
      });
      this.closeGenerator();
      Screens.show("workout-log");
      Workouts.render();
      Workouts.loadPRsForEntries();
      TG.haptic("success");
    } catch (e) {
      TG.showAlert("Ошибка ИИ-генерации: " + e.message);
    }
  },
};
