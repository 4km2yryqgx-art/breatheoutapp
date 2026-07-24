from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import User, Workout, WorkoutEntry, UserAchievement, Habit, ChallengeCompletion
from app.ai_logic import check_new_achievements
from app.challenges_data import current_week_key
from app.leaderboard_utils import get_weekly_rank


async def evaluate_achievements(session: AsyncSession, user: User) -> list[str]:
    """
    Считает все метрики пользователя и разблокирует новые достижения.
    Возвращает список кодов НОВЫХ ачивок (уже сохранённых в БД).
    Вызывать после: сохранения тренировки, создания привычки,
    выполнения испытания недели, оформления Premium.
    """
    total_workouts_result = await session.execute(
        select(func.count()).select_from(Workout).where(Workout.user_id == user.id)
    )
    total_workouts = total_workouts_result.scalar_one()

    week_key = current_week_key()
    workouts_result = await session.execute(
        select(Workout).where(Workout.user_id == user.id)
    )
    all_workouts = workouts_result.scalars().all()
    workouts_this_week = sum(1 for w in all_workouts if _week_key_of_date(w.date) == week_key)
    is_early_bird = any(w.created_hour is not None and w.created_hour < 7 for w in all_workouts)
    is_night_owl = any(w.created_hour is not None and w.created_hour >= 23 for w in all_workouts)

    distinct_result = await session.execute(
        select(func.count(distinct(WorkoutEntry.exercise_id)))
        .join(Workout, Workout.id == WorkoutEntry.workout_id)
        .where(Workout.user_id == user.id)
    )
    distinct_exercises = distinct_result.scalar_one()

    habit_count_result = await session.execute(
        select(func.count()).select_from(Habit).where(Habit.user_id == user.id, Habit.archived == False)  # noqa: E712
    )
    habit_count = habit_count_result.scalar_one()

    challenge_result = await session.execute(
        select(func.count()).select_from(ChallengeCompletion).where(ChallengeCompletion.user_id == user.id)
    )
    challenge_completions = challenge_result.scalar_one()

    weekly_rank = await get_weekly_rank(session, user.id)

    stats = {
        "total_workouts": total_workouts,
        "workouts_this_week": workouts_this_week,
        "distinct_exercises": distinct_exercises,
        "habit_count": habit_count,
        "challenge_completions": challenge_completions,
        "weekly_rank": weekly_rank,
        "is_early_bird": is_early_bird,
        "is_night_owl": is_night_owl,
    }

    unlocked_result = await session.execute(
        select(UserAchievement.code).where(UserAchievement.user_id == user.id)
    )
    already_unlocked = {row[0] for row in unlocked_result.all()}

    new_codes = check_new_achievements(user, stats, already_unlocked)
    for code in new_codes:
        session.add(UserAchievement(user_id=user.id, code=code))
    if new_codes:
        await session.commit()

    return new_codes


def _week_key_of_date(date_str: str) -> str:
    import datetime
    dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    year, week, _ = dt.isocalendar()
    return f"{year}-W{week:02d}"
