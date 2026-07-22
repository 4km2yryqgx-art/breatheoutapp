import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import init_db
from app.seed_data import seed_exercises, seed_achievements
from app.bot import start_bot_polling

from app.routers import profile, measurements, exercises, workouts, plans, gamification, payments, habits

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_exercises()
    await seed_achievements()

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

app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.mount("/js", StaticFiles(directory="frontend/js"), name="js")
app.mount("/css", StaticFiles(directory="frontend/css"), name="css")


@app.get("/")
async def index():
    return FileResponse("frontend/index.html")


@app.get("/health")
async def health():
    return {"status": "ok"}
