// ============================================================
// Обёртка над fetch: подставляет initData во все запросы к API,
// с таймаутом — иначе при "холодном старте" бесплатного сервера
// (Render) запрос может зависнуть без ответа и без ошибки
// ============================================================
const API = {
  base: "",
  timeoutMs: 20000,

  async request(method, path, body) {
    const headers = { "Content-Type": "application/json", "X-Telegram-Init-Data": TG.initData };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res;
    try {
      res = await fetch(this.base + path, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name === "AbortError") {
        throw new Error("Сервер долго не отвечает (возможно, он просыпается после сна). Попробуй ещё раз через полминуты.");
      }
      throw new Error("Нет соединения с сервером. Проверь интернет и попробуй снова.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      let detail = "Ошибка запроса";
      try { detail = (await res.json()).detail || detail; } catch (e) {}
      throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  get(path) { return this.request("GET", path); },
  post(path, body) { return this.request("POST", path, body); },
  put(path, body) { return this.request("PUT", path, body); },
  del(path) { return this.request("DELETE", path); },
};
