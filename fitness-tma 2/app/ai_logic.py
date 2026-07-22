import math
import random
from datetime import datetime, timedelta

ACTIVITY_MULTIPLIER = {1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9}

GOAL_CALORIE_ADJUST = {
    "lose": -0.20,      # похудение: дефицит 20%
    "gain": 0.15,       # набор массы: профицит 15%
    "relief": -0.10,    # рельеф: небольшой дефицит
    "endurance": 0.0,   # выносливость: поддержание
}

# г белка/жира на кг веса в зависимости от цели
GOAL_MACROS = {
    "lose": {"protein": 2.2, "fat": 0.9},
    "gain": {"protein": 2.0, "fat": 1.0},
    "relief": {"protein": 2.4, "fat": 0.8},
    "endurance": {"protein": 1.8, "fat": 1.0},
}


def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    h_m = height_cm / 100
    return round(weight_kg / (h_m ** 2), 1)


def calculate_nutrition(gender: str, age: int, weight: float, height: float,
                         activity_level: int, goal: str) -> dict:
    """Формула Миффлина-Сан Жеора для базового метаболизма + корректировка под цель."""
    if gender == "male":
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161

    tdee = bmr * ACTIVITY_MULTIPLIER.get(activity_level, 1.375)
    adjusted = tdee * (1 + GOAL_CALORIE_ADJUST.get(goal, 0))

    macros = GOAL_MACROS.get(goal, GOAL_MACROS["endurance"])
    protein_g = round(weight * macros["protein"])
    fat_g = round(weight * macros["fat"])
    protein_cal = protein_g * 4
    fat_cal = fat_g * 9
    carbs_cal = max(adjusted - protein_cal - fat_cal, 0)
    carbs_g = round(carbs_cal / 4)

    return {
        "bmi": calculate_bmi(weight, height),
        "calories": round(adjusted),
        "protein_g": protein_g,
        "fat_g": fat_g,
        "carbs_g": carbs_g,
    }


def generate_weekly_plan(goal: str, experience: str, activity_level: int) -> list:
    """Генерирует названия и структуру тренировочных дней на неделю (rule-based ИИ)."""
    days_per_week = {
        1: 2, 2: 3, 3: 3, 4: 4, 5: 5,
    }.get(activity_level, 3)

    if goal == "endurance":
        templates = ["Кардио + низ тела", "Кардио + верх тела", "Круговая тренировка",
                     "Лёгкое кардио + пресс", "Интервальное кардио"]
    elif experience == "beginner":
        templates = ["Всё тело A", "Всё тело B", "Всё тело C", "Всё тело D", "Всё тело E"]
    else:
        templates = ["Грудь/Трицепс", "Спина/Бицепс", "Ноги/Плечи", "Плечи/Пресс", "Full Body"]

    plan = []
    for i in range(days_per_week):
        plan.append({"day_index": i, "name": templates[i % len(templates)]})
    return plan


def generate_ai_workout(exercises: list, location: str, feeling: str, muscle_focus: str = None) -> list:
    """
    Простой rule-based 'ИИ'-подбор упражнений под самочувствие и доступное оборудование.
    exercises: список dict {id, name, muscle_group, equipment}
    """
    if location == "home":
        allowed_equipment = {"bodyweight", "dumbbell", "other"}
    else:
        allowed_equipment = {"barbell", "dumbbell", "machine", "cable", "bodyweight", "other"}

    pool = [e for e in exercises if e["equipment"] in allowed_equipment]
    if muscle_focus:
        focused = [e for e in pool if e["muscle_group"] == muscle_focus]
        if focused:
            pool = focused

    random.shuffle(pool)

    if feeling == "tired":
        count, sets, reps = 4, 3, "12-15"
    elif feeling == "great":
        count, sets, reps = 7, 4, "8-10"
    else:
        count, sets, reps = 5, 3, "10-12"

    selected = pool[:count]
    return [
        {"exercise_id": e["id"], "exercise_name": e["name"],
         "recommended_sets": sets, "recommended_reps": reps}
        for e in selected
    ]


# ================== ГЕЙМИФИКАЦИЯ ==================

def xp_for_level(level: int) -> int:
    """Сколько всего XP нужно для достижения уровня level."""
    return 50 * (level ** 2)


def level_from_xp(xp: int) -> int:
    return max(1, int(math.sqrt(xp / 50)))


def xp_reward_for_workout(num_exercises: int, num_sets: int) -> int:
    base = 20
    return base + num_exercises * 3 + num_sets * 2


def compute_streak(last_workout_date: str, today: str, current_streak: int) -> int:
    if not last_workout_date:
        return 1
    last = datetime.strptime(last_workout_date, "%Y-%m-%d")
    now = datetime.strptime(today, "%Y-%m-%d")
    diff = (now - last).days
    if diff == 0:
        return current_streak or 1
    if diff == 1:
        return (current_streak or 0) + 1
    return 1


ACHIEVEMENTS_CATALOG = [
    {"code": "first_workout", "title": "Первая сотня", "description": "Записал первую тренировку", "icon": "🏆"},
    {"code": "workouts_10", "title": "Втянулся", "description": "10 тренировок в дневнике", "icon": "💪"},
    {"code": "workouts_50", "title": "Ветеран зала", "description": "50 тренировок в дневнике", "icon": "🏅"},
    {"code": "streak_7", "title": "Неделя без прогулов", "description": "7 дней подряд с тренировками", "icon": "🔥"},
    {"code": "streak_30", "title": "Железная дисциплина", "description": "30 дней подряд", "icon": "⚡"},
    {"code": "level_5", "title": "Растущая сила", "description": "Достигнут 5 уровень", "icon": "⭐"},
    {"code": "level_10", "title": "Профи", "description": "Достигнут 10 уровень", "icon": "🌟"},
    {"code": "premium", "title": "VIP атлет", "description": "Оформлена Premium подписка", "icon": "👑"},
]


def check_new_achievements(user, total_workouts: int, already_unlocked: set) -> list:
    """Возвращает список кодов новых ачивок, которые нужно разблокировать."""
    new = []

    def unlock(code):
        if code not in already_unlocked:
            new.append(code)

    if total_workouts >= 1:
        unlock("first_workout")
    if total_workouts >= 10:
        unlock("workouts_10")
    if total_workouts >= 50:
        unlock("workouts_50")
    if user.streak_days >= 7:
        unlock("streak_7")
    if user.streak_days >= 30:
        unlock("streak_30")
    if user.level >= 5:
        unlock("level_5")
    if user.level >= 10:
        unlock("level_10")
    if user.is_premium:
        unlock("premium")

    return new
