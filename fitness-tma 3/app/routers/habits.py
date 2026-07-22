from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, Habit, HabitLog
from app.schemas import HabitIn, HabitToggleIn
from app.security import get_current_user
from app.ai_logic import level_from_xp

router = APIRouter(prefix="/api/habits", tags=["habits"])

HABIT_XP_REWARD = 15


def user_is_premium(user: User) -> bool:
    if not user.is_premium:
        return False
    if user.premium_until is None:
        return True  # lifetime
    return datetime.utcnow() <= datetime.strptime(user.premium_until, "%Y-%m-%d")


def require_premium(user: User):
    if not user_is_premium(user):
        raise HTTPException(403, "Доступно только с Premium подпиской")


@router.get("")
async def list_habits(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    require_premium(user)

    today = datetime.utcnow().strftime("%Y-%m-%d")
    result = await session.execute(
        select(Habit).where(Habit.user_id == user.id, Habit.archived == False)  # noqa: E712
    )
    habits = result.scalars().all()

    logs_result = await session.execute(
        select(HabitLog).where(HabitLog.user_id == user.id, HabitLog.date == today, HabitLog.done == True)  # noqa: E712
    )
    done_today = {log.habit_id for log in logs_result.scalars().all()}

    return [
        {"id": h.id, "title": h.title, "icon": h.icon, "done_today": h.id in done_today}
        for h in habits
    ]


@router.post("")
async def create_habit(
    data: HabitIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    require_premium(user)
    h = Habit(user_id=user.id, title=data.title, icon=data.icon or "sparkles")
    session.add(h)
    await session.commit()
    await session.refresh(h)
    return {"id": h.id, "title": h.title, "icon": h.icon, "done_today": False}


@router.delete("/{habit_id}")
async def delete_habit(
    habit_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    require_premium(user)
    await session.execute(delete(Habit).where(Habit.id == habit_id, Habit.user_id == user.id))
    await session.commit()
    return {"ok": True}


@router.post("/{habit_id}/toggle")
async def toggle_habit(
    habit_id: int,
    data: HabitToggleIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    require_premium(user)

    result = await session.execute(
        select(HabitLog).where(
            HabitLog.habit_id == habit_id, HabitLog.user_id == user.id, HabitLog.date == data.date
        )
    )
    existing = result.scalar_one_or_none()

    xp_delta = 0
    if data.done:
        if not existing:
            session.add(HabitLog(habit_id=habit_id, user_id=user.id, date=data.date, done=True))
            xp_delta = HABIT_XP_REWARD
        elif not existing.done:
            existing.done = True
            session.add(existing)
            xp_delta = HABIT_XP_REWARD
    else:
        if existing and existing.done:
            existing.done = False
            session.add(existing)
            xp_delta = -HABIT_XP_REWARD

    if xp_delta:
        user.xp = max((user.xp or 0) + xp_delta, 0)
        user.level = level_from_xp(user.xp)
        session.add(user)

    await session.commit()
    return {"ok": True, "xp_delta": xp_delta, "xp": user.xp, "level": user.level}


@router.get("/stats")
async def habit_stats(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    require_premium(user)
    result = await session.execute(
        select(HabitLog).where(HabitLog.user_id == user.id, HabitLog.done == True)  # noqa: E712
    )
    logs = result.scalars().all()
    total_completions = len(logs)
    unique_days = len({log.date for log in logs})
    return {"total_completions": total_completions, "active_days": unique_days}
