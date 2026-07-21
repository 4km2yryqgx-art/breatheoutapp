// ============================================================
// Обёртка над window.Telegram.WebApp — хаптик, MainButton, тема
// ============================================================
const tg = window.Telegram?.WebApp;

const TG = {
  init() {
    if (!tg) {
      console.warn("Telegram WebApp SDK не найден — запущено вне Telegram");
      return;
    }
    tg.ready();
    tg.expand(); // разворачиваем на весь экран

    // Полноэкранный режим (Bot API 8.0+, если поддерживается клиентом)
    try { tg.requestFullscreen?.(); } catch (e) {}

    // Синхронизируем цвет шапки с темой Telegram
    try {
      tg.setHeaderColor?.('secondary_bg_color');
      tg.setBackgroundColor?.(tg.themeParams.bg_color || '#0f1115');
    } catch (e) {}

    // Подтверждение закрытия, чтобы не терять несохранённую тренировку
    tg.enableClosingConfirmation?.();
  },

  get initData() {
    return tg?.initData || "";
  },

  haptic(type = "light") {
    if (!tg?.HapticFeedback) return;
    if (["light", "medium", "heavy", "rigid", "soft"].includes(type)) {
      tg.HapticFeedback.impactOccurred(type);
    } else if (type === "success" || type === "error" || type === "warning") {
      tg.HapticFeedback.notificationOccurred(type);
    } else if (type === "selection") {
      tg.HapticFeedback.selectionChanged();
    }
  },

  mainButton(text, onClick, { color, show = true } = {}) {
    if (!tg?.MainButton) return;
    tg.MainButton.setText(text);
    tg.MainButton.offClick(this._lastHandler);
    this._lastHandler = onClick;
    tg.MainButton.onClick(onClick);
    if (color) tg.MainButton.setParams({ color });
    show ? tg.MainButton.show() : tg.MainButton.hide();
  },

  hideMainButton() {
    tg?.MainButton?.hide();
  },

  openInvoice(link, callback) {
    if (!tg?.openInvoice) {
      alert("Оплата доступна только внутри Telegram");
      return;
    }
    tg.openInvoice(link, callback);
  },

  showAlert(message) {
    if (tg?.showAlert) tg.showAlert(message);
    else alert(message);
  },

  showConfirm(message, callback) {
    if (tg?.showConfirm) tg.showConfirm(message, callback);
    else callback(confirm(message));
  },
};

TG.init();
