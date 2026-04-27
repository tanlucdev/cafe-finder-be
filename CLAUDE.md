# Cafe Finder – Backend

NestJS REST API cho ứng dụng tìm kiếm cafe tại TP.HCM.

- **Framework**: NestJS 10 + TypeScript
- **Database**: Supabase PostgreSQL (PostGIS enabled) + Prisma ORM 5
- **Auth**: JWT (passport-jwt), bcrypt, forgot/reset password qua Resend email
- **Storage**: Supabase (ảnh)
- **Email**: Resend (`resend` package) — cấu hình qua `RESEND_API_KEY`
- **Port**: 3001 — global prefix `/api`, Swagger tại `/api/docs`
- **Deploy**: Render.com (xem Dockerfile)

---

## Local Development

```bash
npm install
npm run prisma:generate
npm run start:dev    # hot reload
npm run start:prod   # production
```

### Các lệnh Prisma hữu ích

```bash
npm run prisma:studio    # GUI database browser
npm run prisma:seed      # Seed data mẫu
npx prisma db push       # Sync schema → DB (không tạo migration)
```

---

## Environment Variables (`be/.env`)

| Key | Mô tả |
|-----|-------|
| `DATABASE_URL` | Supabase **Session Pooler** URL (IPv4 compatible) — lấy từ Supabase > Project Settings > Database > Connection Pooling > Session |
| `DIRECT_URL` | Supabase direct URL — dùng cho `prisma db push`/migrate. Local: cũng dùng Session Pooler; Render: dùng direct |
| `JWT_SECRET` | Secret key cho JWT |
| `JWT_EXPIRES_IN` | Thời hạn token (default `7d`) |
| `SUPABASE_URL` | Base URL Supabase, **không có** trailing path |
| `SUPABASE_SERVICE_KEY` | Service role key từ Supabase Settings → API |
| `SUPABASE_BUCKET` | Tên bucket (default `cafe-images`) |
| `GOOGLE_PLACES_API_KEY` | Optional |
| `PORT` | Default `3001` |
| `FRONTEND_URL` | CORS origin (default `http://localhost:3000`) |
| `APP_URL` | Frontend URL — dùng để tạo link reset password trong email |
| `RESEND_API_KEY` | API key từ resend.com — dùng để gửi email |
| `RESEND_FROM_EMAIL` | Email gửi đi (cần verify domain trên Resend). Dev: `onboarding@resend.dev` |

### Lưu ý kết nối Supabase (IPv4)

Local development thường dùng IPv4 — **không thể** kết nối thẳng tới `db.xxx.supabase.co:5432` (IPv6 only).
Phải dùng **Session Pooler** URL: `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres`

Trên Render.com (IPv6 native), có thể dùng direct URL cho `DIRECT_URL`.

---

## Module Architecture

```
src/
├── auth/           JWT auth, register/login, forgot/reset password, guards, strategies
├── email/          EmailService dùng Resend — gửi email reset password
├── cafes/          Browse, search, nearby (PostGIS), quiz-match
├── saved/          User saved cafes & collections
├── submissions/    User cafe submission flow
├── admin/          CRUD cafes, review submissions, image upload
├── storage/        Supabase image upload/delete
├── prisma/         PrismaService (global module)
└── common/         Guards, decorators, filters, pipes
```

---

## API Reference

### Auth

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/register` | ❌ | Đăng ký (email, password, displayName) |
| POST | `/api/auth/login` | ❌ | Đăng nhập → trả JWT token |
| GET | `/api/auth/me` | JWT | Thông tin user hiện tại |
| PATCH | `/api/auth/profile` | JWT | Cập nhật displayName |
| PATCH | `/api/auth/password` | JWT | Đổi mật khẩu (cần mật khẩu cũ) |
| POST | `/api/auth/forgot-password` | ❌ | Gửi email link đặt lại mật khẩu |
| POST | `/api/auth/reset-password` | ❌ | Đặt lại mật khẩu bằng token từ email |

### Cafes (Public)

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/cafes` | ❌ | Danh sách cafe (có filter + pagination) |
| GET | `/api/cafes/nearby` | ❌ | Cafe gần nhất (PostGIS) |
| GET | `/api/cafes/districts` | ❌ | Danh sách quận có cafe |
| GET | `/api/cafes/quiz-match` | ❌ | Top 10 theo vibe + purpose |
| GET | `/api/cafes/:slug` | ❌ | Chi tiết cafe |

### Saved (Cần JWT)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/saved` | Danh sách cafe đã lưu |
| GET | `/api/saved/collections` | Tên các collection |
| POST | `/api/saved` | Lưu cafe (body: `{ cafeId, collectionName? }`) |
| DELETE | `/api/saved/:cafeId` | Xóa khỏi saved |

### Submissions (Cần JWT)

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/submissions` | Gửi đề xuất cafe mới |

### Admin (Cần JWT + role ADMIN)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/admin/cafes` | Tất cả cafe (kể cả unpublished) |
| POST | `/api/admin/cafes` | Tạo cafe mới |
| PUT | `/api/admin/cafes/:id` | Cập nhật cafe |
| DELETE | `/api/admin/cafes/:id` | Xóa cafe |
| PATCH | `/api/admin/cafes/:id/publish` | Toggle publish/unpublish |
| POST | `/api/admin/cafes/:id/images` | Upload ảnh ⚠️ |
| GET | `/api/admin/submissions` | Danh sách submissions |
| PATCH | `/api/admin/submissions/:id` | Duyệt/từ chối submission |

---

## Cafe Filter Params (`GET /api/cafes`)

| Param | Type | Mô tả |
|-------|------|-------|
| `district` | string | Lọc theo quận (exact match) |
| `search` | string | Tìm trong name, address, oneLiner |
| `priceRange` | enum | `under_50k` \| `price_50k_100k` \| `price_100k_150k` \| `above_150k` |
| `vibe` | string (comma-sep) | Match any (hasSome) |
| `purpose` | string (comma-sep) | Match any (hasSome) |
| `page` | number | 1-based, default 1 |
| `limit` | number | 1–50, default 12 |

---

## PostGIS Nearby Search

```
GET /api/cafes/nearby?lat=10.78&lng=106.69&radius=2
```

- `radius`: km, default 2km
- Trả về tối đa 20 cafe, sort theo `distance_km` tăng dần
- Dùng `ST_DWithin` (lọc radius) + `ST_Distance` (tính khoảng cách chính xác)
- Kiểu dữ liệu: `geography` SRID 4326 (độ chính xác cao hơn `geometry`)
- Cột `location` được trigger tự cập nhật khi `lat`/`lng` thay đổi
- GIST spatial index trên `location`

---

## Database Schema

**Models**: `User`, `Cafe`, `SavedCafe`, `CafeSubmission`, `PasswordResetToken`

**Enums**:
- `Role`: `USER` | `ADMIN`
- `PriceRange`: `under_50k` | `price_50k_100k` | `price_100k_150k` | `above_150k`
- `SubmissionStatus`: `pending` | `approved` | `rejected`

**File**: [prisma/schema.prisma](prisma/schema.prisma)

---

## Known Issues & Gaps

| Issue | Mô tả |
|-------|-------|
| ⚠️ Image upload | `POST /admin/cafes/:id/images` chỉ trả URL, không tự update `images[]`/`coverImage` trong cafe — cần gọi `PUT /admin/cafes/:id` riêng để gán |
| ⚠️ Full-text search | Migration đã tạo `tsvector` index nhưng service dùng Prisma `contains` (slower) thay vì raw `to_tsvector` query |
| ❌ Rate limiting | Chưa có `@nestjs/throttler` — auth endpoints có thể bị brute force |
| ❌ Caching | Không có cache layer — mỗi request đều query DB |
| ❌ User profile | Không có endpoint update `displayName`, avatar, password |
| ❌ Soft delete | Xóa cafe là hard delete, không thể khôi phục |

Xem danh sách đầy đủ: [plan.md](plan.md)

---

## Migration Notes

- Chỉ có 1 migration: `add_postgis`. Schema khởi tạo bằng `prisma db push`.
- **Không dùng** `prisma migrate dev` trên DB trống — xem hướng dẫn trong root [CLAUDE.md](../CLAUDE.md).
- PostgreSQL@17 bắt buộc (PostGIS 3.6.x không tương thích @16).
