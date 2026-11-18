FROM node:24-alpine as build-deps

WORKDIR /usr/src/app
COPY . .

ENV NODE_OPTIONS --openssl-legacy-provider

RUN --mount=type=cache,target=/root/.npm \
    npm ci && npm run build

FROM ghcr.io/ticketz-oss/nginx-alpine

WORKDIR /usr/share/nginx/html

COPY --from=build-deps /usr/src/app/build /var/www/public
COPY nginx /etc/nginx

# /config.json is public. Only the keys the frontend reads are published;
# every other container variable stays private (secrets, proxy and ACME
# settings, hostnames of internal services).
ENV PUBLIC_CONFIG_KEYS="BACKEND_PROTOCOL BACKEND_HOST BACKEND_PORT BACKEND_PATH REACT_APP_BACKEND_URL RECAPTCHA_SITE_KEY WAVOIP_ENABLED"

CMD sep=""; \
    { printf '{'; \
      for name in $PUBLIC_CONFIG_KEYS; do \
        eval "value=\${$name-}"; \
        [ -n "$value" ] || continue; \
        value=$(printf '%s' "$value" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'); \
        printf '%s\n\t"%s": "%s"' "$sep" "$name" "$value"; \
        sep=","; \
      done; \
      printf '\n}\n'; } > /var/www/public/config.json \
    && if [ -n "$BACKEND_SERVICE" ]; then \
        BACKEND_IP=$(getent hosts $BACKEND_SERVICE | awk '{ print $1 }') \
        && echo "$BACKEND_IP backend" >> /etc/hosts; \
    fi \
    && nginx -g "daemon off;"
