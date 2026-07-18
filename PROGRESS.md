# System Design — Практическое изучение

Изучение 8 ключевых концепций System Design через практику: NestJS + Docker.
Под каждую концепцию — отдельный проект, воспроизведение проблемы, затем решение.

Источник: [8 Most Important System Design Concepts You Should Know](https://www.youtube.com/watch?v=BTjxUS_PylA)

---

## Прогресс

| # | Тема | Статус |
|---|------|--------|
| 1 | Read-Heavy System | ✅ Готово |
| 2 | High-Write Traffic | ✅ Готово |
| 3 | Single Point of Failure | ✅ Готово |
| 4 | High Availability | ✅ Готово |
| 5 | High Latency | ⬜ |
| 6 | Handling Large Files | ⬜ |
| 7 | Monitoring and Alerting | ⬜ |
| 8 | Slow Database Queries | ⬜ |

---

## 1. Read-Heavy System ✅

**Сценарий:** Новостной сайт — миллионы читателей, маленькая команда авторов. Scaling problem: mismatch между количеством reads и writes.

### Проблема

Каждый GET-запрос идёт напрямую в PostgreSQL. Под нагрузкой (1000 concurrent connections) база захлёбывается:
- Median latency: 6,248ms
- Avg Req/Sec: 28
- Timeouts: 2,000 из 4,000 запросов

Пагинация (LIMIT/OFFSET) не решает проблему — `findAndCount()` делает два SQL-запроса (SELECT + COUNT), что ещё хуже.

### Решение — Redis Cache

Добавили Redis как кэш-слой между API и PostgreSQL. Логика: проверяем Redis → если есть, отдаём → если нет, идём в БД и сохраняем в Redis с TTL 60 секунд.

**Результат с горячим кэшем:**
- Median latency: 522ms
- Avg Req/Sec: 1,784 (x64 рост)
- Timeouts: 0

### Что узнали

- **Cache stampede** — когда TTL протухает, все 1000 соединений одновременно летят в БД. Решение: lock на обновление (только один запрос идёт в БД, остальные ждут).
- **TTL** — баланс между свежестью данных и нагрузкой на БД. Короткий TTL = чаще ходим в БД. Длинный TTL = данные дольше устаревшие.
- **Pub/Sub** — вместо ожидания протухания TTL можно инвалидировать кэш по событию (журналист опубликовал статью → PUBLISH → все инстансы сбрасывают кэш). TTL остаётся как safety net.
- **RedisInsight** — GUI для мониторинга Redis (ключи, память, команды).
- **Вертикальное масштабирование** (bigger server) не решает корень проблемы — одни и те же данные перечитываются тысячи раз в секунду.

### Инструменты

- `autocannon` — нагрузочное тестирование (`npx autocannon -c 1000 -d 30 URL`)
- `RedisInsight` — мониторинг Redis (порт 5540)
- `redis-cli MONITOR` — наблюдение за командами Redis в реальном времени
- `redis-cli KEYS '*'` / `DBSIZE` — проверка содержимого кэша

### Стек

- NestJS + TypeORM + PostgreSQL + Redis
- Docker Compose (все сервисы)
- `@nestjs/cache-manager` + `cache-manager-redis-yet`

---

## 2. High-Write Traffic ✅

**Сценарий:** Система аналитики/логирования событий — тысячи событий в секунду, каждое нужно записать в БД.

### Проблема

Каждый POST-запрос делает INSERT напрямую в PostgreSQL. Под нагрузкой (20000 запросов, 1000 concurrent):
- RPS упирается в потолок (~766), при росте concurrency даже падает
- p99 latency: 2535ms
- **Запись убивает чтение** — простой SELECT count(*) деградирует с 63ms до 1162ms (connection pool забит)

### Решение A — Message Queue (RabbitMQ)

POST кидает событие в RabbitMQ → мгновенный ответ клиенту. Consumer читает из очереди и пишет в PostgreSQL **батчами** (по 100 штук или каждые 500ms).

**Важно:** без батчинга очередь делает хуже — consumer жадно читает из очереди и забивает БД ещё сильнее (Read p50 вырос до 9.6 секунд). Батчинг критичен.

**Результат (с батчингом):**
- RPS: 766 → 1880 (x2.5)
- Write p50: 734ms → 241ms
- Read max: 1162ms → 665ms — чтение перестало страдать

### Решение B — LSM-Tree DB (ClickHouse)

Замена PostgreSQL (B-Tree) на ClickHouse (LSM-Tree) — БД, оптимизированная под запись. Пишет в memtable, потом flush на диск (sequential I/O вместо random I/O).

**Сравнение на 5M строк в PostgreSQL:**

| | PostgreSQL + Queue | ClickHouse + Queue |
|---|---|---|
| Write RPS | 1741 | 2006 |
| Read baseline (count) | 724ms | 53ms (x14 быстрее) |
| Read p50 под нагрузкой | 378ms | 170ms |

Разница растёт с объёмом данных — B-Tree индексы дорожают, LSM-Tree стоимость вставки почти не растёт.

### Что узнали

- **RPS** — requests per second, пропускная способность
- **Latency** — задержка от отправки до ответа
- **Перцентили (p50/p95/p99)** — "500-й из 1000 запросов по скорости", показывают worst case лучше чем avg
- **Message Queue** — Redis (простая), RabbitMQ (роутинг), Kafka (streaming) — разные компромиссы
- **Батчинг** — вместо 20000 отдельных INSERT → 200 батчей по 100, кратно снижает нагрузку на БД
- **B-Tree vs LSM-Tree** — PostgreSQL обновляет индексы при вставке (random I/O), ClickHouse пишет в memtable (sequential I/O)
- **В production оба подхода комбинируются:** Client → Queue → Consumer → LSM-Tree DB

### Стек

- NestJS + TypeORM + PostgreSQL + RabbitMQ + ClickHouse
- Docker Compose (все сервисы)
- `@nestjs/microservices` + `amqplib` — интеграция с RabbitMQ
- `@clickhouse/client` — интеграция с ClickHouse
- Кастомный `load-test.js` — нагрузочное тестирование с замером read latency под нагрузкой

---

## 3. Single Point of Failure ✅

**Сценарий:** E-commerce платформа — каталог товаров, заказы, платежи. Одна БД, один сервер. БД упала → всё мертво, бизнес теряет деньги.

### Проблема

Все операции завязаны на одну PostgreSQL. При падении БД:
- 0/4 endpoints работают (каталог, заказы, платежи, покупка)
- Таймауты 3-8 секунд, потом 500 ошибки
- Ни поиск, ни покупки — полный отказ

### Решение — Replication + HAProxy + Auto-Failover

**1. PostgreSQL Streaming Replication (async)**
- Primary пишет в WAL (Write-Ahead Log), replica стримит WAL в реальном времени
- `wal_level=replica`, `max_wal_senders=3`, `hot_standby=on`
- `pg_basebackup -R` — копирует данные и создаёт `standby.signal` + `primary_conninfo`

**2. HAProxy — TCP load balancer**
- Сидит между API и базами, роутит трафик на текущий primary
- HTTP health-check (Python sidecar на порту 8008): `pg_is_in_recovery()` = `f` → 200 (primary), `t` → 503 (replica)
- Динамический роутинг: обе ноды равноправны, кто ответил 200 — получает трафик

**3. Failover Monitor**
- Каждые 2 секунды проверяет все ноды
- Primary упал → автоматически промоутит replica через `pg_promote()`
- Детектит split-brain (два primary одновременно)

**Результат после failover:**
- Primary убит → replica промоучена автоматически (~10-15 сек)
- 4/4 endpoints работают (reads + writes)
- Данные сохранены (async replication — возможна потеря последних мс транзакций)

### Что узнали

- **WAL (Write-Ahead Log)** — все изменения сначала в лог, потом на диск. Используется для crash recovery и replication
- **Async vs Sync replication** — async быстрее но может потерять данные при крэше; sync гарантирует но тормозит writes
- **hot_standby** — разрешает read-запросы на replica (без него replica только принимает WAL)
- **pg_is_in_recovery()** — `f` на primary, `t` на replica. Используется для health-check
- **pg_promote()** — переводит replica в primary (начинает принимать writes)
- **Split-brain** — два primary одновременно = данные расходятся. В production решается через distributed consensus (etcd + Patroni)
- **Connection pool** — при failover мёртвые TCP-соединения висят в pool, нужен `idleTimeoutMillis` для автоматического сброса
- **Database transaction** — атомарность операций (всё или ничего), но не решает availability — если БД целиком мертва, писать некуда
- **HAProxy health-check** — динамически определяет кто primary, роли могут меняться после failover

### Нерешённые проблемы

- **Автоматическая перестройка** старого primary в replica при возвращении (нужен Patroni / pg_auto_failover)
- **Split-brain окно** — несколько секунд между возвратом старого primary и детекцией
- **Connection pool drain** — первые запросы после failover могут получить ошибку

### Стек

- NestJS + TypeORM + PostgreSQL (primary + replica)
- HAProxy 2.9 — TCP load balancer с HTTP health-check
- Python health-check sidecar (pg_is_in_recovery)
- Bash failover-monitor (detect + promote + split-brain detection)
- Docker Compose (8 сервисов)

---

## 4. High Availability ✅

**Сценарий:** URL Shortener — два эндпоинта (POST /shorten, GET /:code). Система должна оставаться доступной при падении любого компонента — серверов приложения или БД.

### Архитектура

```
            ┌──────────┐
            │ HAProxy   │ :3000 (HTTP), :5432 (PG), :8404 (Stats)
            └─────┬────┘
       ┌──────────┼──────────┐
       ▼          ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐
  │ App 1  │ │ App 2  │ │ App 3  │   NestJS (roundrobin)
  └────────┘ └────────┘ └────────┘
                  │
            ┌─────┴─────┐
       ┌────────┐ ┌────────┐ ┌────────┐
       │Patroni │ │Patroni │ │Patroni │   PostgreSQL + Patroni
       │+ PG 1  │ │+ PG 2  │ │+ PG 3  │
       └────┬───┘ └────┬───┘ └────┬───┘
            └──────────┼──────────┘
                  ┌────┴────┐
                  │  etcd   │   Distributed consensus
                  └─────────┘
```

### Решение — Patroni + etcd + HAProxy

**1. Patroni — автоматический failover PostgreSQL**
- Обёртка вокруг PostgreSQL, управляет кластером через etcd
- Автоматический leader election, promotion реплики, replication setup
- REST API на порту 8008: `GET /primary` → 200 на leader, 503 на replica
- `post_bootstrap.sh` — создание пользователей и БД при инициализации кластера

**2. etcd — distributed consensus store**
- Хранит состояние кластера: кто leader, кто replica
- Patroni использует leader lock в etcd — только один узел может быть primary
- Решает split-brain: без доступа к etcd узел не может стать leader

**3. HAProxy — двойной балансер**
- HTTP frontend (:3000) → roundrobin по app-серверам, health check `GET /health`
- TCP frontend (:5432) → роутинг на PG primary через `GET /primary` на порту 8008 Patroni
- Stats UI на :8404 — визуализация состояния всех бэкендов
- DNS resolvers для Docker — переоткрытие DNS при stop/start контейнеров

**4. NestJS — 3 экземпляра за балансером**
- `server` поле в ответах для визуализации roundrobin
- `connectionTimeoutMillis: 5000` — таймаут на подключение к БД через балансер
- `retryAttempts: 30, retryDelay: 3000` — переподключение при старте до готовности БД

### Тесты Failover

**App failover:**
- `docker compose stop app1` → HAProxy убирает узел, трафик на app2/app3
- `docker compose start app1` → HAProxy возвращает узел в ротацию
- Даунтайм: 0 (кроме запросов попавших на мёртвый узел до health check)

**DB failover (Patroni):**
- `docker compose stop pg3` (primary) → Patroni автоматически промоутит pg2
- pg1 переключается на нового leader, HAProxy перенаправляет трафик
- `docker compose start pg3` → возвращается как replica (не как leader!)
- Даунтайм: ~15-30 секунд (TTL=30, leader election, HAProxy health check)

### Что узнали

- **Patroni** — production-стандарт для PostgreSQL HA. Автоматический failover, promotion, replication — всё из коробки. В отличие от ручного failover из темы 3, здесь zero manual intervention
- **etcd** — distributed key-value store для consensus. Patroni хранит в нём leader lock — гарантия от split-brain
- **Leader-based replication** — zero downtime failover невозможен. Суть HA — не "0 секунд даунтайма", а "система сама восстанавливается за секунды, а не часы"
- **TCP vs HTTP health checks** — HAProxy проверяет app-серверы по HTTP (`GET /health`), а PG — через Patroni REST API (`GET /primary` на порту 8008)
- **connectionTimeoutMillis** — must-have при подключении через балансер. Без него TCP handshake проходит (HAProxy принял), но PG за ним не готов — соединение висит бесконечно, retry не срабатывает
- **Docker DNS caching** — HAProxy резолвит DNS при старте и кэширует IP. После stop/start контейнер получает новый IP → нужна секция `resolvers` с Docker DNS (127.0.0.11)
- **Patroni v4 breaking change** — `bootstrap.users` больше не поддерживается, нужен `post_bootstrap` скрипт
- **`${VAR}` в YAML** — Patroni не делает shell expansion, нужен entrypoint-скрипт с `sed` для подстановки переменных
- **Permissions в Docker** — `USER postgres` + правильный `chown` для data directory, иначе initdb/pg_basebackup падают

### Нерешённые проблемы

- **HAProxy — единственная точка отказа** — в production нужен keepalived/VRRP для HA самого балансера
- **etcd — один узел** — в production нужен кластер из 3+ узлов для отказоустойчивости consensus
- **Async replication** — при failover возможна потеря последних транзакций (не подтверждённых на replica)

### Стек

- NestJS + TypeORM + PostgreSQL (3 узла)
- Patroni — автоматический failover и replication management
- etcd v3.5 — distributed consensus store
- HAProxy 2.9 — HTTP/TCP load balancer с DNS resolvers
- Docker Compose (8 сервисов)
