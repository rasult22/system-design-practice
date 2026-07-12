#!/bin/bash
set -e

# Ждем пока primary будет доступен
until pg_isready -h postgres -U admin; do
  echo "Waiting for primary..."
  sleep 1
done

# Если standby.signal уже есть - replica уже настроена, просто запускаем
if [ -f /var/lib/postgresql/data/standby.signal ]; then
  exec postgres -c hot_standby=on
fi


# Первый запуск: копируем данные с primary
rm -rf /var/lib/postgresql/data/*
chmod 700 /var/lib/postgresql/data

pg_basebackup -h postgres -U admin -D /var/lib/postgresql/data -Fp -Xs -R

# Запускаем postgres как replica
exec postgres -c hot_standby=on