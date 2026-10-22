from fastapi import FastAPI

from . import auth, production, reports
from .db import init_db

app = FastAPI(title="Yorapet API")
app.include_router(auth.router)
app.include_router(production.router)
app.include_router(reports.router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/health")
def health():
    return {"ok": True}
