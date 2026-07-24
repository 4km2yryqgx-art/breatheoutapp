from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, ChallengeCompletion
from app.security import get_current_user
from app.challenges_data import current_week_key, get_challenge_for_week, CHALLENGE_XP_BONUS
from app.xp_utils import award_xp
from app.achievements_engine import evaluate_achievements

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


@router.get("/current")
async def current_challenge(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    week_key = current_week_key()
    challenge = get_challenge_for_week(week_key)

    result = await session.execute(
        select(ChallengeCompletion).where(
            ChallengeCompletion.user_id == user.id, ChallengeCompletion.week_key == week_key
        )
    )
    completed = result.scalar_one_or_none() is not None

    return {
        "title": challenge["title"],
        "week_key": week_key,
        "bonus_xp": CHALLENGE_XP_BONUS,
        "completed": completed,
    }


@router.post("/complete")
async def complete_challenge(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    week_key = current_week_key()
    challenge = get_challenge_for_week(week_key)

    result = await session.execute(
        select(ChallengeCompletion).where(
            ChallengeCompletion.user_id == user.id, ChallengeCompletion.week_key == week_key
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(400, "Испытание этой недели уже выполнено")

    session.add(ChallengeCompletion(user_id=user.id, week_key=week_key, challenge_index=challenge["index"]))
    award_xp(session, user, CHALLENGE_XP_BONUS, source="challenge")
    await session.commit()

    new_codes = await evaluate_achievements(session, user)

    return {"ok": True, "xp_earned": CHALLENGE_XP_BONUS, "new_achievements": new_codes, "level": user.level}
