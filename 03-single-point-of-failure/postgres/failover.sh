#!/bin/bash
echo "Watching for primary failure..."
while true; do
  # Проверяем жив ли primary
  if ! pg_isready -h postgres -U admin -d ecommerce -q 2>/dev/null; then
    # Проверяем что replica ещё не промоучена
    IS_REPLICA=$(psql -h postgres_replica -U admin -d ecommerce -tAc "SELECT pg_is_in_recovery();" 2>/dev/null)
    if [ "$IS_REPLICA" = "t" ]; then
      echo "Primary is DOWN! Promoting replica..."
      psql -h postgres_replica -U admin -d ecommerce -c "SELECT pg_promote();"
      echo "Replica promoted to primary!"
    fi
  fi
  sleep 2
done