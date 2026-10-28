import asyncio
import sys
import uuid
import secrets
from datetime import date, datetime, timedelta

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
from dateutil.relativedelta import relativedelta
from sqlalchemy import select

from app.database import async_session_factory, init_db
from app.config import get_settings
from app.utils.security import hash_password
from app.models.discipline import Discipline
from app.models.organization import Organization
from app.models.user import User, UserRole, RoleEnum
from app.models.competition import (
    Competition, CompetitionType, CalendarPlan,
    CompetitionFormat, CompetitionLevel, CompetitionStatus
)
from app.models.application import Application, ApplicationStatus
from app.models.result import Result, ResultStatus
from app.models.rank import RankRecord, RankType
from app.models.judge import JudgeAssignment, JudgeCategoryRecord, JudgeCategoryType
from app.models.rating import TeamRoster, TeamRosterMember, RatingSetting
from app.models.document import Certificate
from app.models.coach_athlete import CoachAthlete, CoachAthleteStatus

settings = get_settings()


async def seed_data():
    print("🚀 Начало наполнения демонстрационными данными...")
    await init_db()

    async with async_session_factory() as db:
        # Check if already seeded
        res = await db.execute(select(User).where(User.email == "admin@fsp56.ru"))
        if res.scalar_one_or_none():
            print("⚠️ База данных уже содержит демо-пользователей. Пропускаем наполнение.")
            return

        # 1. DISCIPLINES (Все 6 дисциплин вида спорта)
        print("📌 1. Добавление 6 дисциплин ФСП...")
        disciplines_data = [
            ("ALGO", "Программирование алгоритмическое", "Классическое спортивное программирование (ICPC формат)"),
            ("PROD", "Программирование продуктовое", "Хакатоны и разработка готовых программных сервисов"),
            ("SEC", "Программирование систем информационной безопасности", "CTF и защищенное программное обеспечение"),
            ("AI", "Программирование систем искусственного интеллекта", "Нейросети, ML и компьютерное зрение"),
            ("ROBO", "Программирование робототехники", "Управление автономными робототехническими системами"),
            ("DRONE", "Программирование беспилотных авиационных систем", "Алгоритмы автопилотирования и навигации БАС"),
        ]
        disciplines = {}
        for code, name, desc in disciplines_data:
            q = select(Discipline).where(Discipline.code == code)
            existing = (await db.execute(q)).scalar_one_or_none()
            if not existing:
                existing = Discipline(code=code, name=name, description=desc)
                db.add(existing)
                await db.flush()
            disciplines[code] = existing

        # 2. ORGANIZATIONS
        print("📌 2. Создание типовых организаций...")
        org1 = Organization(
            name="Оренбургский государственный университет",
            org_type="university",
            municipality="г. Оренбург",
            address="г. Оренбург, пр. Победы, 13",
            contact_email="it@osu.ru",
            contact_phone="+7 (3532) 77-67-70",
            details="Ведущий университет региона, кафедра прикладной математики и информатики"
        )
        org2 = Organization(
            name="Центр цифрового образования «IT-Куб» (Лицей №1)",
            org_type="school",
            municipality="г. Оренбург",
            address="г. Оренбург, ул. Харьковская, 14",
            contact_email="itcube@orenschool.ru",
            contact_phone="+7 (3532) 43-00-11",
            details="Инновационная площадка дополнительного образования для школьников"
        )
        org3 = Organization(
            name="Спортивная школа олимпийского резерва №2 г. Орска",
            org_type="sport_school",
            municipality="г. Орск",
            address="г. Орск, ул. Комарова, 5",
            contact_email="sshor2@orsk-sport.ru",
            contact_phone="+7 (3537) 25-10-20",
            details="Отделение интеллектуальных и высокотехнологичных видов спорта"
        )
        db.add_all([org1, org2, org3])
        await db.flush()

        # 3. METADATA: Competition Types & Calendar Plans
        print("📌 3. Создание справочников соревнований...")
        async def get_or_create(model, defaults=None, **where):
            # backend при старте уже создаёт часть справочников — повторно не вставляем
            obj = (await db.execute(select(model).filter_by(**where))).scalars().first()
            if not obj:
                obj = model(**where, **(defaults or {}))
                db.add(obj)
                await db.flush()
            return obj

        type_champ = await get_or_create(CompetitionType, name="Чемпионат", defaults={"description": "Главное первенство среди взрослых спортсменов"})
        type_first = await get_or_create(CompetitionType, name="Первенство", defaults={"description": "Официальные старты среди молодежи и юниоров"})
        type_cup = await get_or_create(CompetitionType, name="Кубок", defaults={"description": "Кубковые серии и этапы"})
        type_hack = await get_or_create(CompetitionType, name="Хакатон", defaults={"description": "Интенсивные продуктовые состязания"})

        plan_ekp = await get_or_create(CalendarPlan, name="Единый календарный план Минспорта России (ЕКП)", defaults={"year": 2026})
        plan_reg = await get_or_create(CalendarPlan, name="Календарный план Оренбургской области", defaults={"year": 2026})

        # 4. USERS AND ROLES (10+ users)
        print("📌 4. Создание учетных записей пользователей...")
        pwd_hash = hash_password("secret123")
        today = date.today()

        # 4.1 Federation Administrator
        admin = User(
            email="admin@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Сидоров Виктор Владимирович",
            birth_date=date(1982, 4, 15),
            municipality="г. Оренбург",
            phone="+7 (903) 360-11-22",
            organization_id=org1.id,
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        db.add(admin)
        await db.flush()
        db.add(UserRole(user_id=admin.id, role=RoleEnum.FEDERATION))

        # 4.2 Coaches
        coach1 = User(
            email="coach.ivanov@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Иванов Алексей Петрович",
            birth_date=date(1988, 7, 21),
            municipality="г. Оренбург",
            phone="+7 (905) 819-33-44",
            organization_id=org1.id,
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        db.add(coach1)
        await db.flush()
        db.add(UserRole(user_id=coach1.id, role=RoleEnum.COACH))

        # Multi-role: Coach + Athlete
        coach2 = User(
            email="coach.morozov@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Морозов Дмитрий Сергеевич",
            birth_date=date(1992, 11, 3),
            municipality="г. Оренбург",
            phone="+7 (922) 555-77-88",
            organization_id=org2.id,
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        db.add(coach2)
        await db.flush()
        db.add(UserRole(user_id=coach2.id, role=RoleEnum.COACH))
        db.add(UserRole(user_id=coach2.id, role=RoleEnum.ATHLETE))

        # 4.3 Athletes
        # Athlete 1: Adult (20 y.o.), CMS, will have >= 2 podiums -> MULTIPLIER x1.2!
        ath1 = User(
            email="athlete.smirnov@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Смирнов Максим Андреевич",
            birth_date=date(2004, 3, 14),
            municipality="г. Оренбург",
            phone="+7 (912) 345-67-01",
            organization_id=org1.id,
            sport_preparation_stage="Студенческий состав",
            year_started=2021,
            anti_doping_completed=True,
            anti_doping_date=date(2025, 9, 1),
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        # Athlete 2: Adult (19 y.o.), 1 rank, 1 podium
        ath2 = User(
            email="athlete.kuznetsov@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Кузнецов Артем Дмитриевич",
            birth_date=date(2005, 8, 22),
            municipality="г. Оренбург",
            phone="+7 (912) 345-67-02",
            organization_id=org1.id,
            sport_preparation_stage="Студенческий состав",
            year_started=2022,
            anti_doping_completed=True,
            anti_doping_date=date(2025, 9, 1),
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        # Athlete 3: Junior (16 y.o.), Expiring rank (alert check)
        ath3 = User(
            email="athlete.popova@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Попова Анна Сергеевна",
            birth_date=date(2008, 5, 10),
            municipality="г. Оренбург",
            phone="+7 (912) 345-67-03",
            organization_id=org2.id,
            sport_preparation_stage="Юноши и девушки 14-16 лет",
            year_started=2023,
            anti_doping_completed=True,
            anti_doping_date=date(2025, 10, 15),
            legal_rep_name="Попова Елена Викторовна",
            legal_rep_phone="+7 (912) 999-88-77",
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        # Athlete 4: Junior (15 y.o.)
        ath4 = User(
            email="athlete.vasiliev@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Васильев Кирилл Романович",
            birth_date=date(2009, 2, 18),
            municipality="г. Оренбург",
            phone="+7 (912) 345-67-04",
            organization_id=org2.id,
            sport_preparation_stage="Юноши и девушки 14-16 лет",
            year_started=2023,
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        # Athlete 5: Cadet (13 y.o.) from Orsk
        ath5 = User(
            email="athlete.novikov@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Новиков Егор Павлович",
            birth_date=date(2011, 9, 5),
            municipality="г. Орск",
            phone="+7 (912) 345-67-05",
            organization_id=org3.id,
            sport_preparation_stage="Мальчики и девочки 12-13 лет",
            year_started=2024,
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        # Athlete 6: DISQUALIFIED (Check DQ filter in Rating!)
        ath6_dq = User(
            email="athlete.fedorov@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Федоров Данил Игоревич",
            birth_date=date(2004, 12, 1),
            municipality="г. Оренбург",
            phone="+7 (912) 345-67-06",
            organization_id=org1.id,
            is_disqualified=True,
            disqualification_reason="Нарушение антидопингового регламента и правил честной игры (спортивный кодекс ФСП)",
            disqualification_until=date(2026, 12, 31),
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )

        athletes = [ath1, ath2, ath3, ath4, ath5, ath6_dq]
        db.add_all(athletes)
        await db.flush()
        for a in athletes:
            db.add(UserRole(user_id=a.id, role=RoleEnum.ATHLETE))

        # 4.4 Judges
        # Judge 1: Active 1st category
        judge1 = User(
            email="judge.petrov@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Петров Сергей Николаевич",
            birth_date=date(1979, 6, 25),
            municipality="г. Оренбург",
            phone="+7 (903) 777-11-22",
            organization_id=org1.id,
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        # Judge 2: Expiring category (alert check)
        judge2 = User(
            email="judge.volkov@fsp56.ru",
            password_hash=pwd_hash,
            full_name="Волков Михаил Юрьевич",
            birth_date=date(1985, 1, 19),
            municipality="г. Орск",
            phone="+7 (903) 777-33-44",
            organization_id=org3.id,
            pd_consent=True,
            pd_consent_date=datetime.utcnow()
        )
        judges = [judge1, judge2]
        db.add_all(judges)
        await db.flush()
        for j in judges:
            db.add(UserRole(user_id=j.id, role=RoleEnum.JUDGE))

        # 5. RANKS AND JUDGE CATEGORIES
        print("📌 5. Присвоение спортивных разрядов и судейских категорий...")
        # Athlete 1: CMS (Valid until 2027)
        db.add(RankRecord(
            athlete_id=ath1.id,
            rank=RankType.CMS,
            assigned_date=date(2024, 5, 10),
            order_number="45-ОД",
            valid_until=date(2027, 5, 10),
            status="active"
        ))
        # Athlete 2: 1 rank
        db.add(RankRecord(
            athlete_id=ath2.id,
            rank=RankType.FIRST,
            assigned_date=date(2024, 11, 20),
            order_number="98-ОД",
            valid_until=date(2026, 11, 20),
            status="active"
        ))
        # Athlete 3: 2 rank, EXPIRING in 18 days!
        db.add(RankRecord(
            athlete_id=ath3.id,
            rank=RankType.SECOND,
            assigned_date=today - relativedelta(years=2) + timedelta(days=18),
            order_number="12-ОД",
            valid_until=today + timedelta(days=18),
            status="active"
        ))

        # Judge 1 Category: 1 Category (Valid until 2027)
        db.add(JudgeCategoryRecord(
            judge_id=judge1.id,
            category=JudgeCategoryType.FIRST,
            assigned_date=date(2025, 1, 15),
            valid_until=date(2027, 1, 15),
            order_number="04-С",
            status="active"
        ))
        # Judge 2 Category: 2 Category, EXPIRING in 14 days!
        db.add(JudgeCategoryRecord(
            judge_id=judge2.id,
            category=JudgeCategoryType.SECOND,
            assigned_date=today - relativedelta(years=2) + timedelta(days=14),
            valid_until=today + timedelta(days=14),
            order_number="18-С",
            status="active"
        ))

        # Coach - Athlete Link
        db.add(CoachAthlete(
            coach_id=coach1.id,
            athlete_id=ath1.id,
            discipline_id=disciplines["ALGO"].id,
            status=CoachAthleteStatus.ACTIVE
        ))
        db.add(CoachAthlete(
            coach_id=coach2.id,
            athlete_id=ath3.id,
            discipline_id=disciplines["PROD"].id,
            status=CoachAthleteStatus.ACTIVE
        ))

        # 6. COMPETITIONS (4 tournaments of different levels)
        print("📌 6. Создание соревнований разного уровня...")
        # Comp 1: Interregional (PFO), ALGO, Completed
        comp1 = Competition(
            title="Чемпионат Приволжского федерального округа по алгоритмическому программированию",
            description="Официальный отборочный этап Чемпионата России в ПФО",
            discipline_id=disciplines["ALGO"].id,
            start_date=date(2025, 10, 10),
            end_date=date(2025, 10, 12),
            location="г. Оренбург, пр. Победы, 13 (ОГУ)",
            format=CompetitionFormat.ONSITE,
            level=CompetitionLevel.INTERREGIONAL,
            type_id=type_champ.id,
            status=CompetitionStatus.COMPLETED,
            calendar_plan_id=plan_ekp.id,
            calendar_plan_number="ЕКП-10482",
            registration_deadline=datetime(2025, 10, 5, 23, 59)
        )

        # Comp 2: Regional, ALGO, Completed
        comp2 = Competition(
            title="Чемпионат Оренбургской области по спортивному программированию",
            description="Региональное первенство по алгоритмическому программированию",
            discipline_id=disciplines["ALGO"].id,
            start_date=date(2025, 11, 22),
            end_date=date(2025, 11, 23),
            location="г. Оренбург, ул. Харьковская, 14",
            format=CompetitionFormat.MIXED,
            level=CompetitionLevel.REGIONAL,
            type_id=type_champ.id,
            status=CompetitionStatus.COMPLETED,
            calendar_plan_id=plan_reg.id,
            calendar_plan_number="КП-ОО-54",
            registration_deadline=datetime(2025, 11, 18, 23, 59)
        )

        # Comp 3: Regional, PROD, Completed
        comp3 = Competition(
            title="Областной студенческий хакатон по продуктовому программированию",
            description="Разработка цифровых сервисов для региональной экосистемы",
            discipline_id=disciplines["PROD"].id,
            start_date=date(2025, 12, 5),
            end_date=date(2025, 12, 7),
            location="г. Оренбург (онлайн + защита в ОГУ)",
            format=CompetitionFormat.MIXED,
            level=CompetitionLevel.REGIONAL,
            type_id=type_hack.id,
            status=CompetitionStatus.COMPLETED,
            calendar_plan_id=plan_reg.id,
            calendar_plan_number="КП-ОО-61",
            registration_deadline=datetime(2025, 12, 1, 23, 59)
        )

        # Comp 4: Regional, ROBO, REGISTRATION_OPEN (Upcoming)
        comp4 = Competition(
            title="Кубок Губернатора Оренбургской области по робототехнике и БАС",
            description="Открытый кубок региона по управлению автономными системами",
            discipline_id=disciplines["ROBO"].id,
            start_date=today + timedelta(days=15),
            end_date=today + timedelta(days=17),
            location="г. Оренбург, ДКиС «Газовик»",
            format=CompetitionFormat.ONSITE,
            level=CompetitionLevel.REGIONAL,
            type_id=type_cup.id,
            status=CompetitionStatus.REGISTRATION_OPEN,
            min_age=12,
            max_age=25,
            calendar_plan_id=plan_reg.id,
            calendar_plan_number="КП-ОО-12",
            registration_deadline=datetime.utcnow() + timedelta(days=5)
        )

        db.add_all([comp1, comp2, comp3, comp4])
        await db.flush()

        # 7. JUDGE ASSIGNMENTS
        print("📌 7. Назначение судейской коллегии...")
        db.add(JudgeAssignment(judge_id=judge1.id, competition_id=comp1.id, position="Главный судья"))
        db.add(JudgeAssignment(judge_id=judge2.id, competition_id=comp1.id, position="Главный секретарь"))

        db.add(JudgeAssignment(judge_id=judge1.id, competition_id=comp2.id, position="Главный судья"))
        db.add(JudgeAssignment(judge_id=judge2.id, competition_id=comp2.id, position="Главный секретарь"))
        await db.flush()

        # 8. APPLICATIONS AND RESULTS
        print("📌 8. Добавление заявок и внесение результатов турниров...")
        # Comp 1 (Interregional):
        # ath1 -> 1 place (60 pts)
        # ath2 -> 2 place (45 pts)
        # ath4 -> 5 place (10 pts)
        db.add(Application(competition_id=comp1.id, athlete_id=ath1.id, submitted_by=ath1.id, status=ApplicationStatus.APPROVED))
        db.add(Application(competition_id=comp1.id, athlete_id=ath2.id, submitted_by=coach1.id, status=ApplicationStatus.APPROVED))
        db.add(Application(competition_id=comp1.id, athlete_id=ath4.id, submitted_by=ath4.id, status=ApplicationStatus.APPROVED))

        res1_ath1 = Result(competition_id=comp1.id, athlete_id=ath1.id, place=1, score=98.5, status=ResultStatus.NORMAL, notes="Победитель ПФО")
        res1_ath2 = Result(competition_id=comp1.id, athlete_id=ath2.id, place=2, score=89.0, status=ResultStatus.NORMAL)
        res1_ath4 = Result(competition_id=comp1.id, athlete_id=ath4.id, place=5, score=65.0, status=ResultStatus.NORMAL)
        db.add_all([res1_ath1, res1_ath2, res1_ath4])

        # Comp 2 (Regional):
        # ath1 -> 1 place (40 pts) -> 2nd podium finish! Stability multiplier x1.2 applies: (60 + 40) * 1.2 = 120 pts!
        # ath4 -> 2 place (30 pts)
        # ath6_dq -> 3 place (Disqualified! Must NOT appear in Rating!)
        db.add(Application(competition_id=comp2.id, athlete_id=ath1.id, submitted_by=ath1.id, status=ApplicationStatus.APPROVED))
        db.add(Application(competition_id=comp2.id, athlete_id=ath4.id, submitted_by=ath4.id, status=ApplicationStatus.APPROVED))
        db.add(Application(competition_id=comp2.id, athlete_id=ath6_dq.id, submitted_by=ath6_dq.id, status=ApplicationStatus.APPROVED))

        res2_ath1 = Result(competition_id=comp2.id, athlete_id=ath1.id, place=1, score=100.0, status=ResultStatus.NORMAL, notes="Чемпион области")
        res2_ath4 = Result(competition_id=comp2.id, athlete_id=ath4.id, place=2, score=85.0, status=ResultStatus.NORMAL)
        res2_ath6 = Result(competition_id=comp2.id, athlete_id=ath6_dq.id, place=3, score=78.0, status=ResultStatus.DISQUALIFIED, notes="Дисквалификация по регламенту")
        db.add_all([res2_ath1, res2_ath4, res2_ath6])
        await db.flush()

        # 9. BONUS D10: CERTIFICATE WITH QR CODE
        print("📌 9. Выпуск официального сертификата с QR-кодом (Бонус Д10)...")
        cert_number = "FSP-OREN-2026-7A8B"
        verify_url = f"{settings.BASE_URL}/verify/{cert_number}"
        certificate = Certificate(
            number=cert_number,
            athlete_id=ath1.id,
            competition_id=comp1.id,
            result_id=res1_ath1.id,
            qr_code_url=verify_url,
            created_at=datetime.utcnow()
        )
        db.add(certificate)

        # 10. TEAM ROSTER FOR ORENBURG REGION
        print("📌 10. Формирование сборной команды Оренбургской области...")
        roster = TeamRoster(
            season="2025-2026",
            discipline_id=disciplines["ALGO"].id,
            age_group="Основной состав",
            created_by=admin.id,
            created_at=datetime.utcnow()
        )
        db.add(roster)
        await db.flush()

        db.add(TeamRosterMember(roster_id=roster.id, athlete_id=ath1.id, rating_score=120, status="main"))
        db.add(TeamRosterMember(roster_id=roster.id, athlete_id=ath2.id, rating_score=45, status="main"))
        db.add(TeamRosterMember(roster_id=roster.id, athlete_id=ath4.id, rating_score=40, status="reserve"))

        await db.commit()
        print("✅ Демонстрационные данные успешно созданы!")
        print("\n🔑 Учетные записи для проверки:")
        print("  • Федерация: admin@fsp56.ru / secret123")
        print("  • Тренер 1:  coach.ivanov@fsp56.ru / secret123")
        print("  • Тренер 2:  coach.morozov@fsp56.ru / secret123 (Мультироль: Coach + Athlete)")
        print("  • Спортсмен: athlete.smirnov@fsp56.ru / secret123 (КМС, x1.2 множитель)")
        print("  • Спортсмен: athlete.popova@fsp56.ru / secret123 (Истекающий разряд 18 дн.)")
        print("  • Дисквал.:  athlete.fedorov@fsp56.ru / secret123 (DQ фильтр)")
        print("  • Судья:     judge.petrov@fsp56.ru / secret123 (1 категория)")
        print("  • Судья:     judge.volkov@fsp56.ru / secret123 (Истекающая категория 14 дн.)")


if __name__ == "__main__":
    asyncio.run(seed_data())
