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

# ============================================================
# Параметры тренировки в зависимости от цели анкеты.
# Именно ЦЕЛЬ (а не пол) определяет диапазон повторений и
# приоритет оборудования — это методологически корректнее и
# не опирается на стереотипы: набор массы всегда тяжелее и
# многосуставнее вне зависимости от того, кто тренируется.
# ============================================================
GOAL_TRAINING_PROFILE = {
    "gain":      {"reps": "8-12",  "sets": 4, "count_base": 5, "priority_equipment": ["barbell", "machine", "dumbbell", "cable", "bodyweight", "other"]},
    "lose":      {"reps": "15-20", "sets": 3, "count_base": 6, "priority_equipment": ["bodyweight", "cable", "dumbbell", "machine", "other", "barbell"]},
    "relief":    {"reps": "15-20", "sets": 3, "count_base": 6, "priority_equipment": ["dumbbell", "cable", "bodyweight", "machine", "other", "barbell"]},
    "endurance": {"reps": "15-20", "sets": 3, "count_base": 7, "priority_equipment": ["bodyweight", "other", "cable", "dumbbell", "machine", "barbell"]},
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
    days_per_week = {1: 2, 2: 3, 3: 3, 4: 4, 5: 5}.get(activity_level, 3)

    if goal == "endurance":
        templates = ["Кардио + низ тела", "Кардио + верх тела", "Круговая тренировка",
                     "Лёгкое кардио + пресс", "Интервальное кардио"]
    elif goal in ("lose", "relief"):
        templates = ["Круговая на всё тело A", "Круговая на всё тело B", "Верх тела + кардио",
                     "Низ тела + кардио", "Метаболический full body"]
    elif experience == "beginner":
        templates = ["Всё тело A", "Всё тело B", "Всё тело C", "Всё тело D", "Всё тело E"]
    else:
        templates = ["Грудь/Трицепс", "Спина/Бицепс", "Ноги/Плечи", "Плечи/Пресс", "Full Body силовая"]

    plan = []
    for i in range(days_per_week):
        plan.append({"day_index": i, "name": templates[i % len(templates)]})
    return plan


def generate_ai_workout(exercises: list, location: str, feeling: str, goal: str = None,
                         muscle_focus: str = None, recent_exercise_ids: list = None) -> list:
    """
    Rule-based 'ИИ'-подбор упражнений под цель анкеты, самочувствие, доступное
    оборудование. Разнообразие обеспечивается депriоритизацией недавно
    использованных упражнений (recent_exercise_ids) при случайном отборе.
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

    profile = GOAL_TRAINING_PROFILE.get(goal, GOAL_TRAINING_PROFILE["endurance"])
    recent_ids = set(recent_exercise_ids or [])

    # Разделяем на "свежие" (не использовались недавно) и "недавние" —
    # свежие тасуем и ставим вперёд, чтобы план не повторялся неделя в неделю
    fresh = [e for e in pool if e["id"] not in recent_ids]
    recent = [e for e in pool if e["id"] in recent_ids]
    random.shuffle(fresh)
    random.shuffle(recent)

    # Внутри "свежих" сортируем по приоритету оборудования под цель
    equip_rank = {eq: i for i, eq in enumerate(profile["priority_equipment"])}
    fresh.sort(key=lambda e: equip_rank.get(e["equipment"], 99))

    ordered_pool = fresh + recent

    feeling_adjust = {"tired": -1, "great": 1, "normal": 0}.get(feeling, 0)
    count = max(profile["count_base"] + feeling_adjust, 3)
    sets = profile["sets"] + (1 if feeling == "great" else 0) - (1 if feeling == "tired" else 0)
    sets = max(sets, 2)
    reps = profile["reps"]

    selected = ordered_pool[:count]
    return [
        {"exercise_id": e["id"], "exercise_name": e["name"], "muscle_group": e["muscle_group"],
         "recommended_sets": sets, "recommended_reps": reps}
        for e in selected
    ]


def compute_workout_volume(entries: list) -> float:
    """Суммарный поднятый тоннаж тренировки: сумма (вес × повторы) по всем подходам.
    Работает как с ORM-объектами (entries[].sets — list[dict]),
    так и с Pydantic-схемами (entries[].sets — list[SetIn])."""
    total = 0.0
    for entry in entries:
        sets = entry.sets if hasattr(entry, "sets") else entry.get("sets", [])
        for s in sets:
            if isinstance(s, dict):
                weight, reps = s.get("weight", 0), s.get("reps", 0)
            else:
                weight, reps = getattr(s, "weight", 0), getattr(s, "reps", 0)
            total += (weight or 0) * (reps or 0)
    return total


# ================== ГЕЙМИФИКАЦИЯ ==================
#
# Новая формула прогрессии (v2): xp_for_level(L) = 40 * (L-1) * L
# Даёт нарастающий, но не убийственный шаг между уровнями:
#   Ур.2 — 80 XP, Ур.3 — 240 XP, Ур.4 — 480 XP, Ур.5 — 800 XP,
#   Ур.10 — 3600 XP, Ур.20 — 15200 XP, Ур.30 — 34800 XP.
# Ранние уровни (и, соответственно, титулы) открываются быстро —
# буквально за несколько тренировок, — а на высоких уровнях кривая
# закономерно круче, как и просили: "быстрый старт, долгий путь наверх".

def xp_for_level(level: int) -> int:
    """Сколько ВСЕГО XP нужно для достижения уровня level (level=1 -> 0 XP)."""
    level = max(level, 1)
    return 40 * (level - 1) * level


def level_from_xp(xp: int) -> int:
    """Итеративный подбор уровня — без float sqrt, чтобы не ловить пограничные
    ошибки округления ровно на границе уровня (именно это раньше давало
    ощущение "набрал ровно сколько нужно, а уровень не поднялся")."""
    xp = max(xp or 0, 0)
    level = 1
    while xp_for_level(level + 1) <= xp:
        level += 1
    return level


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


# ============================================================
# КАТАЛОГ ДОСТИЖЕНИЙ (20 шт., часть — секретные: is_hidden=True
# означает, что название/описание скрыты до разблокировки)
# ============================================================
ACHIEVEMENTS_CATALOG = [
    {"code": "first_workout", "title": "Первая тренировка", "description": "Записал первую тренировку в дневник", "icon": "🏆", "is_hidden": False},
    {"code": "workouts_10", "title": "Втянулся", "description": "10 тренировок в дневнике", "icon": "💪", "is_hidden": False},
    {"code": "workouts_50", "title": "Ветеран зала", "description": "50 тренировок в дневнике", "icon": "🏅", "is_hidden": False},
    {"code": "workouts_100", "title": "Сотка", "description": "100 тренировок в дневнике", "icon": "💯", "is_hidden": False},
    {"code": "streak_7", "title": "Неделя без прогулов", "description": "7 дней подряд с тренировками", "icon": "🔥", "is_hidden": False},
    {"code": "streak_30", "title": "Железная дисциплина", "description": "30 дней подряд", "icon": "⚡", "is_hidden": False},
    {"code": "streak_100", "title": "Стрик-легенда", "description": "100 дней подряд с тренировками", "icon": "🌋", "is_hidden": False},
    {"code": "level_5", "title": "Растущая сила", "description": "Достигнут 5 уровень", "icon": "⭐", "is_hidden": False},
    {"code": "level_10", "title": "Профи", "description": "Достигнут 10 уровень", "icon": "🌟", "is_hidden": False},
    {"code": "level_20", "title": "Мастер зала", "description": "Достигнут 20 уровень", "icon": "🎖️", "is_hidden": False},
    {"code": "premium", "title": "VIP атлет", "description": "Оформлена Premium подписка", "icon": "👑", "is_hidden": False},
    {"code": "early_bird", "title": "Ранняя пташка", "description": "Тренировка до 7 утра", "icon": "🌅", "is_hidden": True},
    {"code": "night_owl", "title": "Полуночник", "description": "Тренировка после 23:00", "icon": "🦉", "is_hidden": True},
    {"code": "iron_man", "title": "Железный человек", "description": "Суммарно поднято 10 000 кг тоннажа", "icon": "🤖", "is_hidden": False},
    {"code": "iron_titan", "title": "Титан", "description": "Суммарно поднято 50 000 кг тоннажа", "icon": "🏔️", "is_hidden": True},
    {"code": "week_warrior", "title": "Воин недели", "description": "3 тренировки за одну календарную неделю", "icon": "🗡️", "is_hidden": False},
    {"code": "weekly_champion", "title": "Чемпион недели", "description": "1 место в недельном лидерборде", "icon": "🥇", "is_hidden": True},
    {"code": "challenge_hunter", "title": "Охотник за испытаниями", "description": "Выполнил испытание недели 3 раза", "icon": "🎯", "is_hidden": True},
    {"code": "habit_starter", "title": "Новая привычка", "description": "Создал первую привычку в трекере", "icon": "✅", "is_hidden": False},
    {"code": "exercise_explorer", "title": "Исследователь", "description": "Выполнил 15 разных упражнений", "icon": "🧭", "is_hidden": True},
]


def check_new_achievements(user, stats: dict, already_unlocked: set) -> list:
    """
    Возвращает список кодов новых ачивок для разблокировки.
    stats — словарь с посчитанными на бэкенде метриками:
      total_workouts, workouts_this_week, distinct_exercises,
      weekly_rank (int|None), challenge_completions, habit_count,
      is_early_bird, is_night_owl
    """
    new = []

    def unlock(code):
        if code not in already_unlocked:
            new.append(code)

    if stats.get("total_workouts", 0) >= 1:
        unlock("first_workout")
    if stats.get("total_workouts", 0) >= 10:
        unlock("workouts_10")
    if stats.get("total_workouts", 0) >= 50:
        unlock("workouts_50")
    if stats.get("total_workouts", 0) >= 100:
        unlock("workouts_100")
    if user.streak_days >= 7:
        unlock("streak_7")
    if user.streak_days >= 30:
        unlock("streak_30")
    if user.streak_days >= 100:
        unlock("streak_100")
    if user.level >= 5:
        unlock("level_5")
    if user.level >= 10:
        unlock("level_10")
    if user.level >= 20:
        unlock("level_20")
    if user.is_premium:
        unlock("premium")
    if stats.get("is_early_bird"):
        unlock("early_bird")
    if stats.get("is_night_owl"):
        unlock("night_owl")
    if user.total_volume_kg >= 10000:
        unlock("iron_man")
    if user.total_volume_kg >= 50000:
        unlock("iron_titan")
    if stats.get("workouts_this_week", 0) >= 3:
        unlock("week_warrior")
    if stats.get("weekly_rank") == 1:
        unlock("weekly_champion")
    if stats.get("challenge_completions", 0) >= 3:
        unlock("challenge_hunter")
    if stats.get("habit_count", 0) >= 1:
        unlock("habit_starter")
    if stats.get("distinct_exercises", 0) >= 15:
        unlock("exercise_explorer")

    return new
