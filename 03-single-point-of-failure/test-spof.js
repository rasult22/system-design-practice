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

async function main() {
  console.log('🔍 Тест: Single Point of Failure — E-Commerce Platform');
  console.log('   Одна БД, никакой redundancy');
  console.log('   Flow: заказ (pending) → платёж (500ms) → заказ (paid)\n');

  // Phase 1: всё работает
  await testAllEndpoints('Phase 1: БД работает — всё ОК');

  console.log('\n⚠️  Теперь останови БД:');
  console.log('   docker compose stop postgres\n');
  console.log('   Затем запусти: node test-spof.js down\n');

  if (process.argv[2] === 'down') {
    // Phase 2: БД упала
    await testAllEndpoints('Phase 2: БД упала — ПОЛНЫЙ ОТКАЗ');

    console.log('\n💀 Все операции мертвы:');
    console.log('   - Каталог недоступен — клиенты не видят товары');
    console.log('   - Покупка невозможна — деньги не принимаются');
    console.log('   - История заказов/платежей пропала');
    console.log('   - Бизнес теряет деньги каждую секунду');
    console.log('\n   SPOF = одна БД, один сервер, ноль redundancy');
  }
}

main();
