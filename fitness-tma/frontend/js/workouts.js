// ============================================================
// Дневник тренировок: запись подходов, таймер отдыха, сохранение
// ============================================================
const Workouts = {
  entries: [], // [{exercise_id, exercise_name, sets: [{weight, reps}]}]
  timerInterval: null,

  reset() {
    this.entries = [];
    document.getElementById("workout-title").value = "";
    this.render();
  },

  openExercisePicker() {
    Modal.openPicker((ex) => {
      this.entries.push({ exercise_id: ex.id, exercise_name: ex.name, sets: [{ weight: 0, reps: 0 }] });
      this.render();
    });
  },

  render() {
    const container = document.getElementById("workout-entries");
    container.innerHTML = this.entries.map((entry, ei) => `
      <div class="bg-tg-secondary rounded-xl p-3">
        <div class="flex justify-between items-center mb-2">
          <p class="font-semibold text-sm">${entry.exercise_name}</p>
          <button onclick="Workouts.removeEntry(${ei})" class="text-tg-hint text-lg leading-none">&times;</button>
        </div>
        <div class="space-y-1">
          ${entry.sets.map((s, si) => `
            <div class="flex gap-2 items-center text-sm">
              <span class="text-tg-hint w-5">${si + 1}</span>
              <input type="number" value="${s.weight}" placeholder="кг"
                oninput="Workouts.updateSet(${ei},${si},'weight',this.value)"
                class="bg-black/20 rounded-lg p-2 w-full">
              <span class="text-tg-hint">×</span>
              <input type="number" value="${s.reps}" placeholder="повт."
                oninput="Workouts.updateSet(${ei},${si},'reps',this.value)"
                class="bg-black/20 rounded-lg p-2 w-full">
            </div>
          `).join("")}
        </div>
        <button onclick="Workouts.addSet(${ei})" class="text-accent text-xs mt-2 font-semibold">+ подход</button>
      </div>
    `).join("");
  },

  addSet(entryIndex) {
    TG.haptic("light");
    const last = this.entries[entryIndex].sets.at(-1) || { weight: 0, reps: 0 };
    this.entries[entryIndex].sets.push({ weight: last.weight, reps: last.reps });
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
    const el = document.getElementById("rest-timer");
    el.classList.remove("hidden");

    const update = () => {
      const m = Math.floor(remaining / 60).toString().padStart(2, "0");
      const s = (remaining % 60).toString().padStart(2, "0");
      el.textContent = `${m}:${s}`;
    };
    update();

    this.timerInterval = setInterval(() => {
      remaining--;
      update();
      if (remaining <= 0) {
        clearInterval(this.timerInterval);
        el.classList.add("hidden");
        TG.haptic("success");
        TG.showAlert("⏱ Отдых окончен! Погнали дальше 💪");
      }
    }, 1000);
  },

  async save() {
    if (this.entries.length === 0) {
      TG.showAlert("Добавь хотя бы одно упражнение");
      return;
    }
    const payload = {
      date: new Date().toISOString().slice(0, 10),
      title: document.getElementById("workout-title").value || "Тренировка",
      entries: this.entries,
    };

    try {
      const result = await API.post("/api/workouts", payload);
      TG.haptic("success");

      let msg = `✅ Тренировка сохранена!\n+${result.xp_earned} XP`;
      if (result.new_achievements.length > 0) {
        msg += `\n🏆 Новые достижения: ${result.new_achievements.length}`;
      }
      TG.showAlert(msg);

      this.reset();
      App.profile.xp += result.xp_earned;
      App.profile.level = result.new_level;
      App.profile.streak_days = result.streak_days;
      Screens.show("home");
      Home.render();
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};

// ============================================================
// ИИ-генерация тренировки под самочувствие / доступное оборудование
// ============================================================
const AI = {
  async generateWorkout() {
    TG.showConfirm("Где будешь тренироваться?\n(Ок = зал, Отмена = дом)", async (inGym) => {
      const location = inGym ? "gym" : "home";
      const feeling = prompt("Как самочувствие? great / normal / tired", "normal") || "normal";

      try {
        const res = await API.post("/api/plans/ai/generate-workout", { location, feeling });
        Workouts.reset();
        Workouts.entries = res.exercises.map(e => ({
          exercise_id: e.exercise_id,
          exercise_name: `${e.exercise_name} (${e.recommended_sets}×${e.recommended_reps})`,
          sets: Array.from({ length: e.recommended_sets }, () => ({ weight: 0, reps: 0 })),
        }));
        Screens.show("workout-log");
        Workouts.render();
        TG.haptic("success");
      } catch (e) {
        TG.showAlert("Ошибка ИИ-генерации: " + e.message);
      }
    });
  },
};
