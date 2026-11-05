import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export function validState(state) {
  return state && state.version === 2 && state.DB &&
    ['customers', 'suppliers', 'employees', 'accounts', 'promotions', 'orders', 'imports', 'invoices', 'logs'].every(k => Array.isArray(state.DB[k])) &&
    ['products', 'serials', 'adjustLog', 'CATS', 'BRANDS'].every(k => Array.isArray(state[k])) &&
    ['nextId', 'nextCat', 'nextBrand', 'nextModuleId'].every(k => Number.isSafeInteger(state[k]) && state[k] >= 0);
}

export function createApp({ store, checkDatabase }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', async (req, res) => {
    try {
      await checkDatabase();
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unavailable', message: 'Kiểm tra SQL Server, .env và chạy npm run db:init.' });
    }
  });
  app.get('/api/state', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await store.read());
  });
  app.put('/api/state', async (req, res) => {
    const { state, revision } = req.body || {};
    if (!validState(state) || !Number.isSafeInteger(revision) || revision < 0) {
      return res.status(400).json({ message: 'Dữ liệu quản trị không hợp lệ.' });
    }
    const nextRevision = await store.write(state, revision);
    if (nextRevision === null) return res.status(409).json({ message: 'Dữ liệu đã thay đổi ở cửa sổ khác. Sao lưu thay đổi rồi tải lại trang.' });
    res.json({ revision: nextRevision });
  });
  app.use('/api', (req, res) => res.status(404).json({ message: 'API không tồn tại.' }));
  app.get('/', (req, res) => res.redirect('/customer-staff/index3.html'));
  app.get('/admin', (req, res) => res.redirect('/admin-manager/index1.html'));
  app.get('/staff', (req, res) => res.redirect('/customer-staff/index1.html'));
  for (const folder of ['admin-manager', 'customer-staff']) {
    app.use(`/${folder}`, express.static(path.join(root, folder), { index: false, dotfiles: 'deny' }));
  }
  app.use((req, res) => res.status(404).send('Không tìm thấy trang.'));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON không hợp lệ.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Dữ liệu vượt quá 10 MB.' });
    console.error('API error:', error.code || error.name);
    res.status(503).json({ message: 'Không truy cập được SQL Server. Kiểm tra .env và chạy npm run db:init.' });
  });
  return app;
}
