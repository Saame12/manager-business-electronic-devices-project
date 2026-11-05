import { createApp } from './app.js';
import { pool, stateStore, checkDatabase } from './db.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const app = createApp({ store: stateStore, checkDatabase });
const server = app.listen(port, host, () => {
  console.log(`PC Shop: http://${host}:${port}`);
  console.log(`Quản trị: http://${host}:${port}/admin`);
  console.log(`Nhân viên: http://${host}:${port}/staff`);
});
server.on('error', error => {
  console.error(`Không mở được server (${error.code}). Kiểm tra PORT trong .env.`);
  process.exitCode = 1;
  pool.close();
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(async () => { await pool.close(); process.exit(0); }));
}
