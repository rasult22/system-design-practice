import { DataSource } from 'typeorm';
import { Article } from './articles/article.entity';

const categories = ['politics', 'tech', 'sports', 'science', 'entertainment'];

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'newsdb',
    entities: [Article],
    synchronize: true,
  });

  await ds.initialize();
  const repo = ds.getRepository(Article);

  const count = await repo.count();
  if (count > 0) {
    console.log(`DB already has ${count} articles, skipping seed.`);
    await ds.destroy();
    return;
  }

  console.log('Seeding 10,000 articles...');
  const batchSize = 500;
  for (let i = 0; i < 10000; i += batchSize) {
    const batch: Partial<Article>[] = [];
    for (let j = 0; j < batchSize; j++) {
      const n = i + j;
      batch.push({
        title: `Breaking News #${n}: Important Event Happened Today`,
        content: `This is a detailed article #${n}. `.repeat(50),
        author: `journalist_${n % 10}`,
        category: categories[n % categories.length],
        views: Math.floor(Math.random() * 100000),
      });
    }
    await repo.save(batch);
  }

  console.log('Seeded 10,000 articles.');
  await ds.destroy();
}

seed().catch(console.error);
