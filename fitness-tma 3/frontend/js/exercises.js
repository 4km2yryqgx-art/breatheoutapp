// ============================================================
// База упражнений: список, фильтры, поиск, добавление своих
// ============================================================
const Exercises = {
  all: [],
  muscleGroups: [],
  activeGroup: null,

  async load() {
    if (this.muscleGroups.length === 0) {
      this.muscleGroups = await API.get("/api/exercises/muscle-groups");
      this.renderFilters();
    }
    await this.search();
  },

  renderFilters() {
    const el = document.getElementById("muscle-filters");
    el.innerHTML = `<button class="chip ${!this.activeGroup ? 'chip-active' : ''}" onclick="Exercises.setGroup(null)">Все</button>` +
      this.muscleGroups.map((g) =>
        `<button class="chip ${this.activeGroup === g.code ? 'chip-active' : ''}" onclick="Exercises.setGroup('${g.code}')">${g.label}</button>`
      ).join("");
  },

  setGroup(code) {
    TG.haptic("selection");
    this.activeGroup = code;
    this.renderFilters();
    this.search();
  },

  async search() {
    const q = document.getElementById("exercise-search").value;
    let path = "/api/exercises?";
    if (q) path += `search=${encodeURIComponent(q)}&`;
    if (this.activeGroup) path += `muscle_group=${this.activeGroup}&`;
    this.all = await API.get(path);
    this.render();
  },

  render() {
    const list = document.getElementById("exercises-list");
    if (this.all.length === 0) {
      list.innerHTML = `<div class="text-center py-10 text-tg-hint">
        <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
        <p class="text-sm">Ничего не найдено</p></div>`;
      window.lucide?.createIcons();
      return;
    }
    list.innerHTML = this.all.map((e, i) => `
      <div class="glass-card-flat rounded-2xl p-3 flex items-center gap-3 animate-in" style="animation-delay:${Math.min(i * 25, 400)}ms">
        <div class="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <i data-lucide="${muscleIcon(e.muscle_group)}" class="w-5 h-5 text-accent"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-sm truncate">${e.name}</p>
          <p class="text-xs text-tg-hint">${equipmentLabel(e.equipment)}${e.is_custom ? ' · своё' : ''}</p>
        </div>
      </div>
    `).join("");
    window.lucide?.createIcons();
  },

  openAddModal() {
    document.getElementById("add-exercise-modal").classList.remove("hidden");
    requestAnimationFrame(() => document.getElementById("add-exercise-modal").classList.add("modal-open"));
    const groupSelect = document.getElementById("new-ex-group");
    groupSelect.innerHTML = this.muscleGroups.map((g) => `<option value="${g.code}">${g.label}</option>`).join("");
  },

  closeAddModal() {
    const m = document.getElementById("add-exercise-modal");
    m.classList.remove("modal-open");
    setTimeout(() => m.classList.add("hidden"), 200);
  },

  async submitNew() {
    const name = document.getElementById("new-ex-name").value.trim();
    const muscle_group = document.getElementById("new-ex-group").value;
    const equipment = document.getElementById("new-ex-equipment").value;
    if (!name) { TG.showAlert("Введи название упражнения"); return; }

    try {
      await API.post("/api/exercises", { name, muscle_group, equipment });
      TG.haptic("success");
      document.getElementById("new-ex-name").value = "";
      this.closeAddModal();
      this.search();
    } catch (e) {
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
