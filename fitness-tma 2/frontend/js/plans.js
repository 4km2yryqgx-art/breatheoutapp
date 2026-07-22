// ============================================================
// Конструктор дней тренировки, расписание недели, ИИ-план
// ============================================================
const Plans = {
  selectedExerciseIds: [],
  trainingDays: [],
  weekdayLabels: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],

  async load() {
    this.trainingDays = await API.get("/api/plans/training-days");
    this.renderDaysList();
    await this.renderSchedule();
    window.lucide?.createIcons();
  },

  openExercisePicker() {
    Modal.openPicker((ex) => {
      if (!this.selectedExerciseIds.includes(ex.id)) {
        this.selectedExerciseIds.push(ex.id);
        this.renderSelected();
      }
      this.openExercisePicker();
    });
  },

  renderSelected() {
    const box = document.getElementById("plan-selected-exercises");
    if (this.selectedExerciseIds.length === 0) {
      box.innerHTML = `<p class="text-xs text-tg-hint">Ничего не выбрано</p>`;
      return;
    }
    box.innerHTML = this.selectedExerciseIds.map((id) => {
      const ex = Modal.cachedExercises.find((e) => e.id === id);
      return `<span class="chip chip-active inline-flex items-center gap-1 mr-1 mb-1">${ex ? ex.name : id}
        <i data-lucide="x" class="w-3 h-3" onclick="Plans.removeSelected(${id}, event)"></i></span>`;
    }).join("");
    window.lucide?.createIcons();
  },

  removeSelected(id, event) {
    event.stopPropagation();
    this.selectedExerciseIds = this.selectedExerciseIds.filter((x) => x !== id);
    this.renderSelected();
  },

  async saveDay() {
    const name = document.getElementById("plan-day-name").value.trim();
    if (!name || this.selectedExerciseIds.length === 0) {
      TG.showAlert("Укажи название и выбери хотя бы одно упражнение"); return;
    }
    try {
      await API.post("/api/plans/training-days", { name, exercise_ids: this.selectedExerciseIds });
      TG.haptic("success");
      document.getElementById("plan-day-name").value = "";
      this.selectedExerciseIds = [];
      this.renderSelected();
      await this.load();
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },

  renderDaysList() {
    const list = document.getElementById("plans-days-list");
    if (this.trainingDays.length === 0) {
      list.innerHTML = `<p class="text-tg-hint text-sm">Дней ещё нет — создай первый выше</p>`;
      return;
    }
    list.innerHTML = this.trainingDays.map((d) => `
      <div class="glass-card-flat rounded-2xl p-3 flex justify-between items-center">
        <div class="flex items-center gap-2">
          <i data-lucide="calendar-check" class="w-4 h-4 text-accent"></i>
          <span class="text-sm font-medium">${d.name}</span>
        </div>
        <button onclick="Plans.deleteDay(${d.id})" class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center active-press">
          <i data-lucide="trash-2" class="w-3.5 h-3.5 text-tg-hint"></i>
        </button>
      </div>
    `).join("");
  },

  async deleteDay(id) {
    await API.del(`/api/plans/training-days/${id}`);
    TG.haptic("light");
    await this.load();
  },

  async renderSchedule() {
    const schedule = await API.get("/api/plans/schedule");
    const scheduleMap = {};
    schedule.forEach((s) => scheduleMap[s.weekday] = s.training_day_id);

    const el = document.getElementById("plans-schedule");
    el.innerHTML = this.weekdayLabels.map((label, i) => `
      <div class="glass-card-flat rounded-2xl p-3 flex justify-between items-center">
        <span class="text-sm">${label}</span>
        <select onchange="Plans.setScheduleDay(${i}, this.value)" class="input-field text-sm w-auto py-1.5">
          <option value="">Отдых</option>
          ${this.trainingDays.map((d) => `<option value="${d.id}" ${scheduleMap[i] === d.id ? "selected" : ""}>${d.name}</option>`).join("")}
        </select>
      </div>
    `).join("");
  },

  async setScheduleDay(weekday, trainingDayId) {
    TG.haptic("selection");
    await API.post("/api/plans/schedule", { weekday, training_day_id: trainingDayId ? parseInt(trainingDayId) : null });
  },

  async aiSuggestWeek() {
    try {
      const res = await API.get("/api/plans/ai/suggest-week");
      const html = res.plan.map((p) => `
        <div class="glass-card-flat rounded-xl p-3 flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">${p.day_index + 1}</span>
          <span class="text-sm">${p.name}</span>
        </div>`).join("");
      document.getElementById("ai-week-result").innerHTML = html;
      document.getElementById("ai-week-result").classList.remove("hidden");
      TG.haptic("success");
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
