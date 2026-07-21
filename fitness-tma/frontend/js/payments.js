// ============================================================
// Premium подписка: оплата Telegram Stars + промокоды
// ============================================================
const Payments = {
  async loadStatus() {
    const status = await API.get("/api/payment/status");
    document.getElementById("premium-price").textContent = status.price_stars;
    const statusEl = document.getElementById("premium-status");

    if (status.is_premium) {
      statusEl.innerHTML = `✅ Premium активен${status.premium_until ? ` до ${status.premium_until}` : " (навсегда)"}`;
    } else {
      statusEl.innerHTML = `🔓 Открой все возможности FitApp`;
    }
  },

  async buyPremium() {
    try {
      const { invoice_link } = await API.post("/api/payment/create-invoice-link");
      TG.openInvoice(invoice_link, (status) => {
        if (status === "paid") {
          TG.haptic("success");
          TG.showAlert("🎉 Оплата прошла успешно! Premium активирован.");
          this.loadStatus();
        } else if (status === "cancelled") {
          TG.haptic("light");
        } else {
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
      TG.showAlert("🎉 " + res.message);
      document.getElementById("promo-input").value = "";
      this.loadStatus();
    } catch (e) {
      TG.haptic("error");
      TG.showAlert("Ошибка: " + e.message);
    }
  },
};
