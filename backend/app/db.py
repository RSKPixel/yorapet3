import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

engine = create_engine(
    "mysql+pymysql://{}:{}@{}/{}".format(
        os.environ["DB_USER"],
        quote_plus(os.environ["DB_PASSWORD"]),
        os.environ["DB_HOST"],
        os.environ["DB_NAME"],
    ),
    pool_pre_ping=True,
    pool_recycle=3600,
)

USERS_DDL = """
CREATE TABLE IF NOT EXISTS app_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name VARCHAR(120),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


def init_db():
    with engine.begin() as conn:
        conn.execute(text(USERS_DDL))


def fetch_all(sql, **params):
    with engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(text(sql), params)]


def fetch_one(sql, **params):
    rows = fetch_all(sql, **params)
    return rows[0] if rows else None
