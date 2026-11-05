import { createPool, dbName, schema, pool } from './db.js';
const master = createPool('master');
try {
  await master.connect();
  await master.request().query(`IF DB_ID(N'${dbName}') IS NULL CREATE DATABASE [${dbName}]`);
  await pool.connect();
  await pool.request().query(schema);
  console.log(`Đã khởi tạo SQL Server database ${dbName}. Dữ liệu hiện có được giữ nguyên.`);
} catch (error) {
  console.error(`Không khởi tạo được SQL Server (${error.code || 'ERROR'}): ${error.message}`);
  console.error('Kiểm tra dịch vụ SQL Server và cấu hình .env.');
  process.exitCode = 1;
} finally {
  await master.close();
  await pool.close();
}
