FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# fonts-liberation — кириллица в PDF (сертификаты, протоколы)
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# non-root + каталоги для генерируемых файлов
RUN useradd -m -u 1000 app \
 && mkdir -p /app/uploads /app/generated_docs \
 && chown -R app:app /app
USER app

EXPOSE 8000

# 1 воркер: планировщик (APScheduler) и Telegram-бот живут внутри процесса
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
