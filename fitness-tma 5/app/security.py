import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session, User

# Максимальный возраст initData (24 часа) — защита от replay-атак
MAX_AGE_SECONDS = 86400


def validate_init_data(init_data: str, bot_token: str) -> dict:
    """
    Проверяет подпись initData согласно официальной документации Telegram:
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError:
        raise HTTPException(401, "Некорректный формат initData")

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(401, "Отсутствует hash в initData")

    auth_date = parsed.get("auth_date")
    if auth_date and (time.time() - int(auth_date)) > MAX_AGE_SECONDS:
        raise HTTPException(401, "initData устарела")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(401, "Неверная подпись initData")

    user_json = parsed.get("user")
    if not user_json:
        raise HTTPException(401, "Нет данных пользователя в initData")

    return json.loads(user_json)


async def get_current_user(
    x_telegram_init_data: str = Header(..., alias="X-Telegram-Init-Data"),
    session: AsyncSession = Depends(get_session),
) -> User:
    tg_user = validate_init_data(x_telegram_init_data, settings.BOT_TOKEN)
    telegram_id = tg_user["id"]

    result = await session.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            telegram_id=telegram_id,
            username=tg_user.get("username"),
            nickname=tg_user.get("first_name", "Атлет"),
            avatar_url=tg_user.get("photo_url"),  # Telegram иногда отдаёт прямую ссылку на аватар
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    return user
