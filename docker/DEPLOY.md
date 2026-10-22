# Deploying the Yorapet API (production only)

Docker runs only the API (port 8009, localhost only, built from `../backend`).
The server's own nginx is the public entry and handles HTTPS via certbot.

## First time on the server

1. Point a DNS **A record** for `yorapetapi.yoratech.com` to the server.
2. Copy the `backend` and `docker` folders to the server (side by side), then in `docker/`:
   ```bash
   cp .env.example .env          # fill in DB_*, JWT_SECRET, API_PORT, DOMAIN
   docker compose up -d --build
   curl http://127.0.0.1:8009/health
   ```
3. Add the nginx site and HTTPS:
   ```bash
   sudo ./setup-nginx.sh
   sudo certbot --nginx -d yorapetapi.yoratech.com
   ```
4. Create app users:
   ```bash
   docker compose exec api python create_user.py admin "Admin"
   ```

Logs: `docker compose logs -f api`. Update after code changes: `docker compose up -d --build`.
