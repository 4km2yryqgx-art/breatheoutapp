from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, Workout, WorkoutEntry, UserAchievement
from app.schemas import WorkoutIn
from app.security import get_current_user
from app.ai_logic import xp_reward_for_workout, level_from_xp, compute_streak, check_new_achievements

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


def workout_to_dict(w: Workout) -> dict:
    return {
        "id": w.id, "date": w.date, "title": w.title,
        "duration_min": w.duration_min, "xp_earned": w.xp_earned,
        "entries": [
            {"exercise_id": e.exercise_id, "exercise_name": e.exercise_name, "sets": e.sets}
            for e in w.entries
        ],
    }


@router.get("")
async def list_workouts(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Workout).where(Workout.user_id == user.id).order_by(Workout.date.desc())
    )
    workouts = result.scalars().unique().all()
    return [workout_to_dict(w) for w in workouts]


@router.post("")
async def create_workout(
    data: WorkoutIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    workout = Workout(user_id=user.id, date=data.date, title=data.title, duration_min=data.duration_min)
    session.add(workout)
    await session.flush()

    total_sets = 0
    for entry in data.entries:
        sets_dump = [s.model_dump() for s in entry.sets]
        total_sets += len(sets_dump)
        session.add(WorkoutEntry(
            workout_id=workout.id, exercise_id=entry.exercise_id,
            exercise_name=entry.exercise_name, sets=sets_dump,
        ))

    # ===== Геймификация: начисляем XP, обновляем стрик и уровень =====
    xp_earned = xp_reward_for_workout(len(data.entries), total_sets)
    workout.xp_earned = xp_earned

    today = data.date
    user.streak_days = compute_streak(user.last_workout_date, today, user.streak_days)
    user.last_workout_date = today
    user.xp = (user.xp or 0) + xp_earned
    user.level = level_from_xp(user.xp)

    session.add(user)
    await session.commit()

    # ===== Проверяем новые ачивки =====
    count_result = await session.execute(
        select(func.count()).select_from(Workout).where(Workout.user_id == user.id)
    )
    total_workouts = count_result.scalar_one()

    unlocked_result = await session.execute(
        select(UserAchievement.code).where(UserAchievement.user_id == user.id)
    )
    already_unlocked = {row[0] for row in unlocked_result.all()}

    new_codes = check_new_achievements(user, total_workouts, already_unlocked)
    for code in new_codes:
        session.add(UserAchievement(user_id=user.id, code=code))
    if new_codes:
        await session.commit()

    await session.refresh(workout)
    return {
        "workout": workout_to_dict(workout),
        "xp_earned": xp_earned,
        "new_level": user.level,
        "new_achievements": new_codes,
        "streak_days": user.streak_days,
    }


@router.get("/calendar")
async def workouts_calendar(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Возвращает список дат, в которые были тренировки (для отметок в календаре)."""
    result = await session.execute(
        select(Workout.date, func.count()).where(Workout.user_id == user.id).group_by(Workout.date)
    )
    return [{"date": row[0], "count": row[1]} for row in result.all()]
