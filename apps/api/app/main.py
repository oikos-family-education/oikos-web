import logging
import os
from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.app_mode import is_desktop
from app.routers import auth, families, invitations, subjects, curriculums, week_planner, resources, projects, calendar, progress, notes, lessons, users, beta, admin, communities, meetups, notifications, messages, child_reports, auth_local

logger = logging.getLogger(__name__)

# Routers that exist in both modes.
SHARED_ROUTERS: list[APIRouter] = [
    auth.router,
    families.router,
    subjects.router,
    curriculums.router,
    week_planner.router,
    resources.router,
    projects.router,
    calendar.router,
    progress.router,
    notes.router,
    lessons.router,
    users.router,
    child_reports.router,
]

# Hosted-service features (multi-family, email, moderation); not mounted in desktop mode.
CLOUD_ONLY_ROUTERS: list[APIRouter] = [
    invitations.router,
    beta.router,
    admin.router,
    communities.router,
    meetups.router,
    notifications.router,
    messages.router,
]

# Local-app features (backup, updates, ...); not mounted in cloud mode.
DESKTOP_ONLY_ROUTERS: list[APIRouter] = [
    auth_local.router,
]


def create_app() -> FastAPI:
    application = FastAPI(title="Oikos API", version="1.0.0")

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.error("Validation error on %s %s: %d error(s)", request.method, request.url.path, len(exc.errors()))
        return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())})

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    routers = list(SHARED_ROUTERS)
    routers += DESKTOP_ONLY_ROUTERS if is_desktop() else CLOUD_ONLY_ROUTERS
    for router in routers:
        application.include_router(router, prefix="/api/v1")

    # E2E test-seed router — only mounted when the secret is configured.
    # This guard is deliberately at the include site (not inside the router file)
    # so a production image without the secret never imports the seed code path.
    # See doc/12-e2e-testing-plan.md §4.
    if os.getenv("E2E_SEED_SECRET"):
        from app.routers import e2e_seed  # noqa: WPS433 (in-function import is intentional)

        application.include_router(e2e_seed.router)
        logger.warning(
            "E2E_SEED_SECRET is set — /api/v1/e2e/* endpoints are EXPOSED. "
            "Never run with this variable set in production."
        )

    @application.get("/health")
    async def health():
        return {"status": "ok"}

    return application


app = create_app()
