/* SQL Server persistence for the existing administration UI. */
window.shopPersistence = (() => {
  let revision = 0, pending = null, running = false, blocked = false;
  let lastSaved = null;
  const note = message => { document.getElementById('storageNote').textContent = message; };
  async function request(options) {
    const response = await fetch('/api/state', { ...options, signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Không kết nối được SQL Server.');
    return data;
  }
  async function flush() {
    if (running || blocked || !pending) return;
    running = true;
    while (pending && !blocked) {
      const value = pending;
      pending = null;
      try {
        const result = await request({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: JSON.parse(value), revision }) });
        revision = result.revision;
        lastSaved = value;
        note(pending ? 'Đang lưu SQL Server…' : 'Đã lưu dữ liệu quản trị vào SQL Server.');
      } catch (error) {
        blocked = true;
        note('Chưa lưu SQL Server: ' + error.message + ' Bản sao vẫn ở trình duyệt; hãy sao lưu trước khi tải lại.');
      }
    }
    running = false;
  }
  window.addEventListener('beforeunload', event => {
    if (running || pending || blocked) { event.preventDefault(); event.returnValue = ''; }
  });
  return {
    async load() {
      const result = await request();
      revision = result.revision;
      lastSaved = result.state ? JSON.stringify(result.state) : null;
      return result.state;
    },
    save(state) {
      const value = JSON.stringify(state);
      if (blocked || value === lastSaved && !running) return;
      pending = value;
      note('Đang lưu SQL Server…');
      void flush();
    }
  };
})();
