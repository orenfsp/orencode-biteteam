import uuid
from datetime import datetime, date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.discipline import Discipline
from app.models.organization import Organization
from app.models.user import User, UserRole, RoleEnum
from app.models.competition import (
    Competition, CompetitionType, CalendarPlan,
    CompetitionLevel, CompetitionFormat, CompetitionStatus
)
from app.models.application import Application, ApplicationStatus
from app.models.result import Result, ResultStatus
from app.models.rank import RankRecord, RankType
from app.models.judge import (
    JudgeCategoryRecord, JudgeAssignment, JudgeCategoryType
)
from app.models.rating import RatingSetting
from app.models.document import Certificate
from app.models.coach_athlete import CoachAthlete, CoachAthleteStatus
from app.utils.security import hash_password


async def seed_all_data(db: AsyncSession):
    """Populates complete demo dataset for testing and hackathon checkpoints."""

    # 1. Disciplines (all 6)
    existing_disc = await db.execute(select(Discipline))
    if not existing_disc.scalars().first():
        disciplines_data = [
            (1, "Программирование алгоритмическое", "ALGO", "Спортивное программирование: решение алгоритмических задач на скорость"),
            (2, "Программирование продуктовое", "PROD", "Разработка веб- и мобильных сервисов, хакатоны по созданию готовых IT-продуктов"),
            (3, "Программирование систем информационной безопасности", "SEC", "Соревнования в формате CTF (Capture the Flag), поиск уязвимостей, аудит защиты"),
            (4, "Программирование систем искусственного интеллекта", "AI", "Машинное обучение, компьютерное зрение, обработка естественного языка (NLP)"),
            (5, "Программирование робототехники", "ROBO", "Управление робототехническими комплексами, микроконтроллеры, автономные системы"),
            (6, "Программирование беспилотных авиационных систем (БАС)", "DRONE", "Автономная навигация, компьютерное зрение и пилотирование БПЛА"),
        ]
        for did, name, code, desc in disciplines_data:
            disc = Discipline(id=did, name=name, code=code, description=desc)
            db.add(disc)
        await db.flush()

    # 2. Rating Settings
    existing_rs = await db.execute(select(RatingSetting))
    if not existing_rs.scalars().first():
        rs_data = [
            (CompetitionLevel.CHAMPIONSHIP_RUSSIA.value, 100, 80, 60),
            (CompetitionLevel.FIRST_RUSSIA.value, 80, 60, 40),
            (CompetitionLevel.INTERREGIONAL.value, 60, 45, 30),
            (CompetitionLevel.REGIONAL.value, 40, 30, 20),
        ]
        for level, p1, p2, p3 in rs_data:
            rs = RatingSetting(level=level, place_1_points=p1, place_2_points=p2, place_3_points=p3)
            db.add(rs)
        await db.flush()

    # Check if users already seeded
    existing_users = await db.execute(select(User))
    if existing_users.scalars().first():
        await db.commit()
        return

    # 3. Organizations
    org_ogu = Organization(
        name="ФГБОУ ВО «Оренбургский государственный университет»",
        org_type="university",
        municipality="г. Оренбург",
        address="пр. Победы, 13",
        contact_email="it@osu.ru",
        contact_phone="+7 (3532) 77-67-70"
    )
    org_lyceum = Organization(
        name="МОАУ «Лицей № 1 им. Б.В. Шапошникова»",
        org_type="school",
        municipality="г. Оренбург",
        address="ул. Харьковская, 14",
        contact_email="lyceum1@orenschool.ru",
        contact_phone="+7 (3532) 31-28-01"
    )
    org_sshor = Organization(
        name="МАУДО СШОР № 2 «Прогресс»",
        org_type="sport_school",
        municipality="г. Оренбург",
        address="пр. Победы, 136",
        contact_email="progress@sport56.ru",
        contact_phone="+7 (3532) 75-32-11"
    )
    org_itcube = Organization(
        name="Центр цифрового образования детей «IT-Куб»",
        org_type="club",
        municipality="г. Оренбург",
        address="ул. Салмышская, 43",
        contact_email="itcube56@yandex.ru"
    )
    db.add_all([org_ogu, org_lyceum, org_sshor, org_itcube])
    await db.flush()

    # 4. Competition Types & Calendar Plans
    ctype_champ = CompetitionType(name="Чемпионат", description="Главный официальный турнир региона среди взрослых")
    ctype_perv = CompetitionType(name="Первенство", description="Официальный турнир среди молодежи и юниоров")
    ctype_cup = CompetitionType(name="Кубок", description="Кубковые рейтинговые соревнования")
    db.add_all([ctype_champ, ctype_perv, ctype_cup])

    plan_reg = CalendarPlan(name="Календарный план физкультурных мероприятий Оренбургской области", year=2026)
    plan_ekp = CalendarPlan(name="Единый календарный план Минспорта России (ЕКП)", year=2026)
    db.add_all([plan_reg, plan_ekp])
    await db.flush()

    pwd = hash_password("password123")
    today = date.today()

    # 5. Users with multi-roles
    # 5.1. Admin / Federation
    user_admin = User(
        email="admin@fsp56.ru",
        password_hash=pwd,
        full_name="Фадеев Алексей Викторович",
        birth_date=date(1985, 4, 12),
        municipality="г. Оренбург",
        phone="+7 (903) 398-11-22",
        pd_consent=True,
        pd_consent_date=datetime.utcnow()
    )
    db.add(user_admin)
    await db.flush()
    db.add(UserRole(user_id=user_admin.id, role=RoleEnum.FEDERATION))

    # 5.2. Coach + Judge (Dual Role)
    user_coach_judge = User(
        email="coach.smirnov@mail.ru",
        password_hash=pwd,
        full_name="Смирнов Сергей Петрович",
        birth_date=date(1988, 7, 23),
        municipality="г. Оренбург",
        organization_id=org_ogu.id,
        phone="+7 (912) 345-67-89",
        pd_consent=True,
        pd_consent_date=datetime.utcnow()
    )
    db.add(user_coach_judge)
    await db.flush()
    db.add(UserRole(user_id=user_coach_judge.id, role=RoleEnum.COACH))
    db.add(UserRole(user_id=user_coach_judge.id, role=RoleEnum.JUDGE))

    # 5.3. Coach Morozova
    user_coach2 = User(
        email="coach.morozova@mail.ru",
        password_hash=pwd,
        full_name="Морозова Елена Игоревна",
        birth_date=date(1992, 11, 5),
        municipality="г. Оренбург",
        organization_id=org_lyceum.id,
        phone="+7 (922) 801-44-55",
        pd_consent=True,
        pd_consent_date=datetime.utcnow()
    )
    db.add(user_coach2)
    await db.flush()
    db.add(UserRole(user_id=user_coach2.id, role=RoleEnum.COACH))

    # 5.4. Athletes
    # Athlete 1: Ivanov Ivan (Adult, OGU)
    user_ivanov = User(
        email="athlete.ivanov@mail.ru",
        password_hash=pwd,
        full_name="Иванов Иван Дмитриевич",
        birth_date=date(2004, 5, 14),
        municipality="г. Оренбург",
        organization_id=org_ogu.id,
        year_started=2021,
        sport_preparation_stage="Этап совершенствования спортивного мастерства",
        anti_doping_completed=True,
        anti_doping_date=date(2025, 9, 10),
        pd_consent=True,
        pd_consent_date=datetime.utcnow()
    )
    db.add(user_ivanov)
    await db.flush()
    db.add(UserRole(user_id=user_ivanov.id, role=RoleEnum.ATHLETE))

    # Athlete 2: Petrov Maksim (Adult, OGU)
    user_petrov = User(
        email="athlete.petrov@mail.ru",
        password_hash=pwd,
        full_name="Петров Максим Алексеевич",
        birth_date=date(2005, 8, 22),
        municipality="г. Оренбург",
        organization_id=org_ogu.id,
        year_started=2022,
        sport_preparation_stage="Учебно-тренировочный этап",
        anti_doping_completed=True,
        anti_doping_date=date(2025, 10, 15),
        pd_consent=True,
        pd_consent_date=datetime.utcnow()
    )
    db.add(user_petrov)
    await db.flush()
    db.add(UserRole(user_id=user_petrov.id, role=RoleEnum.ATHLETE))

    # Athlete 3: Sidorov Artem (Junior minor, Lyceum 1, expiring rank)
    user_sidorov = User(
        email="athlete.sidorov@mail.ru",
        password_hash=pwd,
        full_name="Сидоров Артем Павлович",
        birth_date=date(2008, 12, 1),
        municipality="г. Оренбург",
        organization_id=org_lyceum.id,
        year_started=2023,
        sport_preparation_stage="Начальная подготовка",
        anti_doping_completed=True,
        anti_doping_date=date(2025, 11, 20),
        legal_rep_name="Сидорова Ольга Васильевна",
        legal_rep_phone="+7 (905) 819-22-33",
        pd_consent=True,
        pd_consent_date=datetime.utcnow()
    )
    db.add(user_sidorov)
    await db.flush()
    db.add(UserRole(user_id=user_sidorov.id, role=RoleEnum.ATHLETE))

    # Athlete 4: Kuznetsov Daniil (Disqualified athlete)
    user_kuznetsov = User(
        email="athlete.kuznetsov@mail.ru",
        password_hash=pwd,
        full_name="Кузнецов Даниил Романович",
        birth_date=date(2003, 3, 18),
        municipality="г. Оренбург",
        organization_id=org_itcube.id,
        is_disqualified=True,
        disqualification_reason="Нарушение регламента соревнований (использование запрещенного ПО на хакатоне)",
        disqualification_until=today + timedelta(days=90),
        pd_consent=True,
        pd_consent_date=datetime.utcnow()
    )
    db.add(user_kuznetsov)
    await db.flush()
    db.add(UserRole(user_id=user_kuznetsov.id, role=RoleEnum.ATHLETE))

    # 5.5. Pure Judge
    user_judge = User(
        email="judge.vasiliev@mail.ru",
        password_hash=pwd,
        full_name="Васильев Андрей Николаевич",
        birth_date=date(1980, 2, 28),
        municipality="г. Оренбург",
        phone="+7 (903) 392-77-88",
        pd_consent=True,
        pd_consent_date=datetime.utcnow()
    )
    db.add(user_judge)
    await db.flush()
    db.add(UserRole(user_id=user_judge.id, role=RoleEnum.JUDGE))

    # 6. Coach - Athlete links
    ca1 = CoachAthlete(
        coach_id=user_coach_judge.id,
        athlete_id=user_ivanov.id,
        discipline_id=1,
        status=CoachAthleteStatus.ACTIVE
    )
    ca2 = CoachAthlete(
        coach_id=user_coach_judge.id,
        athlete_id=user_petrov.id,
        discipline_id=1,
        status=CoachAthleteStatus.ACTIVE
    )
    ca3 = CoachAthlete(
        coach_id=user_coach2.id,
        athlete_id=user_sidorov.id,
        discipline_id=1,
        status=CoachAthleteStatus.ACTIVE
    )
    db.add_all([ca1, ca2, ca3])

    # 7. Ranks
    # Ivanov: 1 разряд (активен еще 1.5 года)
    r_ivanov = RankRecord(
        athlete_id=user_ivanov.id,
        rank=RankType.FIRST,
        assigned_date=today - timedelta(days=180),
        order_number="№ 45-р от 15.04.2025",
        valid_until=today + timedelta(days=550),
        status="active"
    )
    # Petrov: 1 разряд (активен)
    r_petrov = RankRecord(
        athlete_id=user_petrov.id,
        rank=RankType.FIRST,
        assigned_date=today - timedelta(days=90),
        order_number="№ 78-р от 20.07.2025",
        valid_until=today + timedelta(days=640),
        status="active"
    )
    # Sidorov: 2 разряд (ИСТЕКАЕТ ЧЕРЕЗ 14 ДНЕЙ! Для проверки системы алертов)
    r_sidorov = RankRecord(
        athlete_id=user_sidorov.id,
        rank=RankType.SECOND,
        assigned_date=today - timedelta(days=716),
        order_number="№ 12-р от 10.11.2024",
        valid_until=today + timedelta(days=14),
        status="active"
    )
    db.add_all([r_ivanov, r_petrov, r_sidorov])

    # 8. Judge Categories
    jc_smirnov = JudgeCategoryRecord(
        judge_id=user_coach_judge.id,
        category=JudgeCategoryType.FIRST,
        assigned_date=today - timedelta(days=200),
        valid_until=today + timedelta(days=530),
        order_number="№ 18-с",
        status="active"
    )
    # Vasiliev: категория истекает через 21 день!
    jc_vasiliev = JudgeCategoryRecord(
        judge_id=user_judge.id,
        category=JudgeCategoryType.SECOND,
        assigned_date=today - timedelta(days=709),
        valid_until=today + timedelta(days=21),
        order_number="№ 05-с",
        status="active"
    )
    db.add_all([jc_smirnov, jc_vasiliev])

    # 9. Competitions
    # 9.1. Regional Championship (Completed)
    comp_regional = Competition(
        title="Чемпионат Оренбургской области по спортивному программированию 2026",
        description="Главный старт региона по алгоритмическому программированию. Отбор в сборную команду.",
        discipline_id=1,
        start_date=today - timedelta(days=40),
        end_date=today - timedelta(days=38),
        location="г. Оренбург, пр. Победы, 13 (ОГУ)",
        format=CompetitionFormat.ONSITE,
        level=CompetitionLevel.REGIONAL,
        type_id=ctype_champ.id,
        age_group="Мужчины, женщины (18+)",
        min_age=17,
        status=CompetitionStatus.COMPLETED,
        calendar_plan_id=plan_reg.id,
        calendar_plan_number="КП-2026-084"
    )
    # 9.2. Interregional Championship PFO (Completed)
    comp_interreg = Competition(
        title="Первенство Приволжского федерального округа (ПФО)",
        description="Окружные соревнования между субъектами ПФО.",
        discipline_id=1,
        start_date=today - timedelta(days=20),
        end_date=today - timedelta(days=18),
        location="г. Самара / Онлайн",
        format=CompetitionFormat.MIXED,
        level=CompetitionLevel.INTERREGIONAL,
        type_id=ctype_perv.id,
        age_group="Юниоры (до 25 лет)",
        min_age=14,
        max_age=25,
        status=CompetitionStatus.COMPLETED,
        calendar_plan_id=plan_ekp.id,
        calendar_plan_number="ЕКП-2026-1923"
    )
    # 9.3. Product Programming Cup (Registration Open)
    comp_prod_cup = Competition(
        title="Кубок Оренбургской области по продуктовому программированию",
        description="Хакатон по разработке цифровых сервисов для региона.",
        discipline_id=2,
        start_date=today + timedelta(days=15),
        end_date=today + timedelta(days=17),
        location="г. Оренбург, Точка кипения ОГУ",
        format=CompetitionFormat.MIXED,
        level=CompetitionLevel.REGIONAL,
        type_id=ctype_cup.id,
        age_group="Без возрастных ограничений",
        status=CompetitionStatus.REGISTRATION_OPEN,
        calendar_plan_id=plan_reg.id,
        calendar_plan_number="КП-2026-112",
        registration_deadline=datetime.utcnow() + timedelta(days=10)
    )
    db.add_all([comp_regional, comp_interreg, comp_prod_cup])
    await db.flush()

    # 10. Judge Assignments
    ja1 = JudgeAssignment(judge_id=user_judge.id, competition_id=comp_regional.id, position="Главный судья")
    ja2 = JudgeAssignment(judge_id=user_coach_judge.id, competition_id=comp_regional.id, position="Главный секретарь")
    db.add_all([ja1, ja2])

    # 11. Applications
    app1 = Application(athlete_id=user_ivanov.id, competition_id=comp_regional.id, submitted_by=user_ivanov.id, status=ApplicationStatus.APPROVED)
    app2 = Application(athlete_id=user_petrov.id, competition_id=comp_regional.id, submitted_by=user_petrov.id, status=ApplicationStatus.APPROVED)
    app3 = Application(athlete_id=user_sidorov.id, competition_id=comp_regional.id, submitted_by=user_coach2.id, status=ApplicationStatus.APPROVED)
    app4 = Application(athlete_id=user_kuznetsov.id, competition_id=comp_regional.id, submitted_by=user_kuznetsov.id, status=ApplicationStatus.APPROVED)

    app_inter1 = Application(athlete_id=user_ivanov.id, competition_id=comp_interreg.id, submitted_by=user_coach_judge.id, status=ApplicationStatus.APPROVED)
    app_inter2 = Application(athlete_id=user_petrov.id, competition_id=comp_interreg.id, submitted_by=user_coach_judge.id, status=ApplicationStatus.APPROVED)
    db.add_all([app1, app2, app3, app4, app_inter1, app_inter2])
    await db.flush()

    # 12. Results
    # Regional Championship:
    # 1st place: Ivanov (40 pts)
    # 2nd place: Petrov (30 pts)
    # 3rd place: Sidorov (20 pts)
    # Disqualified: Kuznetsov
    res_reg_ivanov = Result(competition_id=comp_regional.id, athlete_id=user_ivanov.id, place=1, score=100.0, status=ResultStatus.NORMAL, notes="Решил все 8 задач")
    res_reg_petrov = Result(competition_id=comp_regional.id, athlete_id=user_petrov.id, place=2, score=85.0, status=ResultStatus.NORMAL, notes="Решил 7 задач")
    res_reg_sidorov = Result(competition_id=comp_regional.id, athlete_id=user_sidorov.id, place=3, score=70.0, status=ResultStatus.NORMAL, notes="Решил 5 задач")
    res_reg_kuznetsov = Result(competition_id=comp_regional.id, athlete_id=user_kuznetsov.id, place=None, score=0.0, status=ResultStatus.DISQUALIFIED, notes="Дисквалифицирован решением ГСК")

    # Interregional Championship (PFO):
    # 1st place: Petrov (60 pts) -> Petrov has 2 podiums (2nd and 1st)! x1.2 applied! Total: (30 + 60) * 1.2 = 108.0
    # 2nd place: Ivanov (45 pts) -> Ivanov has 2 podiums (1st and 2nd)! x1.2 applied! Total: (40 + 45) * 1.2 = 102.0
    res_pfo_petrov = Result(competition_id=comp_interreg.id, athlete_id=user_petrov.id, place=1, score=98.0, status=ResultStatus.NORMAL, notes="1 место окружного этапа")
    res_pfo_ivanov = Result(competition_id=comp_interreg.id, athlete_id=user_ivanov.id, place=2, score=92.0, status=ResultStatus.NORMAL, notes="2 место окружного этапа")

    db.add_all([
        res_reg_ivanov, res_reg_petrov, res_reg_sidorov, res_reg_kuznetsov,
        res_pfo_petrov, res_pfo_ivanov
    ])
    await db.flush()

    # 13. Certificate for Bonus D10 (Ivanov 1st place)
    cert_ivanov = Certificate(
        number="ФСП-2026-784912",
        athlete_id=user_ivanov.id,
        competition_id=comp_regional.id,
        result_id=res_reg_ivanov.id
    )
    db.add(cert_ivanov)

    await db.commit()
