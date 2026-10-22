#!/bin/sh
# Serves the API over plain HTTP until a Let's Encrypt certificate exists,
# then redirects HTTP to HTTPS and enables the 443 server.
set -e
CONF=/etc/nginx/conf.d
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    echo 'location / { return 301 https://$host$request_uri; }' > "$CONF/http-main.inc"
    envsubst '${DOMAIN} ${API_PORT}' < /etc/nginx/https.conf.template > "$CONF/https.conf"
else
    cat > "$CONF/http-main.inc" <<INC
location / {
    proxy_pass http://api:${API_PORT};
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
INC
    rm -f "$CONF/https.conf"
fi
