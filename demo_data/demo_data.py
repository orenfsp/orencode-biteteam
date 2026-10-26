import json
import random
from datetime import datetime, timedelta

from faker import Faker

# Инициализируем Faker для русской локализации
fake = Faker('ru_RU')

# 1. Справочники контекста Оренбурга
CLUBS = [
    "СШОР №2 г. Оренбург",
    "СК 'Оренбург'",
    "Центр дзюдо Оренбург",
    "ДЮСШ 'Маяк'",
    "Академия настольного тенниса"
]

DISCIPLINES = [
    "Настольный теннис",
    "Дзюдо",
    "Плавание",
    "Легкая атлетика"
]

COMPETITIONS = [
    "Первенство Оренбургской области 2024",
    "Кубок г. Оренбурга 2024",
    "Чемпионат Оренбургской области 2025",
    "Оренбургская весна 2025",
    "Кубок Губернатора Оренбургской области 2026"
]

# 2. Генерация 25 спортсменов и тренеров
users = []
for i in range(1, 26):
    role = "Тренер" if i <= 5 else "Спортсмен"
    users.append({
        "id": i,
        "full_name": fake.name(),
        "role": role,
        "club": random.choice(CLUBS),
        "discipline": random.choice(DISCIPLINES),
        "age": random.randint(14, 35) if role == "Спортсмен" else random.randint(30, 60)
    })

# 3. Генерация 5 соревнований
competitions_data = []
for i, comp_name in enumerate(COMPETITIONS, start=1):
    competitions_data.append({
        "id": i,
        "title": comp_name,
        "city": "Оренбург",
        "date": (datetime.now() - timedelta(days=random.randint(30, 700))).strftime("%Y-%m-%d")
    })

# 4. Генерация 50 протоколов соревнований (за 2 года)
protocols = []
sportsmen_ids = [u["id"] for u in users if u["role"] == "Спортсмен"]

for i in range(1, 51):
    protocols.append({
        "protocol_id": 1000 + i,
        "competition_id": random.choice(competitions_data)["id"],
        "athlete_id": random.choice(sportsmen_ids),
        "place": random.randint(1, 10),
        "score": round(random.uniform(60.0, 99.5), 2),
        "status": random.choice(["Квалифицирован", "Дисквалифицирован", "Финалист"]),
        "created_at": (datetime.now() - timedelta(days=random.randint(1, 700))).strftime("%Y-%m-%d")
    })

# 5. Сохранение в JSON
with open('demo_data.json', 'w', encoding='utf-8') as f:
    json.dump({
        "users": users,
        "competitions": competitions_data,
        "protocols": protocols
    }, f, ensure_ascii=False, indent=4)

print("Данные успешно сгенерированы в файл demo_data.json!")