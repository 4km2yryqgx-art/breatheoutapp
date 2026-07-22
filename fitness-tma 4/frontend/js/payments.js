// ============================================================
// Premium: оплата Telegram Stars + промокоды
// ============================================================
const Payments = {
  async loadStatus() {
    const status = await API.get("/api/payment/status");
    document.getElementById("premium-price").textContent = status.price_stars;
    const box = document.getElementById("premium-status-box");

    if (status.is_premium) {
      box.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shrink-0">
            <i data-lucide="crown" class="w-6 h-6 text-white"></i>
          </div>
          <div>
            <p class="font-bold">Premium активен</p>
            <p class="text-xs text-tg-hint">${status.premium_until ? `до ${status.premium_until}` : "навсегда 🎉"}</p>
          </div>
        </div>`;
      document.getElementById("premium-buy-btn").classList.add("hidden");
    } else {
      box.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
            <i data-lucide="lock" class="w-6 h-6 text-tg-hint"></i>
          </div>
          <div>
            <p class="font-bold">Premium не активен</p>
            <p class="text-xs text-tg-hint">Открой все возможности FitApp</p>
          </div>
        </div>`;
      document.getElementById("premium-buy-btn").classList.remove("hidden");
    }
    window.lucide?.createIcons();
  },

  async buyPremium() {
    try {
      TG.haptic("medium");
      const { invoice_link } = await API.post("/api/payment/create-invoice-link");
      TG.openInvoice(invoice_link, (status) => {
        if (status === "paid") {
          TG.haptic("success");
          TG.showPopup({ title: "Готово! 🎉", message: "Premium активирован. Загляни в новый раздел Привычек!", buttons: [{ type: "ok" }] });
          this.loadStatus();
        } else if (status !== "cancelled") {
          TG.haptic("error");
        }
      });
    } catch (e) {
      TG.showAlert("Ошибка создания счёта: " + e.message);
    }
  },

  async redeemPromo() {
    const code = document.getElementById("promo-input").value.trim();
    if (!code) return;
    try {
      const res = await API.post("/api/payment/redeem-promo", { code });
      TG.haptic("success");
      TG.showAlert(res.message);
      document.getElementById("promo-input").value = "";
      this.loadStatus();
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
