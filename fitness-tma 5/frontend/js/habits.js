// ============================================================
// Планнер привычек — доступен только с Premium подпиской
// ============================================================
const Habits = {
  items: [],
  isPremium: false,

  async load() {
    const status = await API.get("/api/payment/status");
    this.isPremium = status.is_premium;

    document.getElementById("habits-locked").classList.toggle("hidden", this.isPremium);
    document.getElementById("habits-unlocked").classList.toggle("hidden", !this.isPremium);

    if (!this.isPremium) { window.lucide?.createIcons(); return; }

    this.items = await API.get("/api/habits");
    this.render();
    await this.loadCalendar();
    window.lucide?.createIcons();
  },

  render() {
    const list = document.getElementById("habits-list");
    if (this.items.length === 0) {
      list.innerHTML = `<div class="text-center py-8 text-tg-hint">
        <i data-lucide="list-checks" class="w-9 h-9 mx-auto mb-2 opacity-40"></i>
        <p class="text-sm">Добавь первую привычку ниже</p></div>`;
      window.lucide?.createIcons();
      return;
    }
    list.innerHTML = this.items.map((h, i) => `
      <div class="glass-card-flat rounded-2xl p-3 flex items-center gap-3 animate-in" style="animation-delay:${i * 40}ms">
        <button onclick="Habits.toggle(${h.id}, ${!h.done_today})" class="habit-check ${h.done_today ? 'habit-check-done' : ''} shrink-0">
          <i data-lucide="check" class="w-4 h-4"></i>
        </button>
        <div class="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <i data-lucide="${h.icon}" class="w-4 h-4 text-accent"></i>
        </div>
        <span class="flex-1 text-sm font-medium ${h.done_today ? 'line-through text-tg-hint' : ''}">${h.title}</span>
        <button onclick="Habits.remove(${h.id})" class="text-tg-hint shrink-0"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    `).join("");
    window.lucide?.createIcons();
  },

  async toggle(id, done) {
    TG.haptic(done ? "success" : "light");
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await API.post(`/api/habits/${id}/toggle`, { date: today, done });
      const habit = this.items.find((h) => h.id === id);
      if (habit) habit.done_today = done;
      this.render();
      await this.loadCalendar();
      if (res.xp_delta > 0) {
        App.profile.xp = res.xp;
        App.profile.level = res.level;
        Home.toast(`+${res.xp_delta} XP за привычку!`);
      }
      if (res.new_achievements?.length > 0) Home.toast(`🏆 Новое достижение!`);
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },

  async loadCalendar() {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const data = await API.get(`/api/habits/calendar?month=${month}`);
    document.getElementById("habits-success-percent").textContent = `${data.success_percent}%`;

    const firstWeekday = (new Date(data.year, data.month - 1, 1).getDay() + 6) % 7;
    let html = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
      .map((d) => `<div class="text-[10px] text-tg-hint text-center font-medium">${d}</div>`).join("");
    for (let i = 0; i < firstWeekday; i++) html += `<div></div>`;

    html += data.days.map((d) => {
      const dayNum = parseInt(d.date.slice(-2), 10);
      let cls = "bg-white/5 text-tg-text/60";
      if (d.total > 0) {
        if (d.is_full) cls = "bg-accent text-black font-bold";
        else if (d.done_count > 0) cls = "bg-accent/30 text-tg-text";
      }
      const clickable = !d.is_future && d.total > 0;
      return `<button ${clickable ? `onclick="Habits.toggleDay('${d.date}', ${!d.is_full})"` : "disabled"}
        class="calendar-day text-center text-xs py-1.5 rounded-full ${cls} ${d.is_future ? 'opacity-30' : ''}">${dayNum}</button>`;
    }).join("");

    document.getElementById("habits-calendar-grid").innerHTML = html;
  },

  async toggleDay(date, done) {
    TG.haptic("selection");
    // Отмечаем/снимаем ВСЕ привычки на этот день одним действием
    await Promise.all(this.items.map((h) => API.post(`/api/habits/${h.id}/toggle`, { date, done })));
    await this.loadCalendar();
    Home.toast(done ? `День ${date.slice(-2)} отмечен полностью!` : `Отметки на ${date.slice(-2)} сняты`);
  },

  async remove(id) {
    TG.showConfirm("Удалить эту привычку?", async (ok) => {
      if (!ok) return;
      await API.del(`/api/habits/${id}`);
      TG.haptic("light");
      this.load();
    });
  },

  openAddModal() {
    document.getElementById("add-habit-modal").classList.remove("hidden");
    requestAnimationFrame(() => document.getElementById("add-habit-modal").classList.add("modal-open"));
  },

  closeAddModal() {
    const m = document.getElementById("add-habit-modal");
    m.classList.remove("modal-open");
    setTimeout(() => m.classList.add("hidden"), 200);
  },

  selectIcon(icon, btn) {
    TG.haptic("selection");
    document.querySelectorAll(".habit-icon-pick").forEach((b) => b.classList.remove("chip-active"));
    btn.classList.add("chip-active");
    this._icon = icon;
  },

  async submitNew() {
    const title = document.getElementById("new-habit-title").value.trim();
    if (!title) { TG.showAlert("Введи название привычки"); return; }
    try {
      await API.post("/api/habits", { title, icon: this._icon || "sparkles" });
      TG.haptic("success");
      document.getElementById("new-habit-title").value = "";
      this.closeAddModal();
      this.load();
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
