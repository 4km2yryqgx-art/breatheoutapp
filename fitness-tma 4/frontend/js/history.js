// ============================================================
// История тренировок + календарь + детальный просмотр/редактирование
// ============================================================
const History = {
  workouts: [],
  editingWorkout: null,
  pendingDeleteId: null,

  async load() {
    const [workouts, calendar] = await Promise.all([
      API.get("/api/workouts"),
      API.get("/api/workouts/calendar"),
    ]);
    this.workouts = workouts;
    this.renderCalendar(calendar);
    this.renderList(workouts);
    window.lucide?.createIcons();
  },

  renderCalendar(calendar) {
    const dates = new Set(calendar.map((c) => c.date));
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

    let html = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
      .map((d) => `<div class="text-[10px] text-tg-hint text-center font-medium">${d}</div>`).join("");
    for (let i = 0; i < firstWeekday; i++) html += `<div></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const active = dates.has(dateStr);
      const isToday = dateStr === now.toISOString().slice(0, 10);
      html += `<div class="calendar-day text-center text-xs py-1.5 rounded-full ${active ? 'bg-accent text-black font-bold' : 'text-tg-text/70'} ${isToday && !active ? 'ring-1 ring-accent' : ''}">${d}</div>`;
    }
    document.getElementById("history-calendar").innerHTML = html;
  },

  renderList(workouts) {
    const list = document.getElementById("history-list");
    if (workouts.length === 0) {
      list.innerHTML = `<div class="text-center py-10 text-tg-hint">
        <i data-lucide="calendar-x" class="w-9 h-9 mx-auto mb-2 opacity-40"></i>
        <p class="text-sm">Пока нет записанных тренировок</p></div>`;
      return;
    }
    list.innerHTML = workouts.map((w, i) => `
      <button onclick="History.openDetail(${w.id})" class="w-full text-left glass-card-flat rounded-2xl p-4 animate-in active-press" style="animation-delay:${Math.min(i * 40, 400)}ms">
        <div class="flex justify-between items-start">
          <div class="min-w-0">
            <p class="font-semibold text-sm truncate">${w.title || "Тренировка"}</p>
            <p class="text-xs text-tg-hint mt-0.5">${w.entries.length} упражнений · нажми для деталей</p>
          </div>
          <div class="text-right shrink-0 pl-2">
            <p class="text-xs text-tg-hint">${w.date}</p>
            <p class="text-xs text-accent font-semibold mt-0.5">+${w.xp_earned} XP</p>
          </div>
        </div>
      </button>
    `).join("");
  },

  openDetail(id) {
    const w = this.workouts.find((x) => x.id === id);
    if (!w) return;
    TG.haptic("light");
    this.editingWorkout = JSON.parse(JSON.stringify(w));

    document.getElementById("history-detail-title").textContent = w.title || "Тренировка";
    document.getElementById("history-detail-date").textContent = w.date;
    this.renderDetailEntries();

    const modal = document.getElementById("history-detail-modal");
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("modal-open"));
  },

  renderDetailEntries() {
    const container = document.getElementById("history-detail-entries");
    container.innerHTML = this.editingWorkout.entries.map((entry, ei) => `
      <div class="glass-card rounded-2xl p-3">
        <p class="font-semibold text-sm mb-2">${entry.exercise_name}</p>
        <div class="space-y-1.5">
          ${entry.sets.map((s, si) => `
            <div class="flex gap-2 items-center text-sm">
              <span class="w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">${si + 1}</span>
              <input type="number" value="${s.weight}" oninput="History.updateSet(${ei},${si},'weight',this.value)" class="input-field flex-1 !py-1.5">
              <span class="text-tg-hint text-xs">×</span>
              <input type="number" value="${s.reps}" oninput="History.updateSet(${ei},${si},'reps',this.value)" class="input-field flex-1 !py-1.5">
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  },

  updateSet(entryIndex, setIndex, field, value) {
    this.editingWorkout.entries[entryIndex].sets[setIndex][field] = parseFloat(value) || 0;
  },

  closeDetail() {
    const modal = document.getElementById("history-detail-modal");
    modal.classList.remove("modal-open");
    setTimeout(() => modal.classList.add("hidden"), 200);
    this.editingWorkout = null;
  },

  async saveEdit() {
    if (!this.editingWorkout) return;
    try {
      await API.put(`/api/workouts/${this.editingWorkout.id}`, {
        title: this.editingWorkout.title,
        entries: this.editingWorkout.entries.map((e) => ({
          exercise_id: e.exercise_id, exercise_name: e.exercise_name, sets: e.sets,
        })),
      });
      TG.haptic("success");
      this.closeDetail();
      await this.load();
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },

  confirmDelete() {
    this.pendingDeleteId = this.editingWorkout?.id;
    const modal = document.getElementById("confirm-delete-modal");
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("modal-open"));
  },

  cancelDelete() {
    const modal = document.getElementById("confirm-delete-modal");
    modal.classList.remove("modal-open");
    setTimeout(() => modal.classList.add("hidden"), 200);
    this.pendingDeleteId = null;
  },

  async performDelete() {
    if (!this.pendingDeleteId) return;
    try {
      await API.del(`/api/workouts/${this.pendingDeleteId}`);
      TG.haptic("success");
      this.cancelDelete();
      this.closeDetail();
      await this.load();
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
