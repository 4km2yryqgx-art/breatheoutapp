// ============================================================
// Недельный лидерборд + Испытание недели
// ============================================================
const Leaderboard = {
  async load() {
    try {
      const data = await API.get("/api/leaderboard/weekly");
      const list = document.getElementById("leaderboard-list");
      const rankText = document.getElementById("my-rank-text");

      rankText.textContent = data.my_rank ? `Твоё место: #${data.my_rank}` : "";

      if (data.leaderboard.length === 0) {
        list.innerHTML = `<p class="text-xs text-tg-hint text-center py-3">Пока никто не набрал XP на этой неделе — стань первым!</p>`;
        return;
      }

      const medals = ["🥇", "🥈", "🥉"];
      list.innerHTML = data.leaderboard.slice(0, 5).map((e) => `
        <div class="flex items-center gap-3 py-1.5 ${e.user_id === App.profile?.id ? 'bg-accent/10 rounded-xl px-2 -mx-2' : ''}">
          <span class="w-6 text-center text-sm shrink-0">${medals[e.rank - 1] || `#${e.rank}`}</span>
          <span class="text-sm font-medium flex-1 truncate ${e.is_premium ? 'leaderboard-gold' : ''}">
            ${e.is_premium ? '<i data-lucide="crown" class="w-3 h-3 inline-block -mt-0.5 mr-0.5"></i>' : ''}${e.nickname}${e.username ? ` <span class="text-tg-hint">@${e.username}</span>` : ""}
          </span>
          <span class="text-xs font-bold text-accent shrink-0">${e.weekly_xp} XP</span>
        </div>
      `).join("");
      window.lucide?.createIcons();
    } catch (e) {
      // тихо игнорируем — лидерборд не критичен для остального UX
    }
  },
};

const Challenges = {
  current: null,

  async load() {
    try {
      this.current = await API.get("/api/challenges/current");
      document.getElementById("challenge-title").textContent = this.current.title;
      document.getElementById("challenge-bonus").textContent = this.current.bonus_xp;

      const btn = document.getElementById("challenge-btn");
      if (this.current.completed) {
        btn.textContent = "✅ Уже выполнено на этой неделе";
        btn.disabled = true;
        btn.classList.add("opacity-60");
      } else {
        btn.innerHTML = `Отметить выполненным (+<span id="challenge-bonus">${this.current.bonus_xp}</span> XP)`;
        btn.disabled = false;
        btn.classList.remove("opacity-60");
      }
    } catch (e) {
      // тихо игнорируем
    }
  },

  async complete() {
    if (!this.current || this.current.completed) return;
    TG.haptic("medium");
    try {
      const res = await API.post("/api/challenges/complete");
      TG.haptic("success");
      App.profile.xp = res.xp_earned + (App.profile.xp || 0);
      App.profile.level = res.level;
      this.current.completed = true;
      await this.load();
      Home.render();
      Home.toast(`+${res.xp_earned} XP за испытание недели! 🎯`);
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
