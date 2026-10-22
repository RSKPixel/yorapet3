import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from .db import fetch_one

SECRET = os.environ["JWT_SECRET"]
TOKEN_DAYS = 30

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginIn):
    user = fetch_one(
        "SELECT id, username, full_name, password_hash FROM app_users "
        "WHERE username = :u AND is_active = 1",
        u=body.username.strip(),
    )
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Invalid username or password")
    exp = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    token = jwt.encode({"sub": str(user["id"]), "exp": exp}, SECRET, algorithm="HS256")
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "full_name": user["full_name"]},
    }


def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(cred.credentials, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired, please log in again")
    user = fetch_one(
        "SELECT id, username, full_name FROM app_users WHERE id = :id AND is_active = 1",
        id=int(payload["sub"]),
    )
    if not user:
        raise HTTPException(401, "User disabled")
    return user


@router.get("/me")
def me(user=Depends(current_user)):
    return user
