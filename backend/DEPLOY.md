# Deploying the Yorapet API

Runs three containers: `api` (FastAPI on port 8009, localhost only), `nginx` (public 80/443,
reverse proxy to the API) and `certbot` (renews the HTTPS certificate).

## First time on the server

1. Point a DNS **A record** for `yorapetapi.yoratech.com` to the server's public IP,
   and open ports **80** and **443** on the firewall/router.
2. Copy this `backend` folder to the server, then:
   ```bash
   cp .env.example .env    # fill in DB_*, JWT_SECRET, DOMAIN, CERTBOT_EMAIL
   docker compose up -d --build
   ```
   The API now answers on `http://yorapetapi.yoratech.com/health`.
3. Get the HTTPS certificate (switches nginx to HTTPS and redirects HTTP):
   ```bash
   ./deploy/init-cert.sh
   ```
4. Create app users:
   ```bash
   docker compose exec api python create_user.py admin "Admin"
   ```

Certificates renew automatically. Logs: `docker compose logs -f api nginx`.

## Updating

```bash
docker compose up -d --build api
```
