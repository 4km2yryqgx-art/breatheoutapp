import calendar as pycalendar
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, Habit, HabitLog
from app.schemas import HabitIn, HabitToggleIn
from app.security import get_current_user
from app.xp_utils import award_xp
from app.achievements_engine import evaluate_achievements

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

    await evaluate_achievements(session, user)

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
    """Отметка может быть за ЛЮБУЮ дату (не только сегодня) — нужно для месячного календаря."""
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
        award_xp(session, user, xp_delta, source="habit")

    await session.commit()

    new_codes = await evaluate_achievements(session, user)

    return {"ok": True, "xp_delta": xp_delta, "xp": user.xp, "level": user.level, "new_achievements": new_codes}


@router.get("/calendar")
async def habits_calendar(
    month: str | None = None,  # формат "YYYY-MM", по умолчанию текущий месяц
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Календарная сетка на месяц: для каждого дня — сколько привычек выполнено из скольки."""
    require_premium(user)

    now = datetime.utcnow()
    year, mon = (int(x) for x in month.split("-")) if month else (now.year, now.month)
    days_in_month = pycalendar.monthrange(year, mon)[1]

    habits_result = await session.execute(
        select(Habit).where(Habit.user_id == user.id, Habit.archived == False)  # noqa: E712
    )
    habits = habits_result.scalars().all()
    total_habits = len(habits)

    prefix = f"{year:04d}-{mon:02d}-"
    logs_result = await session.execute(
        select(HabitLog).where(
            HabitLog.user_id == user.id, HabitLog.done == True, HabitLog.date.like(f"{prefix}%")  # noqa: E712
        )
    )
    logs = logs_result.scalars().all()

    done_by_day = {}
    for log in logs:
        done_by_day.setdefault(log.date, set()).add(log.habit_id)

    days = []
    completed_days = 0
    today_str = now.strftime("%Y-%m-%d")
    for d in range(1, days_in_month + 1):
        date_str = f"{prefix}{d:02d}"
        done_count = len(done_by_day.get(date_str, set()))
        is_full = total_habits > 0 and done_count >= total_habits
        if is_full:
            completed_days += 1
        days.append({
            "date": date_str, "done_count": done_count, "total": total_habits,
            "is_full": is_full, "is_future": date_str > today_str,
        })

    passed_days = sum(1 for d in days if not d["is_future"])
    success_percent = round((completed_days / passed_days) * 100, 1) if passed_days > 0 else 0

    return {"year": year, "month": mon, "days": days, "success_percent": success_percent, "total_habits": total_habits}


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
