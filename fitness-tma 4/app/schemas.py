from typing import Optional, List
from pydantic import BaseModel


class OnboardingIn(BaseModel):
    gender: str
    age: int
    weight: float
    height: float
    goal: str  # lose / gain / relief / endurance
    activity_level: int  # 1-5
    experience: str  # beginner / mid / advanced


class ProfileUpdateIn(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None  # ссылка ИЛИ data:image/...;base64,... из галереи телефона


class MeasurementIn(BaseModel):
    date: str
    weight: Optional[float] = None
    biceps: Optional[float] = None
    waist: Optional[float] = None
    hips: Optional[float] = None
    chest: Optional[float] = None


class ExerciseIn(BaseModel):
    name: str
    muscle_group: str
    equipment: str
    description: Optional[str] = None


class SetIn(BaseModel):
    weight: float
    reps: int


class WorkoutEntryIn(BaseModel):
    exercise_id: int
    exercise_name: str
    sets: List[SetIn]


class WorkoutIn(BaseModel):
    date: str
    title: Optional[str] = None
    duration_min: Optional[int] = None
    entries: List[WorkoutEntryIn]
    local_hour: Optional[int] = None  # локальный час устройства (0-23), для ачивок "Ранняя пташка"/"Полуночник"


class WorkoutUpdateIn(BaseModel):
    title: Optional[str] = None
    entries: List[WorkoutEntryIn]


class WorkoutDraftIn(BaseModel):
    title: Optional[str] = None
    entries: List[WorkoutEntryIn] = []


class TrainingDayIn(BaseModel):
    name: str
    exercise_ids: List[int]


class ScheduleIn(BaseModel):
    weekday: int
    training_day_id: Optional[int] = None


class PromoRedeemIn(BaseModel):
    code: str


class HabitIn(BaseModel):
    title: str
    icon: Optional[str] = "sparkles"


class HabitToggleIn(BaseModel):
    date: str
    done: bool


class AIGenerateIn(BaseModel):
    location: str  # "gym" / "home"
    feeling: str  # "great" / "normal" / "tired"
    muscle_focus: Optional[str] = None  # опционально: конкретная группа мышц


class ChangeGoalIn(BaseModel):
    goal: str  # lose / gain / relief / endurance


class SettingsUpdateIn(BaseModel):
    hide_supplements_tips: Optional[bool] = None


class ChallengeCompleteIn(BaseModel):
    pass


class CoachInviteIn(BaseModel):
    username: str


class CoachAssignPlanIn(BaseModel):
    training_days: List[TrainingDayIn]
