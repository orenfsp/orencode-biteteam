from app.schemas.common import MessageResponse
from app.schemas.auth import Token, TokenPayload, LoginRequest, SwitchRoleRequest, RegisterRequest
from app.schemas.user import UserRead, UserUpdate, DisqualificationUpdate, CoachAthleteRead, CoachAthleteCreate
from app.schemas.discipline import DisciplineRead, DisciplineCreate
from app.schemas.organization import OrganizationRead, OrganizationCreate
from app.schemas.competition import (
    CompetitionRead, CompetitionCreate, CompetitionUpdate,
    CompetitionTypeRead, CompetitionTypeCreate,
    CalendarPlanRead, CalendarPlanCreate
)
from app.schemas.application import ApplicationCreate, ApplicationReview, ApplicationRead
from app.schemas.result import ResultItemCreate, ResultBatchCreate, ResultRead, ProtocolResponse, ProtocolEntry
from app.schemas.rating import (
    RatingAthleteItem, RatingResponse, RatingSettingRead, RatingSettingUpdate,
    TeamRosterCreate, TeamRosterRead
)
from app.schemas.rank import (
    RankRecordRead, RankRecordCreate, RankApplicationCreate, RankApplicationReview, RankApplicationRead,
    JudgeCategoryRecordRead, JudgeCategoryApplicationCreate, JudgeCategoryApplicationReview, JudgeCategoryApplicationRead,
    JudgeAssignmentCreate, JudgeAssignmentRead
)
from app.schemas.document import CertificateRead, CertificateVerifyResponse
from app.schemas.notification import NotificationRead, TelegramLinkCodeResponse, TelegramStatusResponse
