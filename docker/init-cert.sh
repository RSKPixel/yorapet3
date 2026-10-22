#!/bin/sh
# One-time: request the Let's Encrypt certificate and switch nginx to HTTPS.
# Run from the docker folder after `docker compose up -d` and once DNS points here.
set -e
. ./.env
docker compose run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot -d "$DOMAIN" \
    --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email
docker compose exec nginx sh -c '/docker-entrypoint.d/40-enable-https.sh && nginx -s reload'
echo "HTTPS enabled: https://$DOMAIN/health"
