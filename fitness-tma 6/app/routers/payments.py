from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, PromoCode, MasterPromoUse
from app.schemas import PromoRedeemIn
from app.security import get_current_user
from app.config import settings, MASTER_PROMOCODES
from app.bot import bot
from app.achievements_engine import evaluate_achievements
from app.premium_utils import is_user_premium

router = APIRouter(prefix="/api/payment", tags=["payments"])


@router.get("/status")
async def payment_status(user: User = Depends(get_current_user)):
    return {
        "is_premium": is_user_premium(user),
        "premium_until": user.premium_until,
        "price_stars": settings.PREMIUM_PRICE_STARS,
    }


@router.post("/create-invoice-link")
async def create_invoice_link(user: User = Depends(get_current_user)):
    """
    Создаёт ссылку на инвойс Telegram Stars, чтобы открыть её прямо из Mini App
    через Telegram.WebApp.openInvoice(link) на фронтенде.
    """
    link = await bot.create_invoice_link(
        title="FitApp Premium",
        description="Расширенные ИИ-функции и продвинутая аналитика на 1 месяц.",
        payload=f"premium_{user.telegram_id}",
        currency="XTR",
        prices=[{"label": "Premium (1 месяц)", "amount": settings.PREMIUM_PRICE_STARS}],
        provider_token="",
    )
    return {"invoice_link": link}


@router.post("/redeem-promo")
async def redeem_promo(
    data: PromoRedeemIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    code = data.code.strip().upper()

    # 1) Проверяем мастер-промокоды из config.py
    if code in MASTER_PROMOCODES:
        info = MASTER_PROMOCODES[code]

        if info["max_uses"] is not None:
            count_result = await session.execute(
                select(MasterPromoUse).where(MasterPromoUse.code == code)
            )
            used_count = len(count_result.scalars().all())
            if used_count >= info["max_uses"]:
                raise HTTPException(400, "Лимит использований этого промокода исчерпан")

        already_result = await session.execute(
            select(MasterPromoUse).where(
                MasterPromoUse.code == code, MasterPromoUse.user_id == user.id
            )
        )
        if already_result.scalar_one_or_none():
            raise HTTPException(400, "Ты уже активировал этот промокод")

        user.is_premium = True
        if info["type"] == "lifetime":
            user.premium_until = None
        else:
            user.premium_until = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")

        session.add(user)
        session.add(MasterPromoUse(code=code, user_id=user.id))
        await session.commit()
        await evaluate_achievements(session, user)
        return {"ok": True, "type": info["type"], "message": "Premium активирован!"}

    # 2) Проверяем сгенерированные промокоды после оплаты Stars
    result = await session.execute(select(PromoCode).where(PromoCode.code == code))
    promo = result.scalar_one_or_none()

    if not promo:
        raise HTTPException(404, "Промокод не найден")
    if promo.used:
        raise HTTPException(400, "Промокод уже был использован")

    promo.used = True
    promo.used_by = user.id
    user.is_premium = True
    user.premium_until = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")

    session.add(promo)
    session.add(user)
    await session.commit()
    await evaluate_achievements(session, user)
    return {"ok": True, "type": "month", "message": "Premium активирован на 30 дней!"}
