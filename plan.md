# Backend – Danh sách việc cần làm

## 🔴 Cao (blocking hoặc UX quan trọng)

- [ ] **Fix image upload**: `POST /admin/cafes/:id/images` phải tự cập nhật `images[]` + `coverImage` vào bảng cafes (hiện chỉ trả URL, cần gọi PUT riêng)
- [ ] **User profile update**: Thêm `PATCH /api/auth/profile` để cập nhật `displayName`, avatar
- [ ] **Đổi mật khẩu**: Thêm `PATCH /api/auth/password` (cần xác minh mật khẩu cũ)

## 🟡 Trung bình (feature còn thiếu)

- [ ] **Full-text search thực sự**: Migration đã tạo `tsvector` index nhưng service dùng Prisma `contains` — refactor sang raw query `to_tsvector` + `plainto_tsquery`
- [ ] **Rate limiting**: Thêm `@nestjs/throttler` cho auth endpoints (register, login)
- [ ] **Xóa tài khoản**: Thêm `DELETE /api/auth/account`
- [ ] **Admin image management**: Bulk upload, reorder images, set cover image riêng biệt

## 🟢 Thấp (nice to have)

- [ ] **Caching**: Redis hoặc in-memory cache cho `GET /api/cafes` và `GET /api/cafes/nearby`
- [ ] **Request logging**: Middleware log method + path + status + response time
- [ ] **Soft delete**: Thêm `deletedAt` field cho Cafe thay vì hard delete
- [ ] **Mô tả dài**: Thêm `description` field (hiện chỉ có `oneLiner` 1 câu)
- [ ] **Multi priceRange filter**: Cho phép filter nhiều mức giá cùng lúc (hiện chỉ 1 giá trị)

## 📝 Documentation / Dev Tooling

- [x] Tạo `be/CLAUDE.md`
- [ ] Kiểm tra `.env.example` đã vào git chưa (không commit `.env` thật)
- [ ] Seed data phong phú hơn: thêm ~20 cafe mẫu với đủ fields, ảnh, location thật
