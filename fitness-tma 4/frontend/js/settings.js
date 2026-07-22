// ============================================================
// Настройки: смена цели, БАДы, Кабинет тренера
// ============================================================
const Settings = {
  async load() {
    const p = App.profile;
    document.querySelectorAll(".goal-btn").forEach((b) => b.classList.toggle("chip-active", b.dataset.goal === p.goal));

    document.getElementById("supplements-toggle").classList.toggle("toggle-on", !p.hide_supplements_tips);
    await this.renderSupplements();

    if (p.is_coach) {
      document.getElementById("coach-enable-block").classList.add("hidden");
      document.getElementById("coach-panel").classList.remove("hidden");
      await Coach.loadStudents();
    } else {
      document.getElementById("coach-enable-block").classList.remove("hidden");
      document.getElementById("coach-panel").classList.add("hidden");
    }
    window.lucide?.createIcons();
  },

  async changeGoal(goal) {
    TG.haptic("medium");
    try {
      App.profile = await API.put("/api/profile/change-goal", { goal });
      TG.haptic("success");
      document.querySelectorAll(".goal-btn").forEach((b) => b.classList.toggle("chip-active", b.dataset.goal === goal));
      Home.toast("Цель обновлена — калории и БЖУ пересчитаны");
      Home.render();
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },

  async toggleSupplements() {
    TG.haptic("selection");
    const newValue = !App.profile.hide_supplements_tips;
    App.profile = await API.put("/api/profile/settings", { hide_supplements_tips: newValue });
    document.getElementById("supplements-toggle").classList.toggle("toggle-on", !App.profile.hide_supplements_tips);
    await this.renderSupplements();
  },

  async renderSupplements() {
    const box = document.getElementById("supplements-section");
    const p = App.profile;

    if (p.hide_supplements_tips) { box.classList.add("hidden"); box.innerHTML = ""; return; }

    if (!p.is_premium) {
      box.classList.remove("hidden");
      box.innerHTML = `
        <div class="relative rounded-2xl overflow-hidden">
          <div class="blur-[6px] opacity-40 pointer-events-none select-none glass-card rounded-2xl p-4">
            <p class="font-semibold text-sm mb-2">Спортивный нутрициолог</p>
            <p class="text-xs text-tg-hint">Креатин, протеин, электролиты — что и когда пить</p>
          </div>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <p class="text-xs text-tg-hint mb-2">Доступно с Premium</p>
            <button onclick="Screens.show('premium')" class="btn-gold !w-auto px-5 text-sm"><i data-lucide="star" class="w-4 h-4"></i> Активировать</button>
          </div>
        </div>`;
      window.lucide?.createIcons();
      return;
    }

    try {
      const tips = await API.get("/api/profile/supplements-tips");
      box.classList.remove("hidden");
      box.innerHTML = `
        <div class="glass-card rounded-2xl p-4 animate-in">
          <p class="font-bold text-sm mb-1 flex items-center gap-2"><i data-lucide="flask-conical" class="w-4 h-4 text-accent"></i> Спортивный нутрициолог</p>
          <p class="text-[11px] text-tg-hint mb-3">${tips.disclaimer}</p>
          ${tips.sections.map((s) => `
            <div class="mb-3 last:mb-0">
              <p class="font-semibold text-xs text-accent mb-1">${s.title}</p>
              <ul class="text-xs text-tg-hint space-y-1 list-disc list-inside">
                ${s.tips.map((t) => `<li>${t}</li>`).join("")}
              </ul>
            </div>
          `).join("")}
        </div>`;
      window.lucide?.createIcons();
    } catch (e) {
      box.classList.add("hidden");
    }
  },
};

// ============================================================
// Кабинет тренера
// ============================================================
const Coach = {
  students: [],

  async enable() {
    TG.haptic("medium");
    await API.post("/api/coach/enable");
    App.profile.is_coach = true;
    TG.haptic("success");
    Settings.load();
  },

  async invite() {
    const username = document.getElementById("coach-invite-username").value.trim();
    if (!username) return;
    try {
      const res = await API.post("/api/coach/invite", { username });
      TG.haptic("success");
      TG.showAlert(res.message);
      document.getElementById("coach-invite-username").value = "";
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },

  async loadStudents() {
    this.students = await API.get("/api/coach/students");
    const list = document.getElementById("coach-students-list");
    if (this.students.length === 0) {
      list.innerHTML = `<p class="text-xs text-tg-hint">Учеников пока нет — пригласи первого выше</p>`;
      return;
    }
    list.innerHTML = this.students.map((s) => `
      <button onclick="Coach.openProgress(${s.student_id})" class="w-full text-left glass-card-flat rounded-xl p-3 flex items-center justify-between active-press">
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">${s.nickname}${s.username ? ` <span class="text-tg-hint">@${s.username}</span>` : ""}</p>
          <p class="text-[11px] text-tg-hint">Уровень ${s.level} · 🔥 ${s.streak_days} дн.</p>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-tg-hint shrink-0"></i>
      </button>
    `).join("");
    window.lucide?.createIcons();
  },

  async openProgress(studentId) {
    TG.haptic("light");
    const data = await API.get(`/api/coach/students/${studentId}/progress`);
    document.getElementById("coach-progress-name").textContent = data.profile.nickname || "Ученик";

    const recentHtml = data.recent_workouts.length
      ? data.recent_workouts.map((w) => `
          <div class="glass-card-flat rounded-xl p-3 flex justify-between text-sm">
            <span>${w.title || "Тренировка"} · ${w.exercises_count} упр.</span>
            <span class="text-tg-hint">${w.date}</span>
          </div>`).join("")
      : `<p class="text-xs text-tg-hint">Ученик ещё не записывал тренировки</p>`;

    document.getElementById("coach-progress-content").innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        <div class="glass-card-flat rounded-xl p-3"><p class="text-xs text-tg-hint">Уровень</p><p class="text-lg font-bold">${data.profile.level}</p></div>
        <div class="glass-card-flat rounded-xl p-3"><p class="text-xs text-tg-hint">Тоннаж</p><p class="text-lg font-bold">${data.profile.total_volume_kg} кг</p></div>
        <div class="glass-card-flat rounded-xl p-3"><p class="text-xs text-tg-hint">Серия</p><p class="text-lg font-bold">${data.profile.streak_days} дн.</p></div>
        <div class="glass-card-flat rounded-xl p-3"><p class="text-xs text-tg-hint">Цель</p><p class="text-lg font-bold">${data.profile.goal || "—"}</p></div>
      </div>
      <p class="font-semibold text-sm pt-2">Последние тренировки</p>
      <div class="space-y-2">${recentHtml}</div>
      <button onclick="Coach.openAssignPlan(${studentId})" class="w-full btn-primary mt-2">
        <i data-lucide="send" class="w-4 h-4"></i> Назначить план на неделю
      </button>
    `;

    document.getElementById("coach-progress-modal").classList.remove("hidden");
    requestAnimationFrame(() => document.getElementById("coach-progress-modal").classList.add("modal-open"));
    window.lucide?.createIcons();
  },

  closeProgress() {
    const m = document.getElementById("coach-progress-modal");
    m.classList.remove("modal-open");
    setTimeout(() => m.classList.add("hidden"), 200);
  },

  async openAssignPlan(studentId) {
    TG.showConfirm("Открыть конструктор и выбрать упражнения для нового дня ученика?", async (ok) => {
      if (!ok) return;
      Modal.openPicker(async (ex) => {
        const name = prompt("Название дня для ученика (напр. 'День А от тренера')", "День от тренера");
        if (!name) return;
        try {
          await API.post(`/api/coach/students/${studentId}/assign-week`, {
            training_days: [{ name, exercise_ids: [ex.id] }],
          });
          TG.haptic("success");
          TG.showAlert("План отправлен ученику! Он получит уведомление в боте.");
        } catch (e) {
          TG.showAlert("Ошибка: " + e.message);
        }
      });
    });
  },
};
