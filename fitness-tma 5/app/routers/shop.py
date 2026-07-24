from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, Exercise, PurchasedWorkoutTemplate
from app.security import get_current_user
from app.shop_data import WORKOUT_TEMPLATES, SHOP_PRICE_STARS, GOAL_LABELS, GENDER_LABELS, LEVEL_LABELS
from app.bot import bot

router = APIRouter(prefix="/api/shop", tags=["shop"])


async def _resolve_exercises(session: AsyncSession) -> dict:
    """Имя упражнения -> {id, muscle_group}, одним запросом на все шаблоны сразу."""
    result = await session.execute(select(Exercise.id, Exercise.name, Exercise.muscle_group))
    return {name: {"id": eid, "muscle_group": mg} for eid, name, mg in result.all()}


@router.get("/templates")
async def list_templates(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    owned_result = await session.execute(
        select(PurchasedWorkoutTemplate.template_id).where(PurchasedWorkoutTemplate.user_id == user.id)
    )
    owned_ids = {row[0] for row in owned_result.all()}

    name_to_ex = await _resolve_exercises(session)

    templates = []
    for t in WORKOUT_TEMPLATES:
        exercises = []
        for name, hint in t["exercises"]:
            info = name_to_ex.get(name)
            exercises.append({
                "exercise_id": info["id"] if info else None,
                "exercise_name": name,
                "muscle_group": info["muscle_group"] if info else None,
                "hint": hint,
            })
        templates.append({
            "id": t["id"], "title": t["title"], "description": t["description"],
            "goal": t["goal"], "goal_label": GOAL_LABELS.get(t["goal"], t["goal"]),
            "gender": t["gender"], "gender_label": GENDER_LABELS.get(t["gender"], t["gender"]),
            "level": t["level"], "level_label": LEVEL_LABELS.get(t["level"], t["level"]),
            "price_stars": SHOP_PRICE_STARS,
            "exercises": exercises,
            "owned": t["id"] in owned_ids,
        })

    return {"templates": templates, "price_stars": SHOP_PRICE_STARS}


@router.get("/my-purchases")
async def my_purchases(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(PurchasedWorkoutTemplate.template_id).where(PurchasedWorkoutTemplate.user_id == user.id)
    )
    return {"template_ids": [row[0] for row in result.all()]}


@router.post("/purchase/{template_id}/create-invoice-link")
async def create_purchase_invoice(
    template_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    template = next((t for t in WORKOUT_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(404, "Тренировка не найдена")

    already_result = await session.execute(
        select(PurchasedWorkoutTemplate).where(
            PurchasedWorkoutTemplate.user_id == user.id, PurchasedWorkoutTemplate.template_id == template_id
        )
    )
    if already_result.scalar_one_or_none():
        raise HTTPException(400, "Эта тренировка уже куплена")

    link = await bot.create_invoice_link(
        title=f"FitApp: {template['title']}",
        description=template["description"],
        payload=f"shop_{user.telegram_id}_{template_id}",
        currency="XTR",
        prices=[{"label": template["title"], "amount": SHOP_PRICE_STARS}],
        provider_token="",
    )
    return {"invoice_link": link}
