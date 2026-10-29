import { Client } from 'pg';

describe('PostgreSQL integration', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      host: process.env.TEST_DATABASE_HOST ?? '127.0.0.1',
      port: Number(process.env.TEST_DATABASE_PORT ?? 5432),
      user: process.env.TEST_DATABASE_USER,
      password: process.env.TEST_DATABASE_PASSWORD,
      database: process.env.TEST_DATABASE_NAME,
      connectionTimeoutMillis: 5000,
    });

    await client.connect();
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('connects to PostgreSQL and executes a query', async () => {
    const result = await client.query(
      'SELECT current_database() AS database_name, 1 + 1 AS result',
    );

    expect(result.rows[0].database_name).toBe(
      process.env.TEST_DATABASE_NAME,
    );
    expect(result.rows[0].result).toBe(2);
  });
});
