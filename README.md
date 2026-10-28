# ФСП Оренбургской области — фронт + бэк в Docker

```
Браузер ──► :8080  nginx (frontend)
                    ├─ /            статика (SPA)
                    ├─ /api/*  ───► backend:8000 (FastAPI) ──► db:5432 (PostgreSQL)
                    ├─ /docs, /health   (Swagger бэка)
                    └─ /verify/<№>  → редирект на страницу проверки во фронте (для QR из сертификатов)
```

Наружу открыт **только порт nginx**. Бэк и БД доступны лишь внутри сети compose.
Фронт и API — на одном origin, поэтому CORS и правки адреса API не нужны.

## Запуск

```bash
make init      # создаст .env со случайными секретами (или: cp .env.example .env и отредактируйте)
make up        # сборка и запуск
make seed      # (по желанию) демо-данные
```

Открыть: http://localhost:8080 · Swagger: http://localhost:8080/docs

Демо-аккаунты (после `make seed`, пароль `secret123`): `admin@fsp56.ru`, `coach.ivanov@fsp56.ru`,
`athlete.smirnov@fsp56.ru`, `judge.petrov@fsp56.ru`. Кнопки демо-входа на странице логина
показываются при `SHOW_DEMO=true` в `.env`.

Без `make`: `cp .env.example .env && docker compose up -d --build`, затем
`docker compose exec backend python seed_demo_data.py`.

## Что настраивается в `.env`

| Переменная | Назначение |
|---|---|
| `HTTP_PORT` | порт сайта на хосте (по умолчанию 8080) |
| `PUBLIC_URL` | публичный адрес сайта → попадает в QR-коды сертификатов (на сервере: `https://ваш-домен`) |
| `SECRET_KEY` | ключ подписи JWT |
| `POSTGRES_*` | доступ к БД |
| `TELEGRAM_BOT_TOKEN` | включает Telegram-бота (необязательно) |
| `SHOW_DEMO` | показывать демо-аккаунты на входе |

`config.js` фронта генерируется при старте контейнера из переменных окружения — пересборка образа не нужна.

## Полезное

```bash
make logs            # логи
make down            # остановить (данные сохраняются в томах)
make reset           # остановить и УДАЛИТЬ данные (БД и файлы)
docker compose up -d --build backend   # пересобрать только бэк после правок
```


## На сервере с HTTPS

Поставьте перед стеком обычный reverse-proxy (Caddy/Traefik/nginx на хосте) на `localhost:8080`,
в `.env` задайте `PUBLIC_URL=https://ваш-домен`, `SHOW_DEMO=false`, свои `SECRET_KEY` и пароль БД.
Бэк запускается в **одном** процессе-воркере — это нужно, т.к. планировщик задач и бот живут внутри него.
