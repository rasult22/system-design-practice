const TOTAL = 20000;
const CONCURRENCY = 1000;
const URL = 'http://localhost:3000/events';
const HEALTH_URL = 'http://localhost:3000/events/count';
const HEALTH_INTERVAL = 500;

async function sendEvent(i) {
  const body = JSON.stringify({
    type: 'page_view',
    payload: { url: `/page/${i}`, timestamp: Date.now() },
    userId: `user_${i % 100}`,
  });

  const start = performance.now();
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const duration = performance.now() - start;
  return { status: res.status, duration };
}

async function probeHealth(readings) {
  const start = performance.now();
  try {
    const res = await fetch(HEALTH_URL);
    const duration = performance.now() - start;
    const data = await res.json();
    readings.push({ time: new Date().toISOString().slice(11, 19), duration, total: data.total });
  } catch {
    const duration = performance.now() - start;
    readings.push({ time: new Date().toISOString().slice(11, 19), duration, error: true });
  }
}

async function run() {
  console.log(`\nНагрузочный тест: ${TOTAL} запросов, concurrency=${CONCURRENCY}`);
  console.log(`Параллельно замеряем GET /events/count каждые ${HEALTH_INTERVAL}ms\n`);

  // замер без нагрузки
  const beforeStart = performance.now();
  await fetch(HEALTH_URL);
  const baseline = performance.now() - beforeStart;
  console.log(`Baseline GET /events/count (без нагрузки): ${baseline.toFixed(1)}ms\n`);

  const results = [];
  const failed = [];
  const healthReadings = [];

  const healthTimer = setInterval(() => probeHealth(healthReadings), HEALTH_INTERVAL);
  const globalStart = performance.now();

  for (let batch = 0; batch < TOTAL; batch += CONCURRENCY) {
    const size = Math.min(CONCURRENCY, TOTAL - batch);
    const promises = Array.from({ length: size }, (_, j) => sendEvent(batch + j));
    const batchResults = await Promise.all(promises);

    for (const r of batchResults) {
      if (r.status >= 200 && r.status < 300) {
        results.push(r.duration);
      } else {
        failed.push(r);
      }
    }
  }

  const totalTime = performance.now() - globalStart;
  clearInterval(healthTimer);
  await probeHealth(healthReadings);

  results.sort((a, b) => a - b);

  console.log('=== WRITE (POST /events) ===');
  console.log(`Успешно: ${results.length} / ${TOTAL}`);
  console.log(`Ошибок:  ${failed.length}`);
  console.log(`Общее время: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`RPS:     ${(results.length / (totalTime / 1000)).toFixed(0)}`);
  console.log(`\nLatency (ms):`);
  console.log(`  min:  ${results[0]?.toFixed(1)}`);
  console.log(`  p50:  ${results[Math.floor(results.length * 0.5)]?.toFixed(1)}`);
  console.log(`  p95:  ${results[Math.floor(results.length * 0.95)]?.toFixed(1)}`);
  console.log(`  p99:  ${results[Math.floor(results.length * 0.99)]?.toFixed(1)}`);
  console.log(`  max:  ${results[results.length - 1]?.toFixed(1)}`);

  console.log(`\n=== READ (GET /events/count) во время нагрузки ===`);
  console.log(`Baseline (без нагрузки): ${baseline.toFixed(1)}ms`);
  console.log(`Замеров: ${healthReadings.length}\n`);

  const healthDurations = healthReadings.map(r => r.duration).sort((a, b) => a - b);
  const errors = healthReadings.filter(r => r.error).length;

  console.log(`  min:  ${healthDurations[0]?.toFixed(1)}ms`);
  console.log(`  p50:  ${healthDurations[Math.floor(healthDurations.length * 0.5)]?.toFixed(1)}ms`);
  console.log(`  max:  ${healthDurations[healthDurations.length - 1]?.toFixed(1)}ms`);
  console.log(`  ошибок: ${errors}`);
  console.log(`\nПо времени:`);
  for (const r of healthReadings) {
    const bar = '█'.repeat(Math.min(50, Math.round(r.duration / 20)));
    const status = r.error ? 'FAIL' : `${r.duration.toFixed(0)}ms`;
    console.log(`  ${r.time}  ${bar} ${status}`);
  }
}

run().catch(console.error);
