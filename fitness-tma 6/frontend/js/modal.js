// ============================================================
// Универсальная модалка выбора упражнения (шаринг между экранами)
// ============================================================
const Modal = {
  onPick: null,
  cachedExercises: [],

  async openPicker(onPick) {
    this.onPick = onPick;
    if (this.cachedExercises.length === 0) {
      this.cachedExercises = await API.get("/api/exercises");
    }
    const modal = document.getElementById("exercise-picker-modal");
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("modal-open"));
    document.getElementById("picker-search").value = "";
    this.renderPickerList();
  },

  renderPickerList() {
    const q = document.getElementById("picker-search").value.toLowerCase();
    const filtered = this.cachedExercises.filter((e) => e.name.toLowerCase().includes(q));
    const list = document.getElementById("picker-list");
    list.innerHTML = filtered.slice(0, 100).map((e) => `
      <button class="w-full text-left glass-card-flat rounded-2xl p-3 flex items-center gap-3 active-press" onclick="Modal.pick(${e.id})">
        <div class="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <i data-lucide="${muscleIcon(e.muscle_group)}" class="w-5 h-5 text-accent"></i>
        </div>
        <div class="min-w-0">
          <p class="font-medium text-sm truncate">${e.name}</p>
          <p class="text-xs text-tg-hint">${muscleLabel(e.muscle_group)}</p>
        </div>
      </button>
    `).join("");
    window.lucide?.createIcons();
  },

  pick(id) {
    const ex = this.cachedExercises.find((e) => e.id === id);
    TG.haptic("medium");
    this.close();
    if (ex && this.onPick) this.onPick(ex);
  },

  close() {
    const modal = document.getElementById("exercise-picker-modal");
    modal.classList.remove("modal-open");
    setTimeout(() => modal.classList.add("hidden"), 200);
  },
};

const MUSCLE_META = {
  chest: { label: "Грудь", icon: "square" },
  back: { label: "Спина", icon: "square-stack" },
  legs: { label: "Ноги", icon: "footprints" },
  glutes: { label: "Ягодицы", icon: "circle" },
  shoulders: { label: "Плечи", icon: "triangle" },
  biceps: { label: "Бицепс", icon: "dumbbell" },
  triceps: { label: "Трицепс", icon: "dumbbell" },
  abs: { label: "Пресс", icon: "layout-grid" },
  forearms: { label: "Предплечья", icon: "hand" },
  cardio: { label: "Кардио", icon: "heart-pulse" },
};

function muscleLabel(code) { return MUSCLE_META[code]?.label || code; }
function muscleIcon(code) { return MUSCLE_META[code]?.icon || "dumbbell"; }
function equipmentLabel(code) {
  const map = { barbell: "Штанга", dumbbell: "Гантели", machine: "Тренажёр", cable: "Блок", bodyweight: "Своё тело", other: "Другое" };
  return map[code] || code;
}

// Кардио-сеты хранятся с полями speed/duration (weight/reps будут null) —
// это надёжный сигнал, т.к. бэкенд всегда сохраняет все 4 ключа в JSON.
function isCardioSets(sets) {
  return Array.isArray(sets) && sets.length > 0 && sets[0].speed !== null && sets[0].speed !== undefined;
}
