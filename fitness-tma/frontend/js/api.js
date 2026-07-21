// ============================================================
// Обёртка над fetch: подставляет initData во все запросы к API
// ============================================================
const API = {
  base: "",

  async request(method, path, body) {
    const headers = {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": TG.initData,
    };
    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

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
