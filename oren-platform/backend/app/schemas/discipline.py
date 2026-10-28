from pydantic import BaseModel
from typing import Optional


class DisciplineRead(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class DisciplineCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


DisciplineResponse = DisciplineRead
