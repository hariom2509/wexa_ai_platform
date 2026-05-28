from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.alert_tasks", "app.tasks.report_tasks"]
)

celery_app.conf.task_routes = {
    "app.tasks.alert_tasks.*": "main-queue",
    "app.tasks.report_tasks.*": "main-queue",
}

# Celery Beat schedule — periodic tasks
celery_app.conf.beat_schedule = {
    # Evaluate all active alert rules every minute
    "evaluate-alerts-every-minute": {
        "task": "app.tasks.alert_tasks.evaluate_alerts",
        "schedule": 60.0,  # every 60 seconds
    },
    # Run daily scheduled reports every day at 7 AM UTC
    "run-daily-reports": {
        "task": "app.tasks.report_tasks.generate_scheduled_reports",
        "schedule": crontab(hour=7, minute=0),
        "args": ("daily",),
    },
    # Run weekly reports every Monday at 7 AM UTC
    "run-weekly-reports": {
        "task": "app.tasks.report_tasks.generate_scheduled_reports",
        "schedule": crontab(hour=7, minute=0, day_of_week=1),
        "args": ("weekly",),
    },
    # Run monthly reports on 1st of each month at 7 AM UTC
    "run-monthly-reports": {
        "task": "app.tasks.report_tasks.generate_scheduled_reports",
        "schedule": crontab(hour=7, minute=0, day_of_month=1),
        "args": ("monthly",),
    },
}

celery_app.conf.timezone = "UTC"