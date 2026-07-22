from app.database import XpEvent
from app.ai_logic import level_from_xp
from app.challenges_data import current_week_key


def award_xp(session, user, amount: int, source: str):
    """Начисляет XP пользователю и логирует событие для недельного лидерборда.
    Не делает commit — вызывающий код должен сам закоммитить сессию."""
    user.xp = max((user.xp or 0) + amount, 0)
    user.level = level_from_xp(user.xp)
    session.add(user)
    session.add(XpEvent(user_id=user.id, amount=amount, source=source, week_key=current_week_key()))
