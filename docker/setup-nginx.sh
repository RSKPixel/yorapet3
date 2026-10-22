#!/bin/sh
# Installs the nginx site for DOMAIN -> 127.0.0.1:API_PORT (values from .env), then reloads nginx.
# Run on the server from this folder:  sudo ./setup-nginx.sh
set -e
. ./.env
: "${DOMAIN:?DOMAIN missing in .env}"
API_PORT=${API_PORT:-8009}
export DOMAIN API_PORT

if [ -d /etc/nginx/sites-available ]; then
    TARGET=/etc/nginx/sites-available/$DOMAIN
    envsubst '${DOMAIN} ${API_PORT}' < nginx-site.conf.template > "$TARGET"
    ln -sf "$TARGET" "/etc/nginx/sites-enabled/$DOMAIN"
else
    TARGET=/etc/nginx/conf.d/$DOMAIN.conf
    envsubst '${DOMAIN} ${API_PORT}' < nginx-site.conf.template > "$TARGET"
fi

nginx -t && systemctl reload nginx
echo "nginx: http://$DOMAIN -> 127.0.0.1:$API_PORT ($TARGET)"
echo "For HTTPS run:  sudo certbot --nginx -d $DOMAIN"
