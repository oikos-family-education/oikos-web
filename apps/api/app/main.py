import logging
import os
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, families, invitations, subjects, curriculums, week_planner, resources, projects, calendar, progress, notes

logger = logging.getLogger(__name__)

app = FastAPI(title="Oikos API", version="1.0.0")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error("Validation error on %s %s: %d error(s)", request.method, request.url.path, len(exc.errors()))
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(families.router, prefix="/api/v1")
app.include_router(invitations.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")
app.include_router(curriculums.router, prefix="/api/v1")
app.include_router(week_planner.router, prefix="/api/v1")
app.include_router(resources.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(progress.router, prefix="/api/v1")
app.include_router(notes.router, prefix="/api/v1")

# E2E test-seed router — only mounted when the secret is configured.
# This guard is deliberately at the include site (not inside the router file)
# so a production image without the secret never imports the seed code path.
# See doc/12-e2e-testing-plan.md §4.
if os.getenv("E2E_SEED_SECRET"):
    from app.routers import e2e_seed  # noqa: WPS433 (in-function import is intentional)

    app.include_router(e2e_seed.router)
    logger.warning(
        "E2E_SEED_SECRET is set — /api/v1/e2e/* endpoints are EXPOSED. "
        "Never run with this variable set in production."
    )

@app.get("/health")
async def health():
    return {"status": "ok"}
