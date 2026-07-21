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
  },

  openExercisePicker() {
    Modal.openPicker((ex) => {
      if (!this.selectedExerciseIds.includes(ex.id)) {
        this.selectedExerciseIds.push(ex.id);
        this.renderSelected();
      }
      // Позволяем выбрать ещё — открываем модалку снова
      this.openExercisePicker();
    });
  },

  renderSelected() {
    const names = this.selectedExerciseIds.map(id => {
      const ex = Modal.cachedExercises.find(e => e.id === id);
      return ex ? ex.name : id;
    });
    document.getElementById("plan-selected-exercises").textContent =
      names.length ? `Выбрано: ${names.join(", ")}` : "Ничего не выбрано";
  },

  async saveDay() {
    const name = document.getElementById("plan-day-name").value;
    if (!name || this.selectedExerciseIds.length === 0) {
      TG.showAlert("Укажи название и выбери хотя бы одно упражнение");
      return;
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
      list.innerHTML = `<p class="text-tg-hint text-sm">Дней ещё нет</p>`;
      return;
    }
    list.innerHTML = this.trainingDays.map(d => `
      <div class="bg-tg-secondary rounded-xl p-3 flex justify-between items-center">
        <span class="text-sm font-medium">${d.name}</span>
        <button onclick="Plans.deleteDay(${d.id})" class="text-tg-hint text-lg leading-none">&times;</button>
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
    schedule.forEach(s => scheduleMap[s.weekday] = s.training_day_id);

    const el = document.getElementById("plans-schedule");
    el.innerHTML = this.weekdayLabels.map((label, i) => `
      <div class="bg-tg-secondary rounded-xl p-3 flex justify-between items-center">
        <span class="text-sm">${label}</span>
        <select onchange="Plans.setScheduleDay(${i}, this.value)"
          class="bg-black/20 rounded-lg text-sm p-2">
          <option value="">Отдых</option>
          ${this.trainingDays.map(d => `
            <option value="${d.id}" ${scheduleMap[i] === d.id ? "selected" : ""}>${d.name}</option>
          `).join("")}
        </select>
      </div>
    `).join("");
  },

  async setScheduleDay(weekday, trainingDayId) {
    TG.haptic("selection");
    await API.post("/api/plans/schedule", {
      weekday, training_day_id: trainingDayId ? parseInt(trainingDayId) : null,
    });
  },

  async aiSuggestWeek() {
    try {
      const res = await API.get("/api/plans/ai/suggest-week");
      const text = res.plan.map(p => `День ${p.day_index + 1}: ${p.name}`).join("\n");
      TG.showAlert(`🤖 ИИ предлагает:\n\n${text}\n\nСоздай эти дни через конструктор и настрой расписание вручную.`);
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
