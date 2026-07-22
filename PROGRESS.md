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
| 5 | High Latency | ⏭ Пропущена (покрыта темами 1-2) |
| 6 | Handling Large Files | ✅ Готово |
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

---

## 5. High Latency ⏭

Пропущена — ключевые приёмы (кэширование, очереди, connection pooling) уже покрыты в темах 1 и 2. Параллелизация (`Promise.all`) слишком тривиальна для отдельного проекта. CDN и edge computing — инфраструктура облачных провайдеров, локально не воспроизвести.

---

## 6. Handling Large Files ✅

**Сценарий:** Файлообменник — загрузил файл → получил ссылку → скачал. Загрузка больших файлов (500MB–4GB) — это риск положить сервер, если не учитывать потребление памяти и I/O.

### Проблема — наивный подход (buffer в памяти)

Multer по умолчанию использует `memoryStorage` — **весь файл целиком загружается в RAM** как `Buffer`. Потом `writeFileSync` блокирует event loop при записи.

**Результат k6 (5 VUs, файл 500MB):**
- RAM: **~3 ГБ** (на один сервер!)
- p95 latency: **10.4 сек**
- Итераций: 10
- После теста RAM не возвращается — V8/GC освобождает память лениво

Один запрос = 1ГБ RAM. 10 пользователей = 10ГБ. На сервере с 2ГБ RAM — OOM crash.

### Решение 1 — Streaming (запись на диск)

Убираем Multer. Request body (`req`) — это уже readable stream, пайпим его напрямую в файл через `pipeline(req, createWriteStream(path))`. Файл **не накапливается в памяти**.

**Результат k6:**
- RAM: **~240 МБ** (в 12 раз меньше)
- p95 latency: 8 сек
- Итераций: 12

RAM больше не зависит от размера файла. Но latency ещё высокая — **I/O contention**: 5 параллельных записей 500MB файлов конкурируют за один физический диск (пропускная способность I/O делится между процессами).

### Решение 2 — MinIO (S3-совместимый object storage)

Вместо локального диска — MinIO (S3 API, работает в Docker). Стриминг `req → S3 PutObject`. Скачивание через **presigned URL** — клиент получает временную ссылку и качает напрямую из MinIO, сервер не проксирует файл через себя.

**Результат k6:**
- RAM: **~100-200 МБ**
- p95 latency: **223 мс** (в 46 раз быстрее наивного подхода!)
- Итераций: **64** (в 6 раз больше)

Почему быстрее диска: MinIO буферизует данные, оптимизирует I/O, возвращает ответ до полного fsync, пишет последовательно без конкуренции с Node.js.

**Масштабируемость:** MinIO на отдельном сервере → несколько нод бэкенда могут параллельно загружать файлы без конкуренции за диск.

### Решение 3 — Chunked (multipart) upload с докачкой

Стриминг — один непрерывный поток. Обрыв на 80% = загружай заново. Chunked upload решает это:

1. Клиент нарезает файл на части (5MB каждая)
2. `POST /multipart/start` → сервер возвращает `uploadId`
3. Каждый чанк загружается отдельным запросом (`POST /multipart/:filename/:uploadId/:partNumber`)
4. `POST /multipart/.../complete` → MinIO собирает файл из частей

**Докачка при обрыве:**
- `filename` и `uploadId` сохраняются в `localStorage`
- При повторной загрузке — `GET /multipart/.../parts` спрашивает MinIO какие чанки уже есть
- Пропускает загруженные, досылает только недостающие

S3/MinIO поддерживают multipart upload нативно — не нужно склеивать файлы вручную.

### Presigned URL

Для скачивания сервер генерирует **presigned URL** — временная ссылка (1 час) с криптографической подписью. Клиент качает файл напрямую из MinIO, минуя бэкенд. Файл приватный, но доступен по этой конкретной ссылке до истечения срока.

### Что узнали

- **Buffer vs Stream** — `file.buffer` = весь файл в RAM, `pipeline(req, writeStream)` = файл проходит потоком без накопления. Разница в потреблении памяти: 3ГБ vs 200МБ
- **I/O contention** — параллельные записи на один диск делят пропускную способность, latency растёт. Object storage решает это
- **Object Storage (MinIO/S3)** — файлы хранятся отдельно от бэкенда, можно масштабировать независимо. S3 API — де-факто стандарт
- **Streaming vs Chunked upload** — стриминг: один непрерывный поток (обрыв = заново). Чанки: файл нарезан на части, каждая загружается отдельно (обрыв = докачка с последнего чанка)
- **Presigned URL** — клиент качает напрямую из хранилища, бэкенд не проксирует трафик. Ссылка временная и подписанная
- **Range requests (HTTP)** — для скачивания аналогичная концепция: заголовок `Range: bytes=1000000-` позволяет докачивать файл с места обрыва. Используется браузерами и менеджерами загрузок
- **V8 Garbage Collector** — не отдаёт память ОС сразу после освобождения, держит "про запас". Поэтому после наивной загрузки процесс выглядит раздутым даже когда Buffer уже не используется
- **S3 Multipart Upload API** — `CreateMultipartUpload` → `UploadPart` (с `ContentLength`!) → `CompleteMultipartUpload`. ETag чувствителен к регистру (`ETag`, не `Etag`)

### Стек

- NestJS (streaming, без Multer для больших файлов)
- MinIO — S3-совместимый object storage (Docker)
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- k6 — нагрузочное тестирование
- HTML/JS фронтенд с chunked upload и прогресс-баром
