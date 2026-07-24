from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, Workout, WorkoutEntry, WorkoutDraft
from app.schemas import WorkoutIn, WorkoutUpdateIn, WorkoutDraftIn
from app.security import get_current_user
from app.ai_logic import xp_reward_for_workout, compute_streak, compute_workout_volume
from app.xp_utils import award_xp
from app.achievements_engine import evaluate_achievements

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
        select(Workout).where(Workout.user_id == user.id).order_by(Workout.date.desc(), Workout.id.desc())
    )
    workouts = result.scalars().unique().all()
    return [workout_to_dict(w) for w in workouts]


@router.get("/draft")
async def get_draft(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Черновик незавершённой тренировки — для восстановления после случайного закрытия приложения."""
    result = await session.execute(select(WorkoutDraft).where(WorkoutDraft.user_id == user.id))
    draft = result.scalar_one_or_none()
    if not draft or not draft.entries:
        return None
    return {"title": draft.title, "entries": draft.entries, "updated_at": draft.updated_at.isoformat()}


@router.put("/draft")
async def save_draft(
    data: WorkoutDraftIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Вызывается автоматически с фронтенда при каждом изменении (debounce)."""
    result = await session.execute(select(WorkoutDraft).where(WorkoutDraft.user_id == user.id))
    draft = result.scalar_one_or_none()
    entries_dump = [e.model_dump() for e in data.entries]

    if draft:
        draft.title = data.title
        draft.entries = entries_dump
        session.add(draft)
    else:
        session.add(WorkoutDraft(user_id=user.id, title=data.title, entries=entries_dump))

    await session.commit()
    return {"ok": True}


@router.delete("/draft")
async def clear_draft(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await session.execute(delete(WorkoutDraft).where(WorkoutDraft.user_id == user.id))
    await session.commit()
    return {"ok": True}


@router.post("")
async def create_workout(
    data: WorkoutIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Жёсткий лимит: не более 2 тренировок в сутки (защита от фарма XP и от
    # реального перетренированности). Проверяем именно на сервере — клиентскую
    # проверку легко обойти.
    today_count_result = await session.execute(
        select(func.count()).select_from(Workout).where(Workout.user_id == user.id, Workout.date == data.date)
    )
    if today_count_result.scalar_one() >= 2:
        raise HTTPException(
            429,
            "Вы уже выполнили 2 тренировки сегодня. Мы не рекомендуем тренироваться "
            "больше ради вашей безопасности и эффективности.",
        )

    workout = Workout(
        user_id=user.id, date=data.date, title=data.title,
        duration_min=data.duration_min, created_hour=data.local_hour,
    )
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

    # ===== Геймификация: XP, тоннаж, стрик =====
    xp_earned = xp_reward_for_workout(len(data.entries), total_sets)
    workout.xp_earned = xp_earned

    volume = compute_workout_volume(data.entries)
    user.total_volume_kg = (user.total_volume_kg or 0) + volume

    user.streak_days = compute_streak(user.last_workout_date, data.date, user.streak_days)
    user.last_workout_date = data.date

    award_xp(session, user, xp_earned, source="workout")
    session.add(user)

    # Тренировка сохранена — черновик больше не нужен
    await session.execute(delete(WorkoutDraft).where(WorkoutDraft.user_id == user.id))

    await session.commit()
    await session.refresh(workout)

    new_codes = await evaluate_achievements(session, user)

    return {
        "workout": workout_to_dict(workout),
        "xp_earned": xp_earned,
        "new_level": user.level,
        "new_achievements": new_codes,
        "streak_days": user.streak_days,
    }


@router.get("/today-count")
async def today_count(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    result = await session.execute(
        select(func.count()).select_from(Workout).where(Workout.user_id == user.id, Workout.date == today)
    )
    count = result.scalar_one()
    return {"date": today, "count": count, "limit": 2, "reached": count >= 2}


@router.get("/calendar")
async def workouts_calendar(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Workout.date, func.count()).where(Workout.user_id == user.id).group_by(Workout.date)
    )
    return [{"date": row[0], "count": row[1]} for row in result.all()]


@router.get("/{workout_id}")
async def get_workout(
    workout_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user.id)
    )
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(404, "Тренировка не найдена")
    return workout_to_dict(workout)


@router.put("/{workout_id}")
async def update_workout(
    workout_id: int,
    data: WorkoutUpdateIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user.id)
    )
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(404, "Тренировка не найдена")

    old_volume = compute_workout_volume(workout.entries)

    if data.title is not None:
        workout.title = data.title

    # Переприсваиваем связь entries — cascade="all, delete-orphan" сам удалит старые
    # подходы. Так безопаснее, чем сырой DELETE, который конфликтует с identity map ORM.
    workout.entries = [
        WorkoutEntry(exercise_id=entry.exercise_id, exercise_name=entry.exercise_name,
                     sets=[s.model_dump() for s in entry.sets])
        for entry in data.entries
    ]

    new_volume = compute_workout_volume(data.entries)
    user.total_volume_kg = max((user.total_volume_kg or 0) - old_volume + new_volume, 0)
    session.add(user)

    session.add(workout)
    await session.commit()
    await session.refresh(workout)
    return workout_to_dict(workout)


@router.delete("/{workout_id}")
async def delete_workout(
    workout_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user.id)
    )
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(404, "Тренировка не найдена")

    volume = compute_workout_volume(workout.entries)
    user.total_volume_kg = max((user.total_volume_kg or 0) - volume, 0)

    # Списываем XP, который был начислен за эту тренировку — иначе можно
    # было фармить опыт циклом «создал-удалил-создал»
    if workout.xp_earned:
        award_xp(session, user, -workout.xp_earned, source="workout_delete")
    session.add(user)

    await session.delete(workout)
    await session.commit()
    return {"ok": True}
