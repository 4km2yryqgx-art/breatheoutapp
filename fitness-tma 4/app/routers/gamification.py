from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, UserAchievement, Achievement
from app.security import get_current_user
from app.ai_logic import xp_for_level

router = APIRouter(prefix="/api/gamification", tags=["gamification"])


@router.get("/me")
async def my_gamification(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    unlocked_result = await session.execute(
        select(UserAchievement.code).where(UserAchievement.user_id == user.id)
    )
    unlocked_codes = {row[0] for row in unlocked_result.all()}

    catalog_result = await session.execute(select(Achievement))
    catalog = catalog_result.scalars().all()

    achievements = [
        {
            "code": a.code,
            "title": a.title if (a.code in unlocked_codes or not a.is_hidden) else "???",
            "description": a.description if (a.code in unlocked_codes or not a.is_hidden) else "Секретное достижение — узнаешь, когда откроешь",
            "icon": a.icon if (a.code in unlocked_codes or not a.is_hidden) else "help-circle",
            "is_hidden": a.is_hidden,
            "unlocked": a.code in unlocked_codes,
        }
        for a in catalog
    ]

    next_level_xp = xp_for_level(user.level + 1)
    current_level_xp = xp_for_level(user.level)
    progress = 0
    if next_level_xp > current_level_xp:
        progress = round(
            (user.xp - current_level_xp) / (next_level_xp - current_level_xp) * 100, 1
        )

    return {
        "xp": user.xp,
        "level": user.level,
        "streak_days": user.streak_days,
        "xp_to_next_level": max(next_level_xp - user.xp, 0),
        "progress_percent": max(min(progress, 100), 0),
        "achievements": achievements,
    }
