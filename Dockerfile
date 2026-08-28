# syntax=docker/dockerfile:1

# --------------------------------------------------------------- dependencias
FROM node:22-alpine AS deps
WORKDIR /app
# better-sqlite3 se compila desde el código fuente.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------- build
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --------------------------------------------------------------- imagen final
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data

RUN apk add --no-cache wget && \
    addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nextjs -G nodejs

# Salida "standalone": solo el servidor y las dependencias que realmente usa.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Lo que necesita el sembrado inicial dentro del contenedor.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/schema.sql ./schema.sql
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/schema.sql ./src/lib/schema.sql
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/taxonomy.mjs ./src/lib/taxonomy.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/data/catalog.json ./seed/catalog.json
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
