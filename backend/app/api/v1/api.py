from fastapi import APIRouter

api_router = APIRouter()

from .endpoints import projects

api_router.include_router(projects.router, prefix="/projects", tags=["projects"])

@api_router.get("/ping")
def ping():
    return {"ping": "pong"}
