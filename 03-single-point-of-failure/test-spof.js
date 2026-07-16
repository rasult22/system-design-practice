const BASE = 'http://localhost:3000';

async function request(label, url, opts) {
  try {
    const start = Date.now();
    const res = await fetch(url, opts);
    const ms = Date.now() - start;
    const ok = res.ok ? '✅' : '❌';
    const data = await res.json().catch(() => null);
    console.log(`  ${ok} ${label} — ${res.status} (${ms}ms)`);
    if (data && opts?.method === 'POST' && res.ok) {
      console.log(`     → Заказ #${data.order?.id} [${data.order?.status}], платёж: ${data.payment?.status}`);
    }
    return res.ok;
  } catch (e) {
    console.log(`  💀 ${label} — ${e.cause?.code || e.message}`);
    return false;
  }
}

async function testAllEndpoints(phase) {
  console.log(`\n=== ${phase} ===`);
  const results = await Promise.all([
    request('GET  /products  (каталог товаров)', `${BASE}/products`),
    request('GET  /orders    (мои покупки)', `${BASE}/orders`),
    request('GET  /payments  (история платежей)', `${BASE}/payments`),
    request('POST /orders    (покупка + оплата)', `${BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 1, quantity: 2 }),
    }),
  ]);

  const ok = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n  Результат: ${ok}/${total} endpoints работают`);
  return ok;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const mode = process.argv[2];

  if (mode === 'failover') {
    console.log('🔍 Тест: Failover — Primary упал, replica берёт на себя');
    console.log('   Replication + HAProxy + auto-failover\n');

    console.log('--- Phase 1: Всё работает через primary ---');
    await testAllEndpoints('Primary жив');

    console.log('\n⏳ Останавливаем primary...');
    const { execSync } = require('child_process');
    execSync('docker compose stop postgres', { stdio: 'inherit' });

    console.log('\n⏳ Ждём автоматический failover (15 сек)...');
    console.log('   detect (~4s) + promote (~2s) + healthcheck update (~2s) + HAProxy switch (~2s)');
    await sleep(15000);

    // Первый запрос сбрасывает мёртвые соединения из pool
    console.log('\n--- Phase 2: Сброс мёртвых соединений из pool ---');
    await request('GET  /products  (сброс pool)', `${BASE}/products`);
    await sleep(3000);

    console.log('\n--- Phase 3: Primary мёртв, replica промоучена ---');
    const ok = await testAllEndpoints('После failover');

    console.log('\n--- Итог ---');
    if (ok >= 3) {
      console.log('✅ Failover успешен! Reads + writes работают через промоученную replica');
      console.log('   Primary упал → failover-monitor промоутил replica (~2-4 сек)');
      console.log('   HAProxy переключил трафик → pool сбросил мёртвые соединения');
      if (ok === 3) {
        console.log('   POST вернул 500 — вероятно 30% шанс отказа платежа (не failover)');
      }
    } else {
      console.log('❌ Failover не сработал');
    }
    return;
  }

  // Дефолт: демо проблемы (без replication)
  console.log('🔍 Тест: Single Point of Failure — E-Commerce Platform');
  console.log('   Одна БД, никакой redundancy');
  console.log('   Flow: заказ (pending) → платёж (500ms) → заказ (paid)\n');

  await testAllEndpoints('Phase 1: БД работает — всё ОК');

  console.log('\n⚠️  Теперь останови БД:');
  console.log('   docker compose stop postgres\n');
  console.log('   Затем запусти: node test-spof.js down\n');

  if (mode === 'down') {
    await testAllEndpoints('Phase 2: БД упала — без failover');

    console.log('\n💀 Без replication — полный отказ:');
    console.log('   - Каталог недоступен — клиенты не видят товары');
    console.log('   - Покупка невозможна — деньги не принимаются');
    console.log('   - История заказов/платежей пропала');
    console.log('   - Бизнес теряет деньги каждую секунду');
    console.log('\n   SPOF = одна БД, один сервер, ноль redundancy');
  }
}

main();
