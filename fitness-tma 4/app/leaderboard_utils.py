from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import XpEvent, User
from app.challenges_data import current_week_key


async def get_weekly_leaderboard(session: AsyncSession, limit: int = 50) -> list[dict]:
    week_key = current_week_key()
    result = await session.execute(
        select(XpEvent.user_id, func.sum(XpEvent.amount).label("weekly_xp"))
        .where(XpEvent.week_key == week_key)
        .group_by(XpEvent.user_id)
        .order_by(func.sum(XpEvent.amount).desc())
        .limit(limit)
    )
    rows = result.all()
    if not rows:
        return []

    user_ids = [r[0] for r in rows]
    users_result = await session.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    leaderboard = []
    for rank, (user_id, weekly_xp) in enumerate(rows, start=1):
        u = users_by_id.get(user_id)
        if not u:
            continue
        leaderboard.append({
            "rank": rank,
            "user_id": u.id,
            "nickname": u.nickname or "Атлет",
            "username": u.username,
            "level": u.level,
            "weekly_xp": int(weekly_xp),
        })
    return leaderboard


async def get_weekly_rank(session: AsyncSession, user_id: int) -> int | None:
    leaderboard = await get_weekly_leaderboard(session, limit=200)
    for entry in leaderboard:
        if entry["user_id"] == user_id:
            return entry["rank"]
    return None
