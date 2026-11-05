import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.js';

async function check() {
  // Isolate every run from the application's database and data.
  const database = `pc_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  process.env.DB_NAME = database;
  const { createPool, pool, schema, stateStore, checkDatabase } = await import('../server/db.js');
  const master = createPool('master');
  let server;
  let created = false;
  try {
    await master.connect();
    created = true;
    const create = master.request();
    create.timeout = 60000;
    await create.query(`CREATE DATABASE [${database}]`);
    console.log('Created temporary database');
    await pool.connect();
    console.log('Connected to temporary database');
    await pool.request().query(schema);
    await pool.request().query(schema); // Initialization is repeatable.
    const app = createApp({ store: stateStore, checkDatabase });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const put = (state, revision) => fetch(`${base}/api/state`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, revision })
    });
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/state`)).json(), { state: null, revision: 0 });
    assert.equal((await put({}, 0)).status, 400);
    const state = {
      version: 2,
      DB: Object.fromEntries(['customers', 'suppliers', 'employees', 'accounts', 'promotions', 'orders', 'imports', 'invoices', 'logs'].map(key => [key, []])),
      products: [{ name: "Máy tính tiếng Việt 🖥️ ' ; --" }],
      serials: [], adjustLog: [], CATS: [], BRANDS: [],
      nextId: 1, nextCat: 1, nextBrand: 1, nextModuleId: 1
    };
    assert.deepEqual(await (await put(state, 0)).json(), { revision: 1 });
    assert.equal((await put(state, 0)).status, 409);
    assert.deepEqual(await (await fetch(`${base}/api/state`)).json(), { state, revision: 1 });
    const results = await Promise.all([put(state, 1), put(state, 1)]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    assert.deepEqual(await stateStore.read(), { state, revision: 2 });
    assert.equal((await fetch(`${base}/api/missing`)).status, 404);
    await pool.request().query('DROP TABLE dbo.app_state');
    assert.equal((await fetch(`${base}/api/health`)).status, 503);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.close();
    if (created) await master.request().query(`
      ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${database}];`);
    await master.close();
  }
}
await check();
console.log('SQL Server integration checks passed.');

