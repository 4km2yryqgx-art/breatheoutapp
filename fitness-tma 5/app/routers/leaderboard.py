from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User
from app.security import get_current_user
from app.leaderboard_utils import get_weekly_leaderboard, get_weekly_rank

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("/weekly")
async def weekly_leaderboard(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    board = await get_weekly_leaderboard(session, limit=50)
    my_rank = await get_weekly_rank(session, user.id)
    return {"leaderboard": board, "my_rank": my_rank}
