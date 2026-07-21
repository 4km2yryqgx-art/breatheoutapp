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
    avatar_url: Optional[str] = None
    email: Optional[str] = None


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


class TrainingDayIn(BaseModel):
    name: str
    exercise_ids: List[int]


class ScheduleIn(BaseModel):
    weekday: int
    training_day_id: Optional[int] = None


class PromoRedeemIn(BaseModel):
    code: str


class AIGenerateIn(BaseModel):
    location: str  # "gym" / "home"
    feeling: str  # "great" / "normal" / "tired"
    muscle_focus: Optional[str] = None  # опционально: конкретная группа мышц
