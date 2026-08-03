# Crawler — Python + Crawl4AI — Phase 1
# Build context: repo root

FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CRAWL_TIMEZONE=Asia/Ho_Chi_Minh \
    PYTHONPATH=/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY crawler/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY crawler/ /app/

# Default: long-running scheduler (cron-like). Override for one-shot jobs.
CMD ["python", "-m", "scheduler.main"]
