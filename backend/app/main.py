import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select

from app.config import get_settings
from app.database import init_db, async_session_factory
from app.models.discipline import Discipline
from app.models.competition import CompetitionType, CalendarPlan
from app.api.v1 import api_v1_router
from app.api.v1.verify import router as root_verify_router
from app.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fsp_platform")
settings = get_settings()

DEFAULT_DISCIPLINES = [
    {
        "code": "ALGO",
        "name": "Программирование алгоритмическое",
        "description": "Классическое спортивное программирование (ICPC формат, олимпиадные алгоритмические задачи)"
    },
    {
        "code": "PROD",
        "name": "Программирование продуктовое",
        "description": "Разработка законченных программных продуктов, хакатоны, веб и мобильные сервисы"
    },
    {
        "code": "SEC",
        "name": "Программирование систем информационной безопасности",
        "description": "Безопасность ПО, CTF соревнования, анализ уязвимостей и защищенный код"
    },
    {
        "code": "AI",
        "name": "Программирование систем искусственного интеллекта",
        "description": "Машинное обучение, нейросети, интеллектуальный анализ данных и компьютерное зрение"
    },
    {
        "code": "ROBO",
        "name": "Программирование робототехники",
        "description": "Управление мехатронными и автономными робототехническими комплексами"
    },
    {
        "code": "DRONE",
        "name": "Программирование беспилотных авиационных систем",
        "description": "Автономная навигация, алгоритмы компьютерного зрения и управление БАС"
    },
]

DEFAULT_COMPETITION_TYPES = [
    {"name": "Чемпионат", "description": "Главное региональное или всероссийское первенство среди взрослых спортсменов"},
    {"name": "Первенство", "description": "Официальные соревнования среди юниоров и молодежи"},
    {"name": "Кубок", "description": "Кубковые этапы и финал региона"},
    {"name": "Турнир", "description": "Региональные и открытые квалификационные турниры"},
    {"name": "Хакатон", "description": "Интенсивные соревнования по продуктовой и ИИ разработке"},
]


async def seed_initial_metadata():
    """Ensure all 6 disciplines and base types are seeded in the database."""
    async with async_session_factory() as db:
        # Check disciplines
        res = await db.execute(select(Discipline))
        existing_disciplines = {d.code for d in res.scalars().all()}

        for d_data in DEFAULT_DISCIPLINES:
            if d_data["code"] not in existing_disciplines:
                disc = Discipline(
                    code=d_data["code"],
                    name=d_data["name"],
                    description=d_data["description"]
                )
                db.add(disc)

        # Check competition types
        res_t = await db.execute(select(CompetitionType))
        existing_types = {t.name for t in res_t.scalars().all()}
        for t_data in DEFAULT_COMPETITION_TYPES:
            if t_data["name"] not in existing_types:
                ctype = CompetitionType(name=t_data["name"], description=t_data["description"])
                db.add(ctype)

        # Check calendar plans
        res_p = await db.execute(select(CalendarPlan))
        existing_plans = {p.name for p in res_p.scalars().all()}
        default_plans = [
            {"name": "Единый календарный план Минспорта России (ЕКП)", "year": 2026},
            {"name": "Календарный план Оренбургской области", "year": 2026},
        ]
        for p_data in default_plans:
            if p_data["name"] not in existing_plans:
                cplan = CalendarPlan(name=p_data["name"], year=p_data["year"])
                db.add(cplan)

        await db.commit()
        logger.info("Initial platform metadata verified/seeded successfully.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Инициализация базы данных...")
    await init_db()
    await seed_initial_metadata()

    # Start background scheduler
    logger.info("Запуск планировщика задач...")
    start_scheduler()

    # If telegram bot is configured, start polling in background task
    bot_task = None
    if settings.TELEGRAM_BOT_TOKEN:
        try:
            from bot.main import start_bot
            logger.info("Запуск Telegram-бота...")
            bot_task = asyncio.create_task(start_bot())
        except Exception as e:
            logger.warning(f"Не удалось запустить Telegram-бот: {e}")

    yield

    # Shutdown
    logger.info("Остановка планировщика задач...")
    stop_scheduler()
    if bot_task and not bot_task.done():
        bot_task.cancel()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API Единой цифровой платформы Федерации спортивного программирования Оренбургской области",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(api_v1_router, prefix="/api")

# Also mount /verify directly at root so that QR-code links http://<domain>/verify/<cert_number> resolve directly
app.include_router(root_verify_router)


@app.get("/health", tags=["Система"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": "connected",
        "docs_url": "/docs"
    }


@app.get("/", include_in_schema=False)
async def root_redirect():
    return RedirectResponse(url="/docs")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
