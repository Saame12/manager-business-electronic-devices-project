# PC Shop — Node.js và SQL Server

Yêu cầu: Node.js 22.9 trở lên, SQL Server và npm. Cấu hình hiện tại dùng
SQL Server Express `localhost\SQLEXPRESS`, Windows Authentication và
Microsoft ODBC Driver 18 for SQL Server.

## Khởi động

```powershell
npm install
# Chỉ sao chép khi chưa có .env:
Copy-Item .env.example .env
npm run db:init
npm start
```

`db:init` tạo database `pc_shop` và bảng `dbo.app_state` nếu chưa tồn tại,
giữ nguyên dữ liệu hiện có. Tài khoản kết nối cần quyền tạo database trong
lần khởi tạo đầu tiên.

- Khách hàng: http://127.0.0.1:3001/
- Quản trị: http://127.0.0.1:3001/admin
- Nhân viên: http://127.0.0.1:3001/staff
- Kiểm tra kết nối database: http://127.0.0.1:3001/api/health

Chạy `npm run dev` để tự khởi động lại khi sửa backend; nhấn Ctrl+C để dừng.

## Cấu hình database

Sửa `.env` để chọn instance khác, chẳng hạn `DB_HOST=localhost\SQLEXPRESS01`.
Với named instance, để trống `DB_PORT`. Với máy chủ TCP, dùng tên máy chủ
trong `DB_HOST` và cổng trong `DB_PORT` (thường là `1433`).

Để dùng SQL Server Authentication, đặt `DB_AUTH=sql`, `DB_USER` và
`DB_PASSWORD`. Chế độ Windows sử dụng tài khoản chạy Node.js và driver ODBC;
chế độ SQL sử dụng driver Tedious đi kèm `mssql`.

`DB_TRUST_SERVER_CERTIFICATE=true` dành cho SQL Server cục bộ có chứng chỉ
tự ký. Khi dùng máy chủ có chứng chỉ hợp lệ, đặt giá trị này thành `false`.

Phần quản trị lưu trạng thái JSON Unicode vào `dbo.app_state`, kèm số phiên
bản để tránh ghi đè thay đổi từ cửa sổ khác. Các màn hình khách hàng và nhân
viên được phục vụ từ giao diện hiện có. API hiện chưa có xác thực; cấu hình
mặc định chỉ mở trên máy cục bộ `127.0.0.1`.

## Kiểm tra tích hợp SQL Server

```powershell
npm run test:db
```

Bài kiểm tra tạo một database tạm có tên ngẫu nhiên và xóa database đó khi
kết thúc. Cần quyền tạo/xóa database; dữ liệu `pc_shop` không bị thay đổi.
