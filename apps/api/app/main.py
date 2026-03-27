import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, families, subjects, curriculums, week_planner

logger = logging.getLogger(__name__)

app = FastAPI(title="Oikos API", version="1.0.0")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(families.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")
app.include_router(curriculums.router, prefix="/api/v1")
app.include_router(week_planner.router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status": "ok"}
