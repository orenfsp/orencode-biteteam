.PHONY: init up down logs seed reset ps

init:            ## создать .env с случайными секретами
	@test -f .env && echo ".env уже есть" || ( cp .env.example .env && \
	  sed -i.bak "s/change_me_db_password/$$(openssl rand -hex 12)/; s/change_me_long_random_string/$$(openssl rand -hex 32)/" .env && rm -f .env.bak && echo ".env создан" )

up:              ## собрать и запустить всё
	docker compose up -d --build

down:            ## остановить (данные БД сохраняются)
	docker compose down

logs:            ## логи всех сервисов
	docker compose logs -f --tail=100

seed:            ## наполнить БД демо-данными (идемпотентно)
	docker compose exec backend python seed_demo_data.py

reset:           ## ОСТОРОЖНО: остановить и удалить все данные (БД, файлы)
	docker compose down -v

ps:
	docker compose ps
