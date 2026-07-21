// ============================================================
// История тренировок + простой календарь текущего месяца
// ============================================================
const History = {
  async load() {
    const [workouts, calendar] = await Promise.all([
      API.get("/api/workouts"),
      API.get("/api/workouts/calendar"),
    ]);
    this.renderCalendar(calendar);
    this.renderList(workouts);
  },

  renderCalendar(calendar) {
    const dates = new Set(calendar.map(c => c.date));
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Пн=0

    let html = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
      .map(d => `<div class="text-[10px] text-tg-hint text-center">${d}</div>`).join("");

    for (let i = 0; i < firstWeekday; i++) html += `<div></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const active = dates.has(dateStr);
      const isToday = dateStr === now.toISOString().slice(0, 10);
      html += `<div class="text-center text-xs py-1 rounded-full ${active ? 'bg-accent text-black font-bold' : ''} ${isToday && !active ? 'border border-accent' : ''}">${d}</div>`;
    }

    document.getElementById("history-calendar").innerHTML = html;
  },

  renderList(workouts) {
    const list = document.getElementById("history-list");
    if (workouts.length === 0) {
      list.innerHTML = `<p class="text-tg-hint text-sm text-center py-6">Пока нет записанных тренировок</p>`;
      return;
    }
    list.innerHTML = workouts.map(w => `
      <div class="bg-tg-secondary rounded-xl p-3">
        <div class="flex justify-between">
          <p class="font-semibold text-sm">${w.title || "Тренировка"}</p>
          <p class="text-xs text-tg-hint">${w.date}</p>
        </div>
        <p class="text-xs text-tg-hint mt-1">${w.entries.length} упражнений · +${w.xp_earned} XP</p>
      </div>
    `).join("");
  },
};
