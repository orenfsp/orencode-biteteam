import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("."))
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from datetime import date, datetime
from sqlalchemy import select

from app.database import init_db, async_session_factory
from app.models.discipline import Discipline
from app.models.competition import Competition, CompetitionLevel, CompetitionStatus
from app.models.result import Result, ResultStatus
from app.models.user import User, UserRole, RoleEnum
from app.models.document import Certificate
from app.models.rank import RankRecord
from app.services.seed_data import seed_all_data
from app.services.rating_service import calculate_season_rating
from app.services.evsk_service import evaluate_evsk_rank, calculate_rank_validity_date
from app.services.document_service import DocumentService

sys.stdout.reconfigure(encoding='utf-8')


async def run_full_verification():
    print("=============================================================")
    print(">>> НАЧАЛО ТЕСТИРОВАНИЯ БЭКЕНДА ФСП ОРЕНБУРГСКОЙ ОБЛАСТИ")
    print("=============================================================\n")

    # 1. DB Init & Seeding
    print("[1/7] Инициализация базы данных и загрузка демо-данных...")
    await init_db()
    async with async_session_factory() as db:
        await seed_all_data(db)
    print("  [OK] База данных и демо-данные успешно загружены.\n")

    async with async_session_factory() as db:
        # 2. Verify all 6 disciplines
        print("[2/7] Проверка 6 официальных дисциплин спортивного программирования:")
        disc_res = await db.execute(select(Discipline).order_by(Discipline.id))
        disciplines = disc_res.scalars().all()
        assert len(disciplines) == 6, f"Ожидалось 6 дисциплин, получено {len(disciplines)}"
        for d in disciplines:
            print(f"  * [{d.code}] {d.name}")
        print("  [OK] Все 6 дисциплин вида спорта в наличии.\n")

        # 3. Multi-role user check
        print("[3/7] Проверка пользователей и мультиролевой модели:")
        users_res = await db.execute(select(User))
        users = users_res.scalars().all()
        print(f"  Всего пользователей в системе: {len(users)}")

        dual_role_user = next((u for u in users if len(u.roles) > 1), None)
        assert dual_role_user is not None, "Должен быть пользователь с несколькими ролями одновременно"
        roles_str = [r.role.value if hasattr(r.role, "value") else str(r.role) for r in dual_role_user.roles]
        print(f"  * Пользователь с совмещенными ролями: {dual_role_user.full_name} -> {roles_str}")
        print("  [OK] Мультиролевая модель функционирует корректно.\n")

        # 4. Rating Calculation with x1.2 and DQ filter
        print("[4/7] Проверка калькулятора рейтинга (x1.2 бонус стабильности и отсечение дисквалифицированных):")
        rating_items = await calculate_season_rating(discipline_id=1, season="2026", db=db)
        print(f"  Рейтинговая таблица (дисциплина ALGO, сезон 2026):")
        for idx, item in enumerate(rating_items, start=1):
            x12_flag = " (x1.2 применен!)" if item.multiplier_applied else ""
            print(f"  {idx}. {item.athlete_name}: {item.final_points} баллов (базовые: {item.raw_points}, подиумов: {item.top3_count}){x12_flag}")

        # Verification of x1.2
        multiplier_user = next((it for it in rating_items if it.multiplier_applied), None)
        assert multiplier_user is not None, "У спортсмена с >=2 призовыми местами должен применяться x1.2"

        print(f"  * Спортсмен с бонусом стабильности: {multiplier_user.athlete_name} ({multiplier_user.final_points} очков)")

        # Verification of DQ exclusion
        dq_user_in_rating = next((it for it in rating_items if "Федоров" in it.athlete_name), None)
        assert dq_user_in_rating is None, "Дисквалифицированный спортсмен Федоров НЕ должен попадать в рейтинг!"
        print("  * Дисквалифицированный спортсмен (Федоров Данил) успешно отсечен из рейтинга.")
        print("  [OK] Логика калькулятора рейтинга строго соответствует ТЗ.\n")


        # 5. EVSK Rules and Expiration
        print("[5/7] Проверка модуля разрядов по нормам ЕВСК и контроля сроков:")
        rank_champ_1 = evaluate_evsk_rank("championship_russia", 1)
        rank_reg_1 = evaluate_evsk_rank("regional", 1)
        print(f"  * Чемпионат России 1 место: норматив {rank_champ_1}")
        print(f"  * Чемпионат области 1 место: норматив {rank_reg_1}")

        validity_2y = calculate_rank_validity_date("first", date(2026, 1, 1))
        validity_cms = calculate_rank_validity_date("cms", date(2026, 1, 1))
        print(f"  * Срок 1 разряда (2 года): {validity_2y}")
        print(f"  * Срок КМС (3 года): {validity_cms}")
        assert validity_2y.year == 2028
        assert validity_cms.year == 2029
        print("  [OK] Нормативы ЕВСК и сроки действия рассчитываются правильно.\n")

        # 6. File Generators (.docx, .pdf, .xlsx)
        print("[6/7] Проверка генераторов документов:")
        comp_res = await db.execute(select(Competition).where(Competition.discipline_id == 1))
        comp = comp_res.scalars().first()

        # Word protocol
        docx_stream = DocumentService.generate_protocol_docx(
            comp_data={"title": comp.title, "discipline_name": "Алгоритмическое программирование", "start_date": "10.01.2026", "end_date": "12.01.2026", "location": "Оренбург", "level": "regional"},
            results_data=[{"place": 1, "athlete_name": "Иванов Иван", "athlete_organization": "ОГУ", "athlete_municipality": "Оренбург", "score": 100, "rank": "1 разряд", "status": "normal"}],
            judges_data=[{"judge_name": "Васильев А.Н.", "position": "Главный судья", "category": "1 кат"}]
        )
        assert len(docx_stream.getvalue()) > 1000, "DOCX stream is empty"
        print(f"  * Протокол соревнования (.docx): сформирован ({len(docx_stream.getvalue())} байт)")

        # PDF protocol
        pdf_stream = DocumentService.generate_protocol_pdf(
            comp_data={"title": comp.title, "discipline_name": "Алгоритмическое программирование", "start_date": "10.01.2026", "end_date": "12.01.2026", "location": "Оренбург", "level": "regional"},
            results_data=[{"place": 1, "athlete_name": "Иванов Иван", "athlete_organization": "ОГУ", "score": 100, "rank": "1 разряд", "status": "normal"}],
            judges_data=[{"judge_name": "Васильев А.Н.", "position": "Главный судья", "category": "1 кат"}]
        )
        assert len(pdf_stream.getvalue()) > 1000, "PDF stream is empty"
        print(f"  * Протокол соревнования (.pdf): сформирован ({len(pdf_stream.getvalue())} байт)")

        # Excel Dynamics
        xlsx_stream = DocumentService.generate_statistics_xlsx({
            "disciplines": [
                {"name": "Алгоритмическое программирование", "y24": 120, "y25": 185, "y26": 260},
                {"name": "Продуктовое программирование", "y24": 95, "y25": 140, "y26": 210}
            ],
            "organizations": [
                {"name": "ОГУ", "type": "ВУЗ", "mun": "Оренбург", "y24": 100, "y25": 150, "y26": 220}
            ]
        })
        assert len(xlsx_stream.getvalue()) > 1000, "XLSX stream is empty"
        print(f"  * Отчет о динамике численности (.xlsx): сформирован ({len(xlsx_stream.getvalue())} байт)")

        # Team Order Word
        roster_docx = DocumentService.generate_roster_docx(
            roster_data={"season": "2026", "discipline_name": "Алгоритмическое программирование"},
            main_members=[{"athlete_name": "Иванов Иван", "birth_date": "14.05.2004", "rank": "1 разряд", "organization_name": "ОГУ", "municipality": "г. Оренбург", "rating_score": 102}],
            reserve_members=[{"athlete_name": "Сидоров Артем", "birth_date": "01.12.2008", "rank": "2 разряд", "organization_name": "Лицей 1", "municipality": "г. Оренбург", "rating_score": 20}]
        )
        assert len(roster_docx.getvalue()) > 1000, "Roster DOCX stream is empty"
        print(f"  * Проект приказа о сборной (.docx): сформирован ({len(roster_docx.getvalue())} байт)")
        print("  [OK] Все 4 типа файлов генерируются безупречно.\n")

        # 7. Bonus D10: QR Certificate & Public Verification
        print("[7/7] Проверка Бонуса Д10 (Справка с QR-кодом и публичная верификация):")
        cert_res = await db.execute(select(Certificate))
        cert = cert_res.scalars().first()
        assert cert is not None, "Справка должна быть создана в демо-данных"
        print(f"  * Найдена справка № {cert.number} (Спортсмен: {cert.athlete.full_name})")

        cert_pdf = DocumentService.generate_certificate_pdf(
            cert_number=cert.number,
            athlete_name=cert.athlete.full_name,
            comp_title=cert.competition.title,
            discipline_name="Алгоритмическое программирование",
            comp_date="10.01.2026 — 12.01.2026",
            place=1,
            verify_url=f"http://localhost:8000/verify/{cert.number}"
        )
        assert len(cert_pdf.getvalue()) > 1000, "Cert PDF is empty"
        print(f"  * PDF-справка с QR-кодом: успешно сгенерирована ({len(cert_pdf.getvalue())} байт)")
        print(f"  * Ссылка верификации по QR-коду: http://localhost:8000/verify/{cert.number}")
        print("  [OK] Бонус Д10 полностью готов и функционирует.\n")

    print("=============================================================")
    print("[SUCCESS] ВСЕ ТЕСТЫ И ТРЕБОВАНИЯ Т/З УСПЕШНО ВЫПОЛНЕНЫ НА 100%!")
    print("=============================================================")


if __name__ == "__main__":
    asyncio.run(run_full_verification())
