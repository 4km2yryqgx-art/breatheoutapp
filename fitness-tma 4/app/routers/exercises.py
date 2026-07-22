from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, Exercise
from app.schemas import ExerciseIn
from app.security import get_current_user

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


def ex_to_dict(e: Exercise) -> dict:
    return {
        "id": e.id, "name": e.name, "muscle_group": e.muscle_group,
        "equipment": e.equipment, "description": e.description, "is_custom": e.is_custom,
    }


@router.get("")
async def list_exercises(
    muscle_group: Optional[str] = None,
    search: Optional[str] = None,
    equipment: Optional[str] = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    query = select(Exercise).where(
        or_(Exercise.is_custom == False, Exercise.created_by == user.id)  # noqa: E712
    )
    if muscle_group:
        query = query.where(Exercise.muscle_group == muscle_group)
    if equipment:
        query = query.where(Exercise.equipment == equipment)
    if search:
        query = query.where(Exercise.name.ilike(f"%{search}%"))

    result = await session.execute(query.order_by(Exercise.name))
    return [ex_to_dict(e) for e in result.scalars().all()]


@router.post("")
async def create_exercise(
    data: ExerciseIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    e = Exercise(
        name=data.name, muscle_group=data.muscle_group, equipment=data.equipment,
        description=data.description, is_custom=True, created_by=user.id,
    )
    session.add(e)
    await session.commit()
    await session.refresh(e)
    return ex_to_dict(e)


@router.get("/muscle-groups")
async def muscle_groups():
    return [
        {"code": "chest", "label": "Грудь"},
        {"code": "back", "label": "Спина"},
        {"code": "legs", "label": "Ноги"},
        {"code": "glutes", "label": "Ягодицы"},
        {"code": "shoulders", "label": "Плечи"},
        {"code": "biceps", "label": "Бицепс"},
        {"code": "triceps", "label": "Трицепс"},
        {"code": "abs", "label": "Пресс"},
        {"code": "forearms", "label": "Предплечья"},
        {"code": "cardio", "label": "Кардио"},
    ]


@router.get("/{exercise_id}/pr")
async def exercise_personal_record(
    exercise_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Личный рекорд пользователя по конкретному упражнению — для подсказки в дневнике."""
    from app.database import Workout, WorkoutEntry

    result = await session.execute(
        select(WorkoutEntry)
        .join(Workout, Workout.id == WorkoutEntry.workout_id)
        .where(Workout.user_id == user.id, WorkoutEntry.exercise_id == exercise_id)
    )
    entries = result.scalars().all()

    if not entries:
        return {"has_history": False}

    best_weight, best_reps, total_sets = 0, 0, 0
    for entry in entries:
        for s in entry.sets:
            total_sets += 1
            weight = s.get("weight", 0) or 0
            if weight > best_weight:
                best_weight = weight
                best_reps = s.get("reps", 0) or 0

    return {
        "has_history": True,
        "best_weight": best_weight,
        "best_reps": best_reps,
        "total_sets": total_sets,
        "total_sessions": len(entries),
    }
