// ============================================================
// Титулы за уровень: смешные и мотивирующие. Показываются на
// главном экране (текущий) и в Профиле (полный список, будущие
// титулы скрыты под блюром — интрига!)
// ============================================================
const TITLE_TIERS = [
  { minLevel: 1, title: "Диванный Джедай", subtitle: "Ещё только присматривается к гантелям", icon: "sofa", gradient: "from-slate-500 to-slate-700" },
  { minLevel: 3, title: "Разминочный Воин", subtitle: "Уже нашёл зал на карте", icon: "footprints", gradient: "from-sky-500 to-blue-600" },
  { minLevel: 5, title: "Скамья Дрожит", subtitle: "Первые блины комом, но блины есть", icon: "dumbbell", gradient: "from-cyan-500 to-teal-600" },
  { minLevel: 8, title: "Штанга Уважает", subtitle: "Прогресс уже видно невооружённым глазом", icon: "trending-up", gradient: "from-emerald-500 to-green-600" },
  { minLevel: 12, title: "Зверь Подходов", subtitle: "Таймер отдыха — личный враг", icon: "flame", gradient: "from-amber-500 to-orange-600" },
  { minLevel: 16, title: "Локальная Легенда Зала", subtitle: "Новенькие спрашивают у тебя советы", icon: "medal", gradient: "from-orange-500 to-red-600" },
  { minLevel: 20, title: "Терминатор Тренировок", subtitle: "I'll be back... через 60 секунд отдыха", icon: "zap", gradient: "from-rose-500 to-pink-600" },
  { minLevel: 25, title: "Полубог Фитнеса", subtitle: "Гравитация работает на тебя по особому тарифу", icon: "sparkles", gradient: "from-fuchsia-500 to-purple-600" },
  { minLevel: 30, title: "Император Железа", subtitle: "Залы кланяются, когда ты входишь", icon: "crown", gradient: "from-yellow-400 to-amber-600" },
];

const Titles = {
  current(level) {
    let result = TITLE_TIERS[0];
    for (const tier of TITLE_TIERS) {
      if (level >= tier.minLevel) result = tier;
    }
    return result;
  },

  next(level) {
    return TITLE_TIERS.find((t) => t.minLevel > level) || null;
  },

  renderHomeBadge(level) {
    const t = this.current(level);
    return `
      <div class="glass-card rounded-3xl p-5 relative overflow-hidden animate-in">
        <div class="absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-20"></div>
        <div class="relative flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shadow-lg shrink-0">
            <i data-lucide="${t.icon}" class="w-7 h-7 text-white"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[11px] uppercase tracking-wider text-tg-hint font-medium">Твой титул</p>
            <p class="font-bold text-lg leading-tight truncate">${t.title}</p>
            <p class="text-xs text-tg-hint truncate">${t.subtitle}</p>
          </div>
        </div>
      </div>`;
  },

  renderFullList(level) {
    return TITLE_TIERS.map((t, i) => {
      const unlocked = level >= t.minLevel;
      return `
        <div class="relative rounded-2xl overflow-hidden glass-card ${unlocked ? 'animate-in' : ''}" style="animation-delay:${i * 40}ms">
          <div class="flex items-center gap-3 p-3 ${unlocked ? '' : 'blur-[6px] opacity-50 select-none pointer-events-none'}">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shrink-0">
              <i data-lucide="${t.icon}" class="w-5 h-5 text-white"></i>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-sm truncate">${t.title}</p>
              <p class="text-[11px] text-tg-hint truncate">${t.subtitle}</p>
            </div>
            <span class="text-[10px] text-tg-hint font-mono shrink-0">ур. ${t.minLevel}</span>
          </div>
          ${unlocked ? "" : `<div class="absolute inset-0 flex items-center justify-center">
              <div class="bg-black/50 rounded-full p-2"><i data-lucide="lock" class="w-4 h-4 text-white"></i></div>
            </div>`}
        </div>`;
    }).join("");
  },
};
