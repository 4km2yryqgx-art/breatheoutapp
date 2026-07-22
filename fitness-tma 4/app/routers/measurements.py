from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, Measurement
from app.schemas import MeasurementIn
from app.security import get_current_user

router = APIRouter(prefix="/api/measurements", tags=["measurements"])


@router.get("")
async def list_measurements(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Measurement).where(Measurement.user_id == user.id).order_by(Measurement.date)
    )
    items = result.scalars().all()
    return [
        {
            "id": m.id, "date": m.date, "weight": m.weight,
            "biceps": m.biceps, "waist": m.waist, "hips": m.hips, "chest": m.chest,
        }
        for m in items
    ]


@router.post("")
async def add_measurement(
    data: MeasurementIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    m = Measurement(user_id=user.id, **data.model_dump())
    session.add(m)

    # синхронизируем текущий вес в профиле, если передан
    if data.weight:
        user.weight = data.weight
        session.add(user)

    await session.commit()
    await session.refresh(m)
    return {"id": m.id, "date": m.date, "weight": m.weight,
            "biceps": m.biceps, "waist": m.waist, "hips": m.hips, "chest": m.chest}
