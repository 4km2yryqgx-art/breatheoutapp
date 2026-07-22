import datetime
from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(unique=True, index=True)
    username: Mapped[str] = mapped_column(String(255), nullable=True)
    nickname: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(Text, nullable=True)  # data:base64 из галереи или photo_url из Telegram

    # Анкета
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    gender: Mapped[str] = mapped_column(String(10), nullable=True)  # male / female
    age: Mapped[int] = mapped_column(Integer, nullable=True)
    weight: Mapped[float] = mapped_column(Float, nullable=True)
    height: Mapped[float] = mapped_column(Float, nullable=True)
    goal: Mapped[str] = mapped_column(String(30), nullable=True)  # lose / gain / relief / endurance
    activity_level: Mapped[int] = mapped_column(Integer, nullable=True)  # 1-5
    experience: Mapped[str] = mapped_column(String(30), nullable=True)  # beginner/mid/advanced

    # Расчёты ИИ
    bmi: Mapped[float] = mapped_column(Float, nullable=True)
    calories: Mapped[int] = mapped_column(Integer, nullable=True)
    protein_g: Mapped[int] = mapped_column(Integer, nullable=True)
    fat_g: Mapped[int] = mapped_column(Integer, nullable=True)
    carbs_g: Mapped[int] = mapped_column(Integer, nullable=True)

    # Геймификация
    xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_workout_date: Mapped[str] = mapped_column(String(20), nullable=True)

    # Премиум
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    premium_until: Mapped[str] = mapped_column(String(20), nullable=True)  # ISO date, null = lifetime

    # Статистика для достижений
    total_volume_kg: Mapped[float] = mapped_column(Float, default=0)  # суммарно поднятый тоннаж (вес × повторы)

    # Настройки
    hide_supplements_tips: Mapped[bool] = mapped_column(Boolean, default=False)
    is_coach: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    measurements = relationship("Measurement", back_populates="user", cascade="all, delete-orphan")
    workouts = relationship("Workout", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    training_days = relationship("TrainingDay", back_populates="user", cascade="all, delete-orphan")


class Measurement(Base):
    __tablename__ = "measurements"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    date: Mapped[str] = mapped_column(String(20))
    weight: Mapped[float] = mapped_column(Float, nullable=True)
    biceps: Mapped[float] = mapped_column(Float, nullable=True)
    waist: Mapped[float] = mapped_column(Float, nullable=True)
    hips: Mapped[float] = mapped_column(Float, nullable=True)
    chest: Mapped[float] = mapped_column(Float, nullable=True)

    user = relationship("User", back_populates="measurements")


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    muscle_group: Mapped[str] = mapped_column(String(60), index=True)
    equipment: Mapped[str] = mapped_column(String(60))  # barbell/dumbbell/machine/bodyweight/cable/other
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    date: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(255), nullable=True)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=True)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    created_hour: Mapped[int] = mapped_column(Integer, nullable=True)  # локальный час устройства, 0-23

    user = relationship("User", back_populates="workouts")
    entries = relationship("WorkoutEntry", back_populates="workout", cascade="all, delete-orphan",
                            lazy="selectin")


class WorkoutEntry(Base):
    __tablename__ = "workout_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workouts.id"))
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"))
    exercise_name: Mapped[str] = mapped_column(String(255))
    sets: Mapped[list] = mapped_column(JSON)  # [{"weight":50,"reps":10}, ...]

    workout = relationship("Workout", back_populates="entries")


class TrainingDay(Base):
    """Конструктор дня тренировки, напр. 'День А: Грудь/Трицепс'"""
    __tablename__ = "training_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    exercise_ids: Mapped[list] = mapped_column(JSON)  # [1,4,10,...]

    user = relationship("User", back_populates="training_days")


class WeeklySchedule(Base):
    """Расписание: день недели (0=Пн..6=Вс) -> training_day_id"""
    __tablename__ = "weekly_schedule"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    weekday: Mapped[int] = mapped_column(Integer)
    training_day_id: Mapped[int] = mapped_column(ForeignKey("training_days.id"), nullable=True)


class Achievement(Base):
    __tablename__ = "achievements_catalog"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(60), unique=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(500))
    icon: Mapped[str] = mapped_column(String(10))  # emoji
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)  # секретная ачивка, описание скрыто до разблокировки


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    code: Mapped[str] = mapped_column(String(60))
    unlocked_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="achievements")


class PromoCode(Base):
    """Промокоды, сгенерированные автоматически после оплаты Stars"""
    __tablename__ = "promo_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    type: Mapped[str] = mapped_column(String(20))  # "month" / "lifetime"
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    used_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_for_user: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class MasterPromoUse(Base):
    """Счётчик использований статичных мастер-промокодов из config.py"""
    __tablename__ = "master_promo_uses"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(60), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))


class Habit(Base):
    """Привычка в трекере (доступен только Premium-пользователям)"""
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    icon: Mapped[str] = mapped_column(String(40), default="sparkles")  # имя иконки Lucide
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)


class HabitLog(Base):
    """Отметка выполнения привычки за конкретный день"""
    __tablename__ = "habit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[str] = mapped_column(String(20))
    done: Mapped[bool] = mapped_column(Boolean, default=True)


class XpEvent(Base):
    """Каждое начисление XP — нужно для недельного лидерборда"""
    __tablename__ = "xp_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(40))  # workout / habit / challenge
    week_key: Mapped[str] = mapped_column(String(10), index=True)  # напр. "2026-W30"
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class ChallengeCompletion(Base):
    """Отметка о выполнении испытания недели (одна на пользователя за неделю)"""
    __tablename__ = "challenge_completions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    week_key: Mapped[str] = mapped_column(String(10), index=True)
    challenge_index: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class WorkoutDraft(Base):
    """Черновик незавершённой тренировки — автосейв на случай закрытия приложения"""
    __tablename__ = "workout_drafts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=True)
    entries: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow,
                                                            onupdate=datetime.datetime.utcnow)


class CoachLink(Base):
    """Связь тренер-ученик. status: pending / accepted / declined"""
    __tablename__ = "coach_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session():
    async with async_session() as session:
        yield session
