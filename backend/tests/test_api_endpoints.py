import os
import sys

sys.path.insert(0, os.path.abspath("."))
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_suite():
    print("\n🌐 ЗАПУСК ТЕСТИРОВАНИЯ HTTP API ENDPOINTS...")

    # 1. Healthcheck
    r = client.get("/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("  ✅ GET /health -> 200 OK")

    # 2. Login as Admin
    r_login = client.post("/api/v1/auth/login", json={"email": "admin@fsp56.ru", "password": "secret123"})
    assert r_login.status_code == 200, f"Admin login failed: {r_login.text}"
    admin_token = r_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}", "X-Active-Role": "federation"}
    print(f"  ✅ POST /api/v1/auth/login (Admin) -> 200 OK (JWT Token received)")

    # 3. Multi-role Login & Switch Role
    r_multi = client.post("/api/v1/auth/login", json={"email": "coach.morozov@fsp56.ru", "password": "secret123"})
    assert r_multi.status_code == 200
    roles = r_multi.json()["roles"]
    assert "coach" in roles and "athlete" in roles, "Expected both coach and athlete roles"
    multi_token = r_multi.json()["access_token"]
    multi_headers = {"Authorization": f"Bearer {multi_token}"}
    print(f"  ✅ Мультиролевой вход: roles = {roles}")

    r_switch = client.post("/api/v1/auth/switch-role", json={"role": "athlete"}, headers=multi_headers)
    assert r_switch.status_code == 200
    assert r_switch.json()["active_role"] == "athlete"
    print("  ✅ POST /api/v1/auth/switch-role -> активная роль переключена на 'athlete'")

    # 4. Disciplines
    r_disc = client.get("/api/v1/disciplines")
    assert r_disc.status_code == 200
    disciplines = r_disc.json()
    assert len(disciplines) == 6, f"Expected 6 disciplines, got {len(disciplines)}"
    print(f"  ✅ GET /api/v1/disciplines -> 200 OK (все 6 дисциплин вида спорта)")

    # 5. Organizations
    r_org = client.get("/api/v1/organizations")
    assert r_org.status_code == 200
    orgs = r_org.json()
    assert len(orgs) >= 3
    print(f"  ✅ GET /api/v1/organizations -> 200 OK ({len(orgs)} организаций)")

    # 6. Competitions Calendar
    r_comp = client.get("/api/v1/competitions")
    assert r_comp.status_code == 200
    comps = r_comp.json()
    assert len(comps) >= 4
    comp_id = comps[0]["id"]
    print(f"  ✅ GET /api/v1/competitions -> 200 OK ({len(comps)} турниров в календаре)")

    # 7. Protocol of competition
    r_proto = client.get(f"/api/v1/competitions/{comp_id}/protocol")
    assert r_proto.status_code == 200
    proto = r_proto.json()
    print(f"  ✅ GET /api/v1/competitions/{comp_id}/protocol -> 200 OK (участников: {len(proto['results'])}, судей: {len(proto['judges'])})")

    # 8. Rating with x1.2 stability multiplier and DQ filter
    r_rating = client.get("/api/v1/rating/athletes?discipline_id=1&season=2026")
    assert r_rating.status_code == 200
    rating_data = r_rating.json()
    athletes = rating_data["athletes"]
    assert len(athletes) >= 2
    top_athlete = athletes[0]
    assert top_athlete["multiplier_applied"] is True, "Expected multiplier_applied=True"
    assert top_athlete["final_points"] == 120, f"Expected 120 points, got {top_athlete['final_points']}"
    # Verify DQ exclusion
    for a in athletes:
        assert "Федоров" not in a["athlete_name"], "Disqualified athlete should not be in rating"
    print(f"  ✅ GET /api/v1/rating/athletes -> 200 OK (лидер: {top_athlete['athlete_name']}, 120 очков, x1.2 применен, DQ отсечен)")

    # 9. Expiring ranks (30 days threshold)
    r_ranks = client.get("/api/v1/ranks/expiring?days=30", headers=admin_headers)
    assert r_ranks.status_code == 200
    exp_ranks = r_ranks.json()
    assert len(exp_ranks) >= 1
    print(f"  ✅ GET /api/v1/ranks/expiring -> 200 OK (найден истекающий разряд: {exp_ranks[0]['athlete_name']}, осталось {exp_ranks[0]['days_left']} дн.)")

    # 10. Expiring judge categories
    r_judges = client.get("/api/v1/judges/expiring?days=30", headers=admin_headers)
    assert r_judges.status_code == 200
    exp_judges = r_judges.json()
    assert len(exp_judges) >= 1
    print(f"  ✅ GET /api/v1/judges/expiring -> 200 OK (найдена истекающая категория судьи: {exp_judges[0]['judge_name']})")

    # 11. Bonus D10: Public QR verification endpoint
    r_verify = client.get("/verify/FSP-OREN-2026-7A8B")
    assert r_verify.status_code == 200, f"Verify failed: {r_verify.text}"
    cert_info = r_verify.json()
    assert cert_info["valid"] is True
    assert "Смирнов" in cert_info["athlete_name"]
    print(f"  ✅ GET /verify/FSP-OREN-2026-7A8B -> 200 OK (Д10: подлинность подтверждена, {cert_info['athlete_name']})")

    # 12. Documents: Excel Statistics
    r_xlsx = client.get("/api/v1/documents/statistics/xlsx", headers=admin_headers)
    assert r_xlsx.status_code == 200
    assert len(r_xlsx.content) > 1000
    print(f"  ✅ GET /api/v1/documents/statistics/xlsx -> 200 OK ({len(r_xlsx.content)} байт Excel)")

    # 13. Documents: Word Protocol
    r_docx = client.get(f"/api/v1/documents/protocol/{comp_id}/docx")
    assert r_docx.status_code == 200
    assert len(r_docx.content) > 1000
    print(f"  ✅ GET /api/v1/documents/protocol/{comp_id}/docx -> 200 OK ({len(r_docx.content)} байт DOCX)")

    # 14. Documents: PDF Protocol
    r_pdf = client.get(f"/api/v1/documents/protocol/{comp_id}/pdf")
    assert r_pdf.status_code == 200
    assert len(r_pdf.content) > 1000
    print(f"  ✅ GET /api/v1/documents/protocol/{comp_id}/pdf -> 200 OK ({len(r_pdf.content)} байт PDF)")

    print("\n🎉 ВСЕ 14 HTTP API ТЕСТОВ УСПЕШНО ПРОЙДЕНЫ!")


if __name__ == "__main__":
    test_api_suite()
