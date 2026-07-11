# System Design — Практическое изучение

Изучение 8 ключевых концепций System Design через практику: NestJS + Docker.
Под каждую концепцию — отдельный проект, воспроизведение проблемы, затем решение.

Источник: [8 Most Important System Design Concepts You Should Know](https://www.youtube.com/watch?v=BTjxUS_PylA)

---

## Прогресс

| # | Тема | Статус |
|---|------|--------|
| 1 | Read-Heavy System | ✅ Готово |
| 2 | High-Write Traffic | ⬜ |
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
