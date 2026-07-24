import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import init_db, async_session, User
from app.seed_data import seed_exercises, seed_achievements
from app.bot import start_bot_polling
from app.ai_logic import level_from_xp

from app.routers import (
    profile, measurements, exercises, workouts, plans, gamification,
    payments, habits, leaderboard, challenges, coach, shop,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def recalculate_levels():
    """
    Безопасная миграция данных (НЕ схемы): пересчитывает поле `level` для всех
    пользователей на основе уже сохранённого `xp` по новой формуле прогрессии.
    Ничего не удаляет и не обнуляет — только приводит уже существующее число
    уровня в соответствие с уже существующим числом опыта.
    """
    async with async_session() as session:
        from sqlalchemy import select
        result = await session.execute(select(User))
        users = result.scalars().all()
        changed = 0
        for u in users:
            correct_level = level_from_xp(u.xp or 0)
            if u.level != correct_level:
                u.level = correct_level
                session.add(u)
                changed += 1
        if changed:
            await session.commit()
            logger.info(f"Пересчитан уровень у {changed} пользователей по новой формуле прогрессии")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_exercises()
    await seed_achievements()
    await recalculate_levels()

    # Бот запускается в фоне тем же процессом, что и веб-сервер —
    # так его можно бесплатно хостить одним сервисом на Render/Railway.
    bot_task = asyncio.create_task(start_bot_polling())
    logger.info("Бот запущен в фоновом режиме (polling)")

    yield

    bot_task.cancel()


app = FastAPI(title="FitApp Telegram Mini App", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(measurements.router)
app.include_router(exercises.router)
app.include_router(workouts.router)
app.include_router(plans.router)
app.include_router(gamification.router)
app.include_router(payments.router)
app.include_router(habits.router)
app.include_router(leaderboard.router)
app.include_router(challenges.router)
app.include_router(coach.router)
app.include_router(shop.router)

app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.mount("/js", StaticFiles(directory="frontend/js"), name="js")
app.mount("/css", StaticFiles(directory="frontend/css"), name="css")


@app.get("/")
async def index():
    return FileResponse("frontend/index.html")


@app.get("/health")
async def health():
    return {"status": "ok"}
