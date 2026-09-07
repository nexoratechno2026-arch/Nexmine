from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth
from app.routers import datasets
from app.routers import quality
from app.routers import mining
from app.routers import insights
from app.routers import whatif
from app.routers import assistant
from app.routers import reports

from app.database import Base, engine
import app.models  # noqa: F401

# Auto-create all tables on startup if missing
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"[NexMine] Warning: table auto-creation failed: {e}")

app = FastAPI(
    title="Nex Mine API",
    description="AI-Enhanced Data Mining for Small Businesses",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ────────────────────────────────────────────────────────────────────
cors_origins = [
    origin.strip()
    for origin in settings.frontend_url.split(",")
    if origin.strip()
]
for local_origin in ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]:
    if local_origin not in cors_origins:
        cors_origins.append(local_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import traceback
from fastapi import Request
from fastapi.responses import JSONResponse

# ─── Routers ─────────────────────────────────────────────────────────────────
routers = [
    auth.router,
    datasets.router,
    quality.router,
    mining.router,
    insights.router,
    whatif.router,
    assistant.router,
    reports.router,
]

for r in routers:
    app.include_router(r)
    app.include_router(r, prefix="/api")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f"{type(exc).__name__}: {str(exc)}"
    tb = traceback.format_exc()
    print(f"[NexMine] Unhandled exception: {error_msg}\n{tb}")
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server Error: {error_msg}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "app": settings.app_name}

