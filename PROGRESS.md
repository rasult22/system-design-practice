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
| 3 | Single Point of Failure | ⬜ |
| 4 | High Availability | ⬜ |
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
