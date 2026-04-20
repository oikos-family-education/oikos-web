import os
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Make sure models are imported so Alembic can see them
from app.core.config import settings
from app.core.database import Base
from app.models.user import User
from app.models.family import Family
from app.models.child import Child
from app.models.subject import Subject
from app.models.curriculum import Curriculum, ChildCurriculum, CurriculumSubject
from app.models.week_planner import WeekTemplate, RoutineEntry
from app.models.project import (
    Project, ProjectChild, ProjectSubject, ProjectMilestone,
    MilestoneCompletion, ProjectResource, PortfolioEntry, ChildAchievement,
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set URL from environment
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
