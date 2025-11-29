from fastapi import APIRouter

api_router = APIRouter()

# We will include other routers here later, e.g.:
# from .endpoints import users, projects
# api_router.include_router(users.router, prefix="/users", tags=["users"])
# api_router.include_router(projects.router, prefix="/projects", tags=["projects"])

@api_router.get("/ping")
def ping():
    return {"ping": "pong"}
