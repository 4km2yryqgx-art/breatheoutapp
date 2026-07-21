from sqlalchemy import select
from app.database import async_session, Exercise, Achievement
from app.ai_logic import ACHIEVEMENTS_CATALOG

# ============================================================
# БАЗА УПРАЖНЕНИЙ. Формат: (название, группа мышц, оборудование)
# Группы: chest, back, legs, shoulders, biceps, triceps, abs, cardio, glutes, forearms
# Оборудование: barbell, dumbbell, machine, cable, bodyweight, other
# Можно свободно добавлять сюда новые строки — база расширяемая.
# ============================================================
EXERCISES = [
    # ГРУДЬ
    ("Жим штанги лёжа", "chest", "barbell"),
    ("Жим штанги на наклонной скамье", "chest", "barbell"),
    ("Жим штанги на скамье с отриц. наклоном", "chest", "barbell"),
    ("Жим гантелей лёжа", "chest", "dumbbell"),
    ("Жим гантелей на наклонной скамье", "chest", "dumbbell"),
    ("Разведение гантелей лёжа", "chest", "dumbbell"),
    ("Разведение в кроссовере", "chest", "cable"),
    ("Сведение в тренажёре (баттерфляй)", "chest", "machine"),
    ("Жим в тренажёре Смита", "chest", "machine"),
    ("Отжимания от пола", "chest", "bodyweight"),
    ("Отжимания на брусьях", "chest", "bodyweight"),
    ("Пуловер с гантелей", "chest", "dumbbell"),
    ("Жим в хаммере", "chest", "machine"),
    ("Отжимания с узкой постановкой рук", "chest", "bodyweight"),

    # СПИНА
    ("Становая тяга", "back", "barbell"),
    ("Румынская становая тяга", "back", "barbell"),
    ("Тяга штанги в наклоне", "back", "barbell"),
    ("Тяга гантели в наклоне одной рукой", "back", "dumbbell"),
    ("Подтягивания широким хватом", "back", "bodyweight"),
    ("Подтягивания узким хватом", "back", "bodyweight"),
    ("Тяга верхнего блока широким хватом", "back", "cable"),
    ("Тяга верхнего блока узким хватом", "back", "cable"),
    ("Тяга горизонтального блока", "back", "cable"),
    ("Гиперэкстензия", "back", "bodyweight"),
    ("Тяга Т-грифа", "back", "machine"),
    ("Шраги со штангой", "back", "barbell"),
    ("Шраги с гантелями", "back", "dumbbell"),
    ("Тяга в тренажёре (гребная тяга)", "back", "machine"),

    # НОГИ
    ("Приседания со штангой", "legs", "barbell"),
    ("Фронтальные приседания", "legs", "barbell"),
    ("Жим ногами в тренажёре", "legs", "machine"),
    ("Выпады с гантелями", "legs", "dumbbell"),
    ("Болгарские сплит-приседания", "legs", "dumbbell"),
    ("Разгибание ног в тренажёре", "legs", "machine"),
    ("Сгибание ног в тренажёре лёжа", "legs", "machine"),
    ("Приседания в тренажёре Смита", "legs", "machine"),
    ("Гакк-приседания", "legs", "machine"),
    ("Приседания с гантелью (гоблет)", "legs", "dumbbell"),
    ("Подъём на носки стоя (икры)", "legs", "machine"),
    ("Подъём на носки сидя (икры)", "legs", "machine"),
    ("Приседания на одной ноге (пистолетик)", "legs", "bodyweight"),
    ("Приседания без веса", "legs", "bodyweight"),

    # ЯГОДИЦЫ
    ("Ягодичный мостик со штангой", "glutes", "barbell"),
    ("Тяга штанги к бедру (хип-траст)", "glutes", "barbell"),
    ("Отведение ноги в кроссовере", "glutes", "cable"),
    ("Отведение ноги в тренажёре", "glutes", "machine"),
    ("Ягодичный мостик на одной ноге", "glutes", "bodyweight"),

    # ПЛЕЧИ
    ("Жим штанги стоя (армейский жим)", "shoulders", "barbell"),
    ("Жим гантелей сидя", "shoulders", "dumbbell"),
    ("Махи гантелями в стороны", "shoulders", "dumbbell"),
    ("Махи гантелями в наклоне (задняя дельта)", "shoulders", "dumbbell"),
    ("Тяга штанги к подбородку", "shoulders", "barbell"),
    ("Жим Арнольда", "shoulders", "dumbbell"),
    ("Разведение в тренажёре (задняя дельта)", "shoulders", "machine"),
    ("Махи в кроссовере", "shoulders", "cable"),
    ("Жим в тренажёре сидя", "shoulders", "machine"),

    # БИЦЕПС
    ("Подъём штанги на бицепс", "biceps", "barbell"),
    ("Подъём гантелей на бицепс", "biceps", "dumbbell"),
    ("Молотковый подъём гантелей", "biceps", "dumbbell"),
    ("Подъём на бицепс на скамье Скотта", "biceps", "barbell"),
    ("Подъём гантелей на наклонной скамье", "biceps", "dumbbell"),
    ("Подъём на бицепс в блоке", "biceps", "cable"),
    ("Концентрированный подъём на бицепс", "biceps", "dumbbell"),

    # ТРИЦЕПС
    ("Жим штанги узким хватом", "triceps", "barbell"),
    ("Французский жим лёжа", "triceps", "barbell"),
    ("Разгибание рук на блоке (трицепс)", "triceps", "cable"),
    ("Разгибание руки с гантелью из-за головы", "triceps", "dumbbell"),
    ("Отжимания на брусьях (трицепс)", "triceps", "bodyweight"),
    ("Разгибание рук в наклоне с гантелью", "triceps", "dumbbell"),
    ("Обратные отжимания от скамьи", "triceps", "bodyweight"),

    # ПРЕСС
    ("Скручивания на пресс", "abs", "bodyweight"),
    ("Подъём ног в висе", "abs", "bodyweight"),
    ("Планка", "abs", "bodyweight"),
    ("Скручивания в блоке на канате", "abs", "cable"),
    ("Русский твист", "abs", "other"),
    ("Велосипед (пресс)", "abs", "bodyweight"),
    ("Подъём корпуса на наклонной скамье", "abs", "bodyweight"),
    ("Боковая планка", "abs", "bodyweight"),

    # ПРЕДПЛЕЧЬЯ
    ("Сгибание запястий со штангой", "forearms", "barbell"),
    ("Разгибание запястий со штангой", "forearms", "barbell"),
    ("Вис на перекладине", "forearms", "bodyweight"),

    # КАРДИО
    ("Бег на дорожке", "cardio", "other"),
    ("Велотренажёр", "cardio", "other"),
    ("Скакалка", "cardio", "other"),
    ("Эллипсоид", "cardio", "other"),
    ("Гребной тренажёр", "cardio", "other"),
    ("Берпи", "cardio", "bodyweight"),
    ("Ходьба в гору (дорожка)", "cardio", "other"),
    ("Прыжки на скакалке двойные", "cardio", "other"),
]


async def seed_exercises():
    async with async_session() as session:
        result = await session.execute(select(Exercise).limit(1))
        if result.scalar_one_or_none():
            return  # уже засеяно

        for name, muscle_group, equipment in EXERCISES:
            session.add(Exercise(
                name=name, muscle_group=muscle_group,
                equipment=equipment, is_custom=False,
            ))
        await session.commit()


async def seed_achievements():
    async with async_session() as session:
        result = await session.execute(select(Achievement).limit(1))
        if result.scalar_one_or_none():
            return

        for a in ACHIEVEMENTS_CATALOG:
            session.add(Achievement(**a))
        await session.commit()
