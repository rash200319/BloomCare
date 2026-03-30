from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.api_router import api_router
from core.config import settings


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description="BloomCare FastAPI backend service.",
)

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8005",
        "http://127.0.0.1:8005",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    return {
        "service": settings.PROJECT_NAME,
        "status": "healthy",
    }
