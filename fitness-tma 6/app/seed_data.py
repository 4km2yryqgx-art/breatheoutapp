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

    # ============================================================
    # РАСШИРЕНИЕ БАЗЫ (+100): новые упражнения по всем группам мышц
    # ============================================================

    # ГРУДЬ (доп.)
    ("Жим гантелей на скамье с отриц. наклоном", "chest", "dumbbell"),
    ("Разведение гантелей на наклонной скамье", "chest", "dumbbell"),
    ("Жим одной гантелью лёжа", "chest", "dumbbell"),
    ("Отжимания с отягощением на спине", "chest", "bodyweight"),
    ("Отжимания на кольцах", "chest", "bodyweight"),
    ("Жим в тренажёре под углом вниз", "chest", "machine"),
    ("Сведение рук в кроссовере снизу вверх", "chest", "cable"),
    ("Сведение рук в кроссовере сверху вниз", "chest", "cable"),
    ("Пуловер в блоке на верхней тяге", "chest", "cable"),
    ("Жим штанги обратным хватом", "chest", "barbell"),
    ("Отжимания с колен (облегчённые)", "chest", "bodyweight"),
    ("Плиометрические отжимания (взрывные)", "chest", "bodyweight"),

    # СПИНА (доп.)
    ("Тяга гантелей лёжа на скамье", "back", "dumbbell"),
    ("Тяга штанги в наклоне обратным хватом", "back", "barbell"),
    ("Тяга одной рукой в кроссовере", "back", "cable"),
    ("Пуловер на верхнем блоке прямыми руками", "back", "cable"),
    ("Подтягивания нейтральным хватом", "back", "bodyweight"),
    ("Австралийские подтягивания (тяга в наклоне на низкой перекладине)", "back", "bodyweight"),
    ("Тяга нижнего блока широким хватом", "back", "cable"),
    ("Тяга в машине Смита в наклоне", "back", "machine"),
    ("Разгибание спины на тренажёре", "back", "machine"),
    ("Тяга гантели в упоре на скамью", "back", "dumbbell"),
    ("Шраги в тренажёре", "back", "machine"),
    ("Становая тяга на прямых ногах с гантелями", "back", "dumbbell"),

    # НОГИ (доп.)
    ("Жим одной ногой в тренажёре", "legs", "machine"),
    ("Приседания сумо со штангой", "legs", "barbell"),
    ("Приседания сумо с гантелей", "legs", "dumbbell"),
    ("Зашагивания на платформу с гантелями", "legs", "dumbbell"),
    ("Зашагивания на платформу без веса", "legs", "bodyweight"),
    ("Румынская тяга с гантелями", "legs", "dumbbell"),
    ("Сгибание одной ноги в тренажёре", "legs", "machine"),
    ("Разгибание одной ноги в тренажёре", "legs", "machine"),
    ("Приседания в тренажёре Гакк (узкая постановка)", "legs", "machine"),
    ("Выпады назад со штангой", "legs", "barbell"),
    ("Выпады в движении (ходьба выпадами)", "legs", "dumbbell"),
    ("Подъём на носки в тренажёре сидя (доп.)", "legs", "machine"),
    ("Приседания с лентой-эспандером", "legs", "other"),
    ("Степ-ап на скамью", "legs", "dumbbell"),

    # ЯГОДИЦЫ (доп.)
    ("Ягодичный мостик с гантелью", "glutes", "dumbbell"),
    ("Разгибание бедра в тренажёре (стоя)", "glutes", "machine"),
    ("Отведение ноги с эспандером", "glutes", "other"),
    ("Ягодичный мостик в машине Смита", "glutes", "machine"),
    ("Прыжки на ящик (box jump)", "glutes", "bodyweight"),

    # ПЛЕЧИ (доп.)
    ("Жим гантелей из-за головы", "shoulders", "dumbbell"),
    ("Махи гантелями в стороны в наклоне на скамье", "shoulders", "dumbbell"),
    ("Жим штанги из-за головы сидя", "shoulders", "barbell"),
    ("Разведение в тренажёре (передняя дельта)", "shoulders", "machine"),
    ("Подъём гантелей перед собой", "shoulders", "dumbbell"),
    ("Подъём штанги перед собой", "shoulders", "barbell"),
    ("Жим в тренажёре Смита сидя", "shoulders", "machine"),
    ("Круговые вращения с гантелями (разминка)", "shoulders", "dumbbell"),
    ("Y-разведения на наклонной скамье", "shoulders", "dumbbell"),

    # БИЦЕПС (доп.)
    ("Подъём штанги обратным хватом", "biceps", "barbell"),
    ("Молотковый подъём в кроссовере", "biceps", "cable"),
    ("Подъём гантелей сидя на скамье Скотта", "biceps", "dumbbell"),
    ("21-е сгибание рук со штангой", "biceps", "barbell"),
    ("Подъём гантелей поочерёдно с супинацией", "biceps", "dumbbell"),
    ("Подъём на бицепс с резинкой", "biceps", "other"),

    # ТРИЦЕПС (доп.)
    ("Разгибание рук на блоке с канатом", "triceps", "cable"),
    ("Жим гантели двумя руками из-за головы", "triceps", "dumbbell"),
    ("Разгибание руки в упоре (кикбэк)", "triceps", "dumbbell"),
    ("Отжимания от скамьи узким хватом", "triceps", "bodyweight"),
    ("Французский жим сидя с гантелью", "triceps", "dumbbell"),
    ("Разгибание рук в блоке обратным хватом", "triceps", "cable"),

    # ПРЕСС (доп.)
    ("Скручивания на блоке стоя на коленях", "abs", "cable"),
    ("Подъём коленей в упоре на брусьях", "abs", "bodyweight"),
    ("Складка (V-ups)", "abs", "bodyweight"),
    ("Дровосек в кроссовере", "abs", "cable"),
    ("Планка с перекрёстным касанием плеч", "abs", "bodyweight"),
    ("Ролик для пресса (колесо)", "abs", "other"),
    ("Подъём ног лёжа на полу", "abs", "bodyweight"),
    ("Скручивания с диском над головой", "abs", "other"),

    # ПРЕДПЛЕЧЬЯ (доп.)
    ("Сгибание запястий с гантелями", "forearms", "dumbbell"),
    ("Роллер для предплечий (кистевой тренажёр)", "forearms", "other"),
    ("Удержание гантелей на время (статика хвата)", "forearms", "dumbbell"),

    # КАРДИО (доп.)
    ("Бег по пересечённой местности", "cardio", "other"),
    ("Спринты на дорожке", "cardio", "other"),
    ("Плавание вольным стилем", "cardio", "other"),
    ("Гребля на тренажёре — интервалы", "cardio", "other"),
    ("Степпер", "cardio", "other"),
    ("Велопрогулка на улице", "cardio", "other"),
    ("Ходьба с утяжелителями (ruck walk)", "cardio", "other"),
    ("Прыжки Jumping Jack", "cardio", "bodyweight"),
    ("Высокие подъёмы колен на месте", "cardio", "bodyweight"),
    ("Скалолаз (интервальный)", "cardio", "bodyweight"),
    ("Бой с тенью (шэдоу-бокс)", "cardio", "bodyweight"),
    ("Круговая интервальная тренировка на кардиотренажёрах", "cardio", "other"),
]


async def seed_exercises():
    async with async_session() as session:
        existing_result = await session.execute(select(Exercise.name).where(Exercise.is_custom == False))  # noqa: E712
        existing_names = {row[0] for row in existing_result.all()}

        added = 0
        for name, muscle_group, equipment in EXERCISES:
            if name not in existing_names:
                session.add(Exercise(
                    name=name, muscle_group=muscle_group,
                    equipment=equipment, is_custom=False,
                ))
                added += 1
        if added:
            await session.commit()


async def seed_achievements():
    async with async_session() as session:
        existing_result = await session.execute(select(Achievement.code))
        existing_codes = {row[0] for row in existing_result.all()}

        for a in ACHIEVEMENTS_CATALOG:
            if a["code"] not in existing_codes:
                session.add(Achievement(**a))
        await session.commit()
