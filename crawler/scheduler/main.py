"""Long-running scheduler — daily crawl at CRAWL_SCHEDULE (default 02:00 VN)."""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from pathlib import Path

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("crawler.scheduler")


def run_job() -> None:
    log.info("Starting scheduled crawl…")
    subprocess.check_call([sys.executable, "-m", "scheduler.run_once"], cwd=str(ROOT))


def main() -> None:
    load_dotenv(ROOT.parent / ".env")
    tz = os.getenv("CRAWL_TIMEZONE", "Asia/Ho_Chi_Minh")
    # Default: 02:00 every day
    schedule = os.getenv("CRAWL_SCHEDULE", "0 2 * * *").split()
    if len(schedule) != 5:
        minute, hour = "0", "2"
        day, month, dow = "*", "*", "*"
    else:
        minute, hour, day, month, dow = schedule

    sched = BlockingScheduler(timezone=tz)
    sched.add_job(
        run_job,
        CronTrigger(minute=minute, hour=hour, day=day, month=month, day_of_week=dow, timezone=tz),
        id="daily_crawl",
        replace_existing=True,
    )
    log.info("Scheduler started tz=%s cron=%s %s %s %s %s", tz, minute, hour, day, month, dow)
    # Also run once on boot in non-production convenience mode
    if os.getenv("CRAWL_ON_START", "1") == "1":
        try:
            run_job()
        except Exception:  # noqa: BLE001
            log.exception("Initial crawl failed (scheduler continues)")
    sched.start()


if __name__ == "__main__":
    main()
