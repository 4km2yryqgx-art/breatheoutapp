from datetime import datetime


def is_user_premium(user) -> bool:
    """Единая проверка активного Premium — используется в habits, payments, leaderboard."""
    if not user.is_premium:
        return False
    if user.premium_until is None:
        return True  # lifetime (мастер-промокод FRIENDS2026 и т.п.)
    return datetime.utcnow() <= datetime.strptime(user.premium_until, "%Y-%m-%d")
