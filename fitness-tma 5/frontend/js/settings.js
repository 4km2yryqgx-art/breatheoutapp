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

  openAssignPlan(studentId) {
    this._assignStudentId = studentId;
    this._assignDays = [];
    this._daySelectedIds = [];
    document.getElementById("coach-day-name").value = "";
    this.renderDaySelected();
    this.renderAssignDaysList();

    const modal = document.getElementById("coach-assign-modal");
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("modal-open"));
  },

  closeAssignModal() {
    const m = document.getElementById("coach-assign-modal");
    m.classList.remove("modal-open");
    setTimeout(() => m.classList.add("hidden"), 200);
  },

  pickExerciseForDay() {
    Modal.openPicker((ex) => {
      if (!this._daySelectedIds.includes(ex.id)) {
        this._daySelectedIds.push(ex.id);
        this.renderDaySelected();
      }
      // Сразу открываем модалку снова — удобно набирать несколько упражнений подряд
      this.pickExerciseForDay();
    });
  },

  renderDaySelected() {
    const box = document.getElementById("coach-day-selected");
    if (this._daySelectedIds.length === 0) {
      box.innerHTML = `<p class="text-xs text-tg-hint">Упражнения ещё не выбраны</p>`;
      return;
    }
    box.innerHTML = this._daySelectedIds.map((id) => {
      const ex = Modal.cachedExercises.find((e) => e.id === id);
      return `<span class="chip chip-active inline-flex items-center gap-1">${ex ? ex.name : id}
        <i data-lucide="x" class="w-3 h-3" onclick="Coach.removeDaySelected(${id}, event)"></i></span>`;
    }).join("");
    window.lucide?.createIcons();
  },

  removeDaySelected(id, event) {
    event.stopPropagation();
    this._daySelectedIds = this._daySelectedIds.filter((x) => x !== id);
    this.renderDaySelected();
  },

  confirmAddDay() {
    const name = document.getElementById("coach-day-name").value.trim();
    if (!name || this._daySelectedIds.length === 0) {
      TG.showAlert("Укажи название дня и выбери хотя бы одно упражнение");
      return;
    }
    TG.haptic("success");
    this._assignDays.push({ name, exercise_ids: [...this._daySelectedIds] });
    this._daySelectedIds = [];
    document.getElementById("coach-day-name").value = "";
    this.renderDaySelected();
    this.renderAssignDaysList();
  },

  renderAssignDaysList() {
    const list = document.getElementById("coach-assign-days-list");
    if (this._assignDays.length === 0) {
      list.innerHTML = `<p class="text-xs text-tg-hint">Пока ни одного дня не добавлено</p>`;
      return;
    }
    list.innerHTML = this._assignDays.map((d, i) => `
      <div class="glass-card-flat rounded-xl p-3 flex justify-between items-center">
        <span class="text-sm font-medium">${d.name} <span class="text-tg-hint">· ${d.exercise_ids.length} упр.</span></span>
        <button onclick="Coach.removeAssignDay(${i})" class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
          <i data-lucide="trash-2" class="w-3.5 h-3.5 text-tg-hint"></i>
        </button>
      </div>
    `).join("");
    window.lucide?.createIcons();
  },

  removeAssignDay(index) {
    TG.haptic("light");
    this._assignDays.splice(index, 1);
    this.renderAssignDaysList();
  },

  async submitAssignPlan() {
    if (this._assignDays.length === 0) {
      TG.showAlert("Добавь хотя бы один день в план");
      return;
    }
    try {
      await API.post(`/api/coach/students/${this._assignStudentId}/assign-week`, {
        training_days: this._assignDays,
      });
      TG.haptic("success");
      this.closeAssignModal();
      this.closeProgress();
      TG.showAlert(`План из ${this._assignDays.length} дн. отправлен ученику! Он получит уведомление в боте.`);
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
