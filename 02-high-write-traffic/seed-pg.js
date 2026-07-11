const BATCH_SIZE = 10000;
const TOTAL = 5_000_000;

async function seed() {
  const { Client } = require('pg');
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'eventsdb',
  });
  await client.connect();

  console.log(`Засеиваем ${TOTAL} строк в PostgreSQL...`);

  for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
    const values = [];
    const params = [];
    for (let j = 0; j < BATCH_SIZE && i + j < TOTAL; j++) {
      const idx = i + j;
      const offset = params.length;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
      params.push(`page_view`, JSON.stringify({ url: `/page/${idx}` }), `user_${idx % 1000}`);
    }
    await client.query(
      `INSERT INTO events (type, payload, "userId") VALUES ${values.join(',')}`,
      params,
    );
    const progress = Math.round(((i + BATCH_SIZE) / TOTAL) * 100);
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, TOTAL).toLocaleString()} / ${TOTAL.toLocaleString()} (${progress}%)`);
  }

  console.log('\nГотово!');
  const res = await client.query('SELECT count(*) FROM events');
  console.log(`Всего строк: ${res.rows[0].count}`);
  await client.end();
}

seed().catch(console.error);