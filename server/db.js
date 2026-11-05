// Windows authentication uses the current Windows account.
const trustedConnection = process.env.DB_AUTH !== 'sql';
const { default: sql } = await import(trustedConnection ? 'mssql/msnodesqlv8.js' : 'mssql');
export const dbName = process.env.DB_NAME || 'pc_shop';
if (!/^[a-zA-Z0-9_]+$/.test(dbName) || dbName.length > 128) throw new Error('DB_NAME không hợp lệ.');
export const connectionOptions = {
  server: process.env.DB_HOST || 'localhost\\SQLEXPRESS',
  ...(process.env.DB_PORT ? { port: Number(process.env.DB_PORT) } : {}),
  ...(trustedConnection ? { driver: process.env.DB_DRIVER || 'ODBC Driver 18 for SQL Server' } : {
    user: process.env.DB_USER, password: process.env.DB_PASSWORD
  }),
  options: {
    trustedConnection,
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
  },
  connectionTimeout: 5000, requestTimeout: 15000,
  pool: { min: 0, max: 5, idleTimeoutMillis: 30000 }
};
export function createPool(database = dbName) {
  // mssql's native adapter does not forward options.trustServerCertificate.
  // Pass ODBC properties explicitly, and keep named instances free of a default port.
  const odbcValue = value => `{${String(value).replaceAll('}', '}}')}}`;
  const server = connectionOptions.server + (process.env.DB_PORT ? `,${connectionOptions.port}` : '');
  const nativeOptions = trustedConnection ? {
    connectionString: [
      `Driver=${odbcValue(connectionOptions.driver)}`,
      `Server=${odbcValue(server)}`,
      `Database=${odbcValue(database)}`,
      'Trusted_Connection=Yes',
      `Encrypt=${connectionOptions.options.encrypt ? 'Yes' : 'No'}`,
      `TrustServerCertificate=${connectionOptions.options.trustServerCertificate ? 'Yes' : 'No'}`
    ].join(';') + ';'
  } : {};
  const connection = new sql.ConnectionPool({ ...connectionOptions, database, ...nativeOptions });
  connection.on('error', error => console.error('SQL Server pool:', error.code || error.name));
  return connection;
}
export const pool = createPool();
export const schema = `IF OBJECT_ID(N'dbo.app_state', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_state (
    id TINYINT NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload) = 1),
    revision INT NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END`;
export async function checkDatabase() {
  await pool.connect();
  await pool.request().query('SELECT TOP (1) id FROM dbo.app_state');
}
export const stateStore = {
  async read() {
    await pool.connect();
    const { recordset } = await pool.request().query('SELECT payload, revision FROM dbo.app_state WHERE id = 1');
    if (!recordset.length) return { state: null, revision: 0 };
    return { state: JSON.parse(recordset[0].payload), revision: recordset[0].revision };
  },
  async write(state, revision) {
    await pool.connect();
    const request = pool.request().input('payload', sql.NVarChar(sql.MAX), JSON.stringify(state));
    if (revision === 0) {
      try {
        await request.query('INSERT INTO dbo.app_state (id, payload, revision) VALUES (1, @payload, 1)');
        return 1;
      } catch (error) {
        if ([2601, 2627].includes(error.number)) return null;
        throw error;
      }
    }
    const result = await request.input('revision', sql.Int, revision).query(`
      UPDATE dbo.app_state SET payload = @payload, revision = revision + 1,
        updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.revision
      WHERE id = 1 AND revision = @revision`);
    return result.recordset[0]?.revision ?? null;
  }
};
