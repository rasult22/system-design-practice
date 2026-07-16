#!/bin/bash

NODES=("postgres" "postgres_replica")
CURRENT_PRIMARY=""

echo "=== Failover Monitor Started ==="

while true; do
  # Находим кто сейчас primary
  NEW_PRIMARY=""
  for node in "${NODES[@]}"; do
    if pg_isready -h "$node" -U admin -d ecommerce -q 2>/dev/null; then
      IS_REPLICA=$(psql -h "$node" -U admin -d ecommerce -tAc "SELECT pg_is_in_recovery();" 2>/dev/null)
      if [ "$IS_REPLICA" = "f" ]; then
        NEW_PRIMARY="$node"
      fi
    fi
  done

  if [ -n "$NEW_PRIMARY" ] && [ "$NEW_PRIMARY" != "$CURRENT_PRIMARY" ]; then
    echo "[$(date)] Primary changed: $CURRENT_PRIMARY -> $NEW_PRIMARY"
    CURRENT_PRIMARY="$NEW_PRIMARY"
  fi

  # Если нет primary — промоутим первую живую replica
  if [ -z "$NEW_PRIMARY" ]; then
    echo "[$(date)] No primary detected! Looking for replica to promote..."
    for node in "${NODES[@]}"; do
      if pg_isready -h "$node" -U admin -d ecommerce -q 2>/dev/null; then
        IS_REPLICA=$(psql -h "$node" -U admin -d ecommerce -tAc "SELECT pg_is_in_recovery();" 2>/dev/null)
        if [ "$IS_REPLICA" = "t" ]; then
          echo "[$(date)] Promoting $node..."
          psql -h "$node" -U admin -d ecommerce -c "SELECT pg_promote();"
          echo "[$(date)] $node promoted to primary!"
          CURRENT_PRIMARY="$node"
          break
        fi
      fi
    done
  fi

  # Если primary есть — проверяем не вернулся ли старый primary (split-brain)
  if [ -n "$CURRENT_PRIMARY" ]; then
    for node in "${NODES[@]}"; do
      if [ "$node" != "$CURRENT_PRIMARY" ]; then
        if pg_isready -h "$node" -U admin -d ecommerce -q 2>/dev/null; then
          IS_REPLICA=$(psql -h "$node" -U admin -d ecommerce -tAc "SELECT pg_is_in_recovery();" 2>/dev/null)
          if [ "$IS_REPLICA" = "f" ]; then
            echo "[$(date)] SPLIT-BRAIN DETECTED! $node is also primary!"
            echo "[$(date)] Shutting down $node and rebuilding as replica of $CURRENT_PRIMARY..."
            # Останавливаем старый primary через pg_ctl (если доступен)
            # В Docker — посылаем сигнал через SQL
            psql -h "$node" -U admin -d ecommerce -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid();" 2>/dev/null
            echo "[$(date)] WARNING: $node needs manual rebuild as replica"
            echo "[$(date)] Run: docker compose stop <service> && rebuild as replica of $CURRENT_PRIMARY"
          fi
        fi
      fi
    done
  fi

  sleep 2
done
