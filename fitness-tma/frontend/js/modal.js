// ============================================================
// Универсальная модалка выбора упражнения (шаринг между экранами)
// ============================================================
const Modal = {
  onPick: null, // callback(exercise)
  cachedExercises: [],

  async openPicker(onPick) {
    this.onPick = onPick;
    if (this.cachedExercises.length === 0) {
      this.cachedExercises = await API.get("/api/exercises");
    }
    document.getElementById("exercise-picker-modal").classList.remove("hidden");
    document.getElementById("picker-search").value = "";
    this.renderPickerList();
  },

  renderPickerList() {
    const q = document.getElementById("picker-search").value.toLowerCase();
    const filtered = this.cachedExercises.filter(e => e.name.toLowerCase().includes(q));
    const list = document.getElementById("picker-list");
    list.innerHTML = filtered.slice(0, 100).map(e => `
      <div class="bg-tg-secondary rounded-xl p-3" onclick="Modal.pick(${e.id})">
        <p class="font-medium text-sm">${e.name}</p>
        <p class="text-xs text-tg-hint">${e.muscle_group}</p>
      </div>
    `).join("");
  },

  pick(id) {
    const ex = this.cachedExercises.find(e => e.id === id);
    TG.haptic("medium");
    this.close();
    if (ex && this.onPick) this.onPick(ex);
  },

  close() {
    document.getElementById("exercise-picker-modal").classList.add("hidden");
  },
};
