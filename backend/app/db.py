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


PRODUCTION_DDL = """
CREATE TABLE IF NOT EXISTS app_production (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prod_date DATE NOT NULL,
    output_item VARCHAR(200) NOT NULL,
    output_qty DECIMAL(14,2) NOT NULL DEFAULT 0,
    preform_item VARCHAR(200),
    preform_qty DECIMAL(14,2) NOT NULL DEFAULT 0,
    preform_rate DECIMAL(12,4),
    cap_item VARCHAR(200),
    cap_qty DECIMAL(14,2) NOT NULL DEFAULT 0,
    cap_rate DECIMAL(12,4),
    wastage_qty DECIMAL(14,2) NOT NULL DEFAULT 0,
    eb_start DECIMAL(14,2) NOT NULL DEFAULT 0,
    eb_end DECIMAL(14,2) NOT NULL DEFAULT 0,
    eb_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    labour_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes VARCHAR(500),
    created_by INT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_prod_date (prod_date)
)
"""


def init_db():
    with engine.begin() as conn:
        conn.execute(text(USERS_DDL))
        conn.execute(text(PRODUCTION_DDL))
        _add_columns(conn, "app_production", {
            "preform_rate": "DECIMAL(12,4) AFTER preform_qty",
            "cap_rate": "DECIMAL(12,4) AFTER cap_qty",
        })


# MySQL has no ADD COLUMN IF NOT EXISTS, so check information_schema first.
def _add_columns(conn, table, columns):
    existing = {
        r[0]
        for r in conn.execute(
            text("SELECT column_name FROM information_schema.columns "
                 "WHERE table_schema = DATABASE() AND table_name = :t"),
            {"t": table},
        )
    }
    for name, ddl in columns.items():
        if name not in existing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def execute(sql, **params):
    with engine.begin() as conn:
        return conn.execute(text(sql), params).lastrowid


def fetch_all(sql, **params):
    with engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(text(sql), params)]


def fetch_one(sql, **params):
    rows = fetch_all(sql, **params)
    return rows[0] if rows else None
