# ReQuest — образ сайта
FROM node:22-alpine AS deps
WORKDIR /srv/request
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /srv/request
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /srv/request/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /srv/request
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /srv/request/.next/standalone ./
COPY --from=build --chown=app:app /srv/request/.next/static ./.next/static
COPY --from=build --chown=app:app /srv/request/public ./public
COPY --from=build --chown=app:app /srv/request/db ./db
COPY --from=build --chown=app:app /srv/request/scripts ./scripts
COPY --from=build --chown=app:app /srv/request/lib/password.mjs ./lib/password.mjs
COPY --from=deps --chown=app:app /srv/request/node_modules/postgres ./node_modules/postgres
RUN mkdir -p /srv/request/uploads && chown app:app /srv/request/uploads
USER app
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
