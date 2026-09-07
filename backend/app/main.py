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

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(quality.router)
app.include_router(mining.router)
app.include_router(insights.router)
app.include_router(whatif.router)
app.include_router(assistant.router)
app.include_router(reports.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "app": settings.app_name}
