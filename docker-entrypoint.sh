#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
DB_PATH="${DATABASE_PATH:-$DATA_DIR/tusseguidores.db}"

mkdir -p "$DATA_DIR/uploads"

# En el primer arranque sembramos el catálogo y el usuario admin.
# En los siguientes no se toca nada de lo que ya está en el volumen.
if [ ! -f "$DB_PATH" ]; then
  echo "==> Primera ejecución: sembrando la base de datos en $DB_PATH"
  mkdir -p /app/data
  cp -n /app/seed/catalog.json /app/data/catalog.json 2>/dev/null || true
  node /app/scripts/seed.mjs || echo "!! El sembrado falló; la tienda arrancará vacía."
elif [ "${SEED_ON_START}" = "1" ]; then
  echo "==> SEED_ON_START=1: actualizando el catálogo del proveedor"
  cp -n /app/seed/catalog.json /app/data/catalog.json 2>/dev/null || true
  node /app/scripts/seed.mjs --only-import || true
fi

exec "$@"
