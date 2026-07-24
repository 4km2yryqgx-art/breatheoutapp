// ============================================================
// Обёртка над window.Telegram.WebApp
// ============================================================
const tgSdk = window.Telegram?.WebApp;

const TG = {
  user: null, // initDataUnsafe.user — доступно мгновенно, без похода на бэкенд

  init() {
    if (!tgSdk) {
      console.warn("Telegram WebApp SDK не найден — запущено вне Telegram");
      return;
    }
    tgSdk.ready();
    tgSdk.expand();
    try { tgSdk.requestFullscreen?.(); } catch (e) {}
    try {
      tgSdk.setHeaderColor?.('secondary_bg_color');
      tgSdk.setBackgroundColor?.(tgSdk.themeParams.bg_color || '#0a0c10');
    } catch (e) {}
    tgSdk.enableClosingConfirmation?.();

    this.user = tgSdk.initDataUnsafe?.user || null;
    this.applySafeArea();
    tgSdk.onEvent?.('viewportChanged', () => this.applySafeArea());
  },

  applySafeArea() {
    // Учитываем реальную стабильную высоту вьюпорта Telegram + safe-area устройства
    const root = document.documentElement;
    const stable = tgSdk?.viewportStableHeight;
    if (stable) root.style.setProperty('--tg-stable-height', `${stable}px`);
    const bottomInset = tgSdk?.safeAreaInset?.bottom ?? 0;
    const contentBottomInset = tgSdk?.contentSafeAreaInset?.bottom ?? 0;
    root.style.setProperty('--tg-safe-bottom', `${Math.max(bottomInset, contentBottomInset, 0)}px`);
  },

  get initData() {
    return tgSdk?.initData || "";
  },

  haptic(type = "light") {
    if (!tgSdk?.HapticFeedback) return;
    if (["light", "medium", "heavy", "rigid", "soft"].includes(type)) {
      tgSdk.HapticFeedback.impactOccurred(type);
    } else if (["success", "error", "warning"].includes(type)) {
      tgSdk.HapticFeedback.notificationOccurred(type);
    } else if (type === "selection") {
      tgSdk.HapticFeedback.selectionChanged();
    }
  },

  mainButton(text, onClick, { color, show = true } = {}) {
    if (!tgSdk?.MainButton) return;
    tgSdk.MainButton.setText(text);
    if (this._lastHandler) tgSdk.MainButton.offClick(this._lastHandler);
    this._lastHandler = onClick;
    tgSdk.MainButton.onClick(onClick);
    if (color) tgSdk.MainButton.setParams({ color });
    show ? tgSdk.MainButton.show() : tgSdk.MainButton.hide();
  },

  hideMainButton() {
    tgSdk?.MainButton?.hide();
  },

  openInvoice(link, callback) {
    if (!tgSdk?.openInvoice) { alert("Оплата доступна только внутри Telegram"); return; }
    tgSdk.openInvoice(link, callback);
  },

  showAlert(message) {
    if (tgSdk?.showAlert) tgSdk.showAlert(message);
    else alert(message);
  },

  showConfirm(message, callback) {
    if (tgSdk?.showConfirm) tgSdk.showConfirm(message, callback);
    else callback(confirm(message));
  },

  showPopup(params, callback) {
    if (tgSdk?.showPopup) tgSdk.showPopup(params, callback);
    else { alert(params.message); callback?.(null); }
  },
};

TG.init();
