from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User
from app.schemas import OnboardingIn, ProfileUpdateIn, ChangeGoalIn, SettingsUpdateIn
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
        "total_volume_kg": round(u.total_volume_kg or 0, 1),
        "hide_supplements_tips": u.hide_supplements_tips,
        "is_coach": u.is_coach,
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

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user_to_dict(user)


@router.put("/change-goal")
async def change_goal(
    data: ChangeGoalIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Меняет цель и мгновенно пересчитывает КБЖУ под неё.
    Отдельного хранилища "старых рекомендаций ИИ" в системе нет —
    /api/plans/ai/* всегда считает план заново по текущим данным анкеты,
    поэтому смена цели автоматически "обнуляет" старые планы: следующий
    запрос генерации использует уже новый goal (другие диапазоны повторений
    и приоритет оборудования — см. app/ai_logic.py GOAL_TRAINING_PROFILE).
    """
    if data.goal not in ("lose", "gain", "relief", "endurance"):
        raise HTTPException(400, "Некорректная цель")
    if not all([user.gender, user.age, user.weight, user.height, user.activity_level]):
        raise HTTPException(400, "Сначала заполни анкету (онбординг)")

    nutrition = calculate_nutrition(user.gender, user.age, user.weight, user.height, user.activity_level, data.goal)
    user.goal = data.goal
    user.bmi = nutrition["bmi"]
    user.calories = nutrition["calories"]
    user.protein_g = nutrition["protein_g"]
    user.fat_g = nutrition["fat_g"]
    user.carbs_g = nutrition["carbs_g"]

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user_to_dict(user)


@router.put("/settings")
async def update_settings(
    data: SettingsUpdateIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if data.hide_supplements_tips is not None:
        user.hide_supplements_tips = data.hide_supplements_tips
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user_to_dict(user)


@router.get("/supplements-tips")
async def supplements_tips(user: User = Depends(get_current_user)):
    """
    Раздел «Спортивный нутрициолог» (Premium). Общие образовательные советы,
    не персональные медицинские дозировки — при сомнениях стоит свериться
    с врачом или спортивным диетологом.
    """
    return {
        "disclaimer": "Это общие образовательные советы, а не персональная медицинская рекомендация.",
        "brands_mentioned": ["Refuel", "Regfull"],
        "sections": [
            {
                "title": "До тренировки",
                "tips": [
                    "Порция быстрых углеводов за 30-60 минут для энергии (банан, овсянка).",
                    "Креатин моногидрат 3-5 г — работает накопительно, время приёма не критично, но многие пьют именно до тренировки.",
                    "200-300 мл воды с электролитами (например Refuel Electrolytes), если тренировка длинная или в жару.",
                ],
            },
            {
                "title": "После тренировки",
                "tips": [
                    "20-40 г белка в течение 1-2 часов после (сывороточный протеин, например Regfull Whey, либо обычная еда с белком).",
                    "Не забывай про углеводы после тренировки — они помогают восстановить гликоген.",
                    "Электролиты и вода — особенно если много потел.",
                ],
            },
            {
                "title": "Базовые добавки на каждый день",
                "tips": [
                    "Креатин моногидрат 3-5 г ежедневно — самая изученная добавка для силовых показателей.",
                    "Протеин — удобный способ добрать дневную норму белка, не заменяет обычную еду.",
                    "Электролиты (натрий, калий, магний) — особенно при высокой активности или жаркой погоде.",
                ],
            },
        ],
    }
