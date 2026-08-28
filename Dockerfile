# syntax=docker/dockerfile:1

# --------------------------------------------------------------- dependencias
# Usamos la imagen Debian slim porque better-sqlite3 publica binarios ya
# compilados para glibc: no hay que instalar python/make/g++ en la imagen.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------- build
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --------------------------------------------------------------- imagen final
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data

# Salida "standalone": solo el servidor y las dependencias que realmente usa.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Lo que necesita el sembrado inicial dentro del contenedor.
COPY --from=builder --chown=node:node /app/src/lib/schema.sql ./schema.sql
COPY --from=builder --chown=node:node /app/src/lib/schema.sql ./src/lib/schema.sql
COPY --from=builder --chown=node:node /app/src/lib/taxonomy.mjs ./src/lib/taxonomy.mjs
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/data/catalog.json ./seed/catalog.json
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh \
 && mkdir -p /app/data/uploads \
 && chown -R node:node /app/data

USER node
EXPOSE 3000

# Sin curl ni wget: usamos el propio Node, que ya trae fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
