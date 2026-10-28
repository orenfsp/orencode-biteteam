from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.disciplines import router as disciplines_router
from app.api.v1.organizations import router as organizations_router
from app.api.v1.competitions import router as competitions_router
from app.api.v1.applications import router as applications_router
from app.api.v1.results import router as results_router
from app.api.v1.rating import router as rating_router
from app.api.v1.ranks import router as ranks_router
from app.api.v1.judges import router as judges_router
from app.api.v1.documents import router as documents_router
from app.api.v1.verify import router as verify_router
from app.api.v1.notifications import router as notifications_router

api_v1_router = APIRouter(prefix="/v1")

api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(disciplines_router)
api_v1_router.include_router(organizations_router)
api_v1_router.include_router(competitions_router)
api_v1_router.include_router(applications_router)
api_v1_router.include_router(results_router)
api_v1_router.include_router(rating_router)
api_v1_router.include_router(ranks_router)
api_v1_router.include_router(judges_router)
api_v1_router.include_router(documents_router)
api_v1_router.include_router(verify_router)
api_v1_router.include_router(notifications_router)

api_router = api_v1_router
