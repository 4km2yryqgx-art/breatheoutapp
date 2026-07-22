import secrets
import logging
from datetime import datetime, timedelta

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton,
    PreCheckoutQuery, LabeledPrice,
)
from sqlalchemy import select

from app.config import settings, MASTER_PROMOCODES
from app.database import async_session, User, PromoCode

logger = logging.getLogger(__name__)

bot = Bot(token=settings.BOT_TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def cmd_start(message: Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🏋️ Открыть FitApp",
            web_app=WebAppInfo(url=settings.WEBAPP_URL),
        )]
    ])
    await message.answer(
        "Привет, атлет! 💪\n\n"
        "Я — твой персональный фитнес-помощник прямо в Telegram.\n"
        "Здесь ты найдёшь:\n"
        "• Персональный план питания и тренировок от ИИ\n"
        "• Дневник тренировок с базой упражнений\n"
        "• Графики прогресса тела\n"
        "• Систему уровней, XP и достижений\n\n"
        "Нажимай кнопку ниже, чтобы начать 👇",
        reply_markup=kb,
    )


@dp.message(Command("premium"))
async def cmd_premium(message: Message):
    prices = [LabeledPrice(label="Premium подписка (1 месяц)", amount=settings.PREMIUM_PRICE_STARS)]
    await bot.send_invoice(
        chat_id=message.chat.id,
        title="FitApp Premium",
        description="Расширенные ИИ-функции, безлимитные планы тренировок и продвинутая аналитика на 1 месяц.",
        payload=f"premium_{message.from_user.id}_{secrets.token_hex(4)}",
        currency="XTR",  # XTR = Telegram Stars
        prices=prices,
        provider_token="",  # для Stars provider_token не нужен
    )


@dp.pre_checkout_query()
async def process_pre_checkout(pre_checkout_query: PreCheckoutQuery):
    await bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


@dp.message(F.successful_payment)
async def process_successful_payment(message: Message):
    """После успешной оплаты Stars генерируем уникальный промокод на 1 месяц Premium."""
    async with async_session() as session:
        result = await session.execute(select(User).where(User.telegram_id == message.from_user.id))
        user = result.scalar_one_or_none()

        code = f"FIT-{secrets.token_hex(4).upper()}"
        promo = PromoCode(code=code, type="month", created_for_user=user.id if user else None)
        session.add(promo)

        if user:
            # Активируем Premium сразу же и продлеваем через промокод при желании
            until = datetime.utcnow() + timedelta(days=30)
            user.is_premium = True
            user.premium_until = until.strftime("%Y-%m-%d")
            session.add(user)

        await session.commit()

    await message.answer(
        f"✅ Оплата получена! Premium активирован на 30 дней.\n\n"
        f"Твой уникальный промокод (можно подарить другу): `{code}`\n"
        f"Открой приложение — раздел Premium — чтобы увидеть статус подписки.",
        parse_mode="Markdown",
    )


async def start_bot_polling():
    """Запускается в фоне вместе с FastAPI-приложением."""
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)
