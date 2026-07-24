from fastapi import APIRouter, Depends
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, TrainingDay, WeeklySchedule, Exercise
from app.schemas import TrainingDayIn, ScheduleIn, AIGenerateIn
from app.security import get_current_user
from app.ai_logic import generate_ai_workout, generate_weekly_plan

router = APIRouter(prefix="/api/plans", tags=["plans"])


# ================= КОНСТРУКТОР ДНЕЙ =================

@router.get("/training-days")
async def list_training_days(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(TrainingDay).where(TrainingDay.user_id == user.id))
    return [{"id": t.id, "name": t.name, "exercise_ids": t.exercise_ids} for t in result.scalars().all()]


@router.post("/training-days")
async def create_training_day(
    data: TrainingDayIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    t = TrainingDay(user_id=user.id, name=data.name, exercise_ids=data.exercise_ids)
    session.add(t)
    await session.commit()
    await session.refresh(t)
    return {"id": t.id, "name": t.name, "exercise_ids": t.exercise_ids}


@router.delete("/training-days/{day_id}")
async def delete_training_day(
    day_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await session.execute(
        delete(TrainingDay).where(TrainingDay.id == day_id, TrainingDay.user_id == user.id)
    )
    await session.commit()
    return {"ok": True}


# ================= НЕДЕЛЬНОЕ РАСПИСАНИЕ =================

@router.get("/schedule")
async def get_schedule(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(WeeklySchedule).where(WeeklySchedule.user_id == user.id))
    return [{"weekday": s.weekday, "training_day_id": s.training_day_id} for s in result.scalars().all()]


@router.post("/schedule")
async def set_schedule(
    data: ScheduleIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(WeeklySchedule).where(
            WeeklySchedule.user_id == user.id, WeeklySchedule.weekday == data.weekday
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.training_day_id = data.training_day_id
        session.add(existing)
    else:
        session.add(WeeklySchedule(
            user_id=user.id, weekday=data.weekday, training_day_id=data.training_day_id
        ))
    await session.commit()
    return {"ok": True}


# ================= ИИ-ГЕНЕРАЦИЯ =================

@router.get("/ai/suggest-week")
async def ai_suggest_week(
    user: User = Depends(get_current_user),
):
    """Предлагает структуру недели на основе анкеты пользователя."""
    plan = generate_weekly_plan(user.goal or "endurance", user.experience or "beginner",
                                 user.activity_level or 3)
    return {"plan": plan}


@router.post("/ai/generate-workout")
async def ai_generate_workout(
    data: AIGenerateIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Генерирует тренировку под цель анкеты, самочувствие и доступное оборудование."""
    from app.database import Workout, WorkoutEntry

    result = await session.execute(select(Exercise))
    all_exercises = [
        {"id": e.id, "name": e.name, "muscle_group": e.muscle_group, "equipment": e.equipment}
        for e in result.scalars().all()
    ]

    # Берём упражнения из последних 3 тренировок, чтобы новый план не повторял их
    recent_result = await session.execute(
        select(WorkoutEntry.exercise_id)
        .join(Workout, Workout.id == WorkoutEntry.workout_id)
        .where(Workout.user_id == user.id)
        .order_by(Workout.id.desc())
        .limit(30)
    )
    recent_exercise_ids = [row[0] for row in recent_result.all()]

    workout = generate_ai_workout(
        all_exercises, data.location, data.feeling,
        goal=user.goal, muscle_focus=data.muscle_focus,
        recent_exercise_ids=recent_exercise_ids,
    )
    return {"exercises": workout}
