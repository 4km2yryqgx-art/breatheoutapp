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
    el.innerHTML = `<div class="muscle-chip ${!this.activeGroup ? 'active' : ''}" onclick="Exercises.setGroup(null)">Все</div>` +
      this.muscleGroups.map(g =>
        `<div class="muscle-chip ${this.activeGroup === g.code ? 'active' : ''}" onclick="Exercises.setGroup('${g.code}')">${g.label}</div>`
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
      list.innerHTML = `<p class="text-tg-hint text-sm text-center py-6">Ничего не найдено</p>`;
      return;
    }
    list.innerHTML = this.all.map(e => `
      <div class="bg-tg-secondary rounded-xl p-3 flex justify-between items-center">
        <div>
          <p class="font-medium text-sm">${e.name}</p>
          <p class="text-xs text-tg-hint">${equipmentLabel(e.equipment)} ${e.is_custom ? '· своё' : ''}</p>
        </div>
      </div>
    `).join("");
  },

  openAddModal() {
    const name = prompt("Название упражнения:");
    if (!name) return;
    const groupsStr = this.muscleGroups.map(g => `${g.code} (${g.label})`).join(", ");
    const group = prompt(`Группа мышц:\n${groupsStr}`, "chest");
    const equipment = prompt("Оборудование: barbell/dumbbell/machine/cable/bodyweight/other", "other");

    API.post("/api/exercises", { name, muscle_group: group, equipment })
      .then(() => { TG.haptic("success"); this.search(); })
      .catch(e => TG.showAlert("Ошибка: " + e.message));
  },
};

function equipmentLabel(code) {
  const map = {
    barbell: "Штанга", dumbbell: "Гантели", machine: "Тренажёр",
    cable: "Блок/кроссовер", bodyweight: "Своё тело", other: "Другое",
  };
  return map[code] || code;
}
