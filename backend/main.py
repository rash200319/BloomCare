from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from backend.api.api_router import api_router
from backend.core.config import settings


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description="BloomCare FastAPI backend service.",
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version="2.0.0",
        description="BloomCare FastAPI backend service.",
        routes=app.routes,
    )
    components = openapi_schema.setdefault("components", {})
    # Clear any auto-generated security schemes
    security_schemes = components.get("securitySchemes", {})
    security_schemes.clear()
    
    # Add only the simple HTTPBearer scheme
    security_schemes["HTTPBearer"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Enter your JWT token. Get it by logging in with /auth/login/staff or /auth/login/patient"
    }
    components["securitySchemes"] = security_schemes
    openapi_schema["security"] = [{"HTTPBearer": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
        "https://127.0.0.1:3000",
        "http://localhost:8005",
        "http://127.0.0.1:8005",
    ],
    # Keep explicit allow_origins while also covering local dev ports consistently.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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
