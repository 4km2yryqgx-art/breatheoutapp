from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    BOT_TOKEN: str = "123456789:PUT_YOUR_TOKEN_HERE"
    WEBAPP_URL: str = "https://your-app.onrender.com"
    DATABASE_URL: str = "sqlite+aiosqlite:///./fitness.db"
    SECRET_KEY: str = "change-me"
    PREMIUM_PRICE_STARS: int = 100

    class Config:
        env_file = ".env"


settings = Settings()

# ==========================================================
# МАСТЕР-ПРОМОКОДЫ — редактируй прямо тут, деплой не нужен.
# type: "lifetime" — навсегда, "month" — на 30 дней от активации.
# max_uses: сколько раз можно применить (None = без ограничений)
# ==========================================================
MASTER_PROMOCODES = {
    "FRIENDS2026": {"type": "lifetime", "max_uses": None},
    "TESTMONTH": {"type": "month", "max_uses": 50},
}
