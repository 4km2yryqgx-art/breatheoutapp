// ============================================================
// История тренировок + календарь текущего месяца
// ============================================================
const History = {
  async load() {
    const [workouts, calendar] = await Promise.all([
      API.get("/api/workouts"),
      API.get("/api/workouts/calendar"),
    ]);
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
      <div class="glass-card-flat rounded-2xl p-4 animate-in" style="animation-delay:${Math.min(i * 40, 400)}ms">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-semibold text-sm">${w.title || "Тренировка"}</p>
            <p class="text-xs text-tg-hint mt-0.5">${w.entries.length} упражнений</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-xs text-tg-hint">${w.date}</p>
            <p class="text-xs text-accent font-semibold mt-0.5">+${w.xp_earned} XP</p>
          </div>
        </div>
      </div>
    `).join("");
  },
};
