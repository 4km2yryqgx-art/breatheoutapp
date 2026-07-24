from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, User, CoachLink, Measurement, Workout, TrainingDay, WeeklySchedule
from app.schemas import CoachInviteIn, CoachAssignPlanIn
from app.security import get_current_user
from app.bot import bot, send_coach_invite_message

router = APIRouter(prefix="/api/coach", tags=["coach"])


@router.post("/enable")
async def enable_coach_mode(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user.is_coach = True
    session.add(user)
    await session.commit()
    return {"ok": True}


@router.post("/invite")
async def invite_student(
    data: CoachInviteIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not user.is_coach:
        raise HTTPException(403, "Сначала включи режим тренера")

    username = data.username.strip().lstrip("@")
    result = await session.execute(select(User).where(func.lower(User.username) == username.lower()))
    student = result.scalar_one_or_none()

    if not student:
        raise HTTPException(404, "Пользователь с таким @username не найден. Он должен хотя бы раз открыть FitApp.")
    if student.id == user.id:
        raise HTTPException(400, "Нельзя пригласить самого себя")

    existing_result = await session.execute(
        select(CoachLink).where(CoachLink.coach_id == user.id, CoachLink.student_id == student.id)
    )
    existing = existing_result.scalar_one_or_none()
    if existing and existing.status == "accepted":
        raise HTTPException(400, "Этот пользователь уже твой ученик")
    if existing and existing.status == "pending":
        raise HTTPException(400, "Приглашение уже отправлено, ждём подтверждения")

    link = CoachLink(coach_id=user.id, student_id=student.id, status="pending")
    session.add(link)
    await session.commit()
    await session.refresh(link)

    try:
        await send_coach_invite_message(student.telegram_id, user.nickname or "Тренер", link.id)
    except Exception:
        pass  # бот всё равно создал приглашение, ученик увидит его при следующем сообщении/попытке

    return {"ok": True, "message": f"Приглашение отправлено пользователю @{username}"}


@router.get("/students")
async def list_students(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(CoachLink, User).join(User, User.id == CoachLink.student_id)
        .where(CoachLink.coach_id == user.id, CoachLink.status == "accepted")
    )
    rows = result.all()
    return [
        {
            "student_id": u.id, "nickname": u.nickname, "username": u.username,
            "level": u.level, "streak_days": u.streak_days, "goal": u.goal,
        }
        for _, u in rows
    ]


async def _require_accepted_link(session: AsyncSession, coach_id: int, student_id: int):
    result = await session.execute(
        select(CoachLink).where(
            CoachLink.coach_id == coach_id, CoachLink.student_id == student_id, CoachLink.status == "accepted"
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(403, "Этот пользователь не твой ученик")


@router.get("/students/{student_id}/progress")
async def student_progress(
    student_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_accepted_link(session, user.id, student_id)

    student_result = await session.execute(select(User).where(User.id == student_id))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(404, "Ученик не найден")

    measurements_result = await session.execute(
        select(Measurement).where(Measurement.user_id == student_id).order_by(Measurement.date)
    )
    measurements = measurements_result.scalars().all()

    workouts_result = await session.execute(
        select(Workout).where(Workout.user_id == student_id).order_by(Workout.date.desc()).limit(30)
    )
    workouts = workouts_result.scalars().unique().all()

    return {
        "profile": {
            "nickname": student.nickname, "level": student.level, "xp": student.xp,
            "streak_days": student.streak_days, "goal": student.goal, "bmi": student.bmi,
            "calories": student.calories, "total_volume_kg": round(student.total_volume_kg or 0, 1),
        },
        "measurements": [
            {"date": m.date, "weight": m.weight, "waist": m.waist, "biceps": m.biceps, "hips": m.hips, "chest": m.chest}
            for m in measurements
        ],
        "recent_workouts": [
            {"id": w.id, "date": w.date, "title": w.title, "exercises_count": len(w.entries), "xp_earned": w.xp_earned}
            for w in workouts
        ],
    }


@router.post("/students/{student_id}/assign-week")
async def assign_week(
    student_id: int,
    data: CoachAssignPlanIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Тренер удалённо создаёт дни тренировок ученику и расставляет их по будням Пн-Пт."""
    await _require_accepted_link(session, user.id, student_id)

    created_days = []
    for day_data in data.training_days:
        t = TrainingDay(user_id=student_id, name=day_data.name, exercise_ids=day_data.exercise_ids)
        session.add(t)
        await session.flush()
        created_days.append(t)

    for i, t in enumerate(created_days[:7]):
        result = await session.execute(
            select(WeeklySchedule).where(WeeklySchedule.user_id == student_id, WeeklySchedule.weekday == i)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.training_day_id = t.id
            session.add(existing)
        else:
            session.add(WeeklySchedule(user_id=student_id, weekday=i, training_day_id=t.id))

    await session.commit()

    student_result = await session.execute(select(User).where(User.id == student_id))
    student = student_result.scalar_one_or_none()
    if student:
        try:
            await bot.send_message(
                student.telegram_id,
                f"🏋️ Твой тренер назначил новый план тренировок на неделю! Загляни в раздел «Планы».",
            )
        except Exception:
            pass

    return {"ok": True, "created_days": len(created_days)}
