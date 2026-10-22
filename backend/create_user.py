"""Register an app user: .venv/bin/python create_user.py <username> "<Full Name>"

Prompts for the password. Re-running for an existing username resets its password.
"""
import getpass
import sys

from sqlalchemy import text

from app.auth import hash_password
from app.db import engine, init_db

if len(sys.argv) < 2:
    sys.exit(__doc__)

username = sys.argv[1].strip()
full_name = sys.argv[2] if len(sys.argv) > 2 else username
password = getpass.getpass("Password: ")
if len(password) < 6 or password != getpass.getpass("Repeat: "):
    sys.exit("Passwords must match and be at least 6 characters")

init_db()
with engine.begin() as conn:
    conn.execute(
        text(
            "INSERT INTO app_users (username, password_hash, full_name) VALUES (:u, :p, :n) "
            "ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), "
            "full_name = VALUES(full_name), is_active = 1"
        ),
        {"u": username, "p": hash_password(password), "n": full_name},
    )
print(f"User '{username}' saved")
