from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User
from app.schemas import OnboardingIn, ProfileUpdateIn
from app.security import get_current_user
from app.ai_logic import calculate_nutrition

router = APIRouter(prefix="/api/profile", tags=["profile"])


def user_to_dict(u: User) -> dict:
    return {
        "id": u.id,
        "telegram_id": u.telegram_id,
        "username": u.username,
        "nickname": u.nickname,
        "avatar_url": u.avatar_url,
        "email": u.email,
        "onboarded": u.onboarded,
        "gender": u.gender,
        "age": u.age,
        "weight": u.weight,
        "height": u.height,
        "goal": u.goal,
        "activity_level": u.activity_level,
        "experience": u.experience,
        "bmi": u.bmi,
        "calories": u.calories,
        "protein_g": u.protein_g,
        "fat_g": u.fat_g,
        "carbs_g": u.carbs_g,
        "xp": u.xp,
        "level": u.level,
        "streak_days": u.streak_days,
        "is_premium": u.is_premium,
        "premium_until": u.premium_until,
    }


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return user_to_dict(user)


@router.post("/onboarding")
async def onboarding(
    data: OnboardingIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    nutrition = calculate_nutrition(
        data.gender, data.age, data.weight, data.height, data.activity_level, data.goal
    )

    user.gender = data.gender
    user.age = data.age
    user.weight = data.weight
    user.height = data.height
    user.goal = data.goal
    user.activity_level = data.activity_level
    user.experience = data.experience
    user.bmi = nutrition["bmi"]
    user.calories = nutrition["calories"]
    user.protein_g = nutrition["protein_g"]
    user.fat_g = nutrition["fat_g"]
    user.carbs_g = nutrition["carbs_g"]
    user.onboarded = True

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user_to_dict(user)


@router.put("/update")
async def update_profile(
    data: ProfileUpdateIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if data.nickname is not None:
        user.nickname = data.nickname
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url
    if data.email is not None:
        user.email = data.email

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user_to_dict(user)
