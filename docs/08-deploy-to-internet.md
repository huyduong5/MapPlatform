# 08 — Phase cuối: Deploy lên Internet (Go-Live)

> **Project:** Geo Decision Platform  
> **Phase:** Phase 3 ops / public go-live (sau Phase 0–7 code DONE)  
> **Đọc trước:** [`../context.md`](../context.md), [`00-tech-decisions.md`](./00-tech-decisions.md), [`06-deployment-ops.md`](./06-deployment-ops.md), [`03-phase3-status.md`](./03-phase3-status.md)  
> **Stack bắt buộc:** Payload CMS + PostgreSQL/PostGIS + Docker Compose  
> **Mục tiêu:** Đưa Map UI + API lên internet với HTTPS, domain thật, backup, và checklist go-live.  
> **Audit 2026-07-29:** Repo/local readiness **xong**. Public VPS/DNS/HTTPS **chưa** — cần tài nguyên nhóm. Chạy `./scripts/golive-preflight.sh` trước khi deploy.

---

## 0. Khi nào được deploy?

Chỉ bắt đầu phase này khi **đã xong** (hoặc gần xong) các mục DoD trong `context.md` / `07-roadmap-and-risks.md`:

- [x] `docker compose up` local chạy đủ `db` (+ `api`/`web`/`crawler` hoặc pnpm dev)
- [x] `GET /api/locations` và `/api/locations/nearby` OK
- [x] Map Hà Nội hiển thị marker + search + Near Me
- [x] Crawl P0 không xoá data cũ khi fail
- [x] Không commit `.env` / secret vào Git

> Phase 08 **không** thay coding Phase 0–7 — đây là hướng dẫn **đưa sản phẩm MVP lên mạng công cộng**.  
> Preflight: `./scripts/golive-preflight.sh`

---

## 1. Kiến trúc production (khuyến nghị MVP)

```
Internet (HTTPS)
      │
      ▼
┌─────────────────┐
│ Reverse Proxy   │  Caddy hoặc Nginx / Traefik
│ TLS (Let's Encrypt)
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
  web:3000  api:3001     (chỉ lắng nghe trong Docker network)
    │         │
    └────┬────┘
         ▼
      db:5432            (KHÔNG publish ra internet)
         ▲
         │
      crawler            (không expose port)
```

| Hostname gợi ý | Trỏ tới | Service |
|---|---|---|
| `map.yourdomain.com` | `/` | `web` (Next.js Map) |
| `api.yourdomain.com` | `/` + `/admin` | `api` (Payload REST + Admin) |

**Quy tắc bảo mật cứng:**

- ❌ Không mở port `5432` (Postgres) ra public.
- ❌ Không dùng `ports: "3001:3001"` trực tiếp ra internet nếu đã có reverse proxy — chỉ proxy nội bộ.
- ✅ HTTPS bắt buộc (Let's Encrypt).
- ✅ `PAYLOAD_SECRET`, DB password, `NOMINATIM_USER_AGENT` chỉ nằm trong `.env` trên server. **Không cần** key Mapbox/Goong/Geoapify.

File mẫu kèm repo:

- [`../docker-compose.prod.yml`](../docker-compose.prod.yml) — overlay production  
- [`../deploy/Caddyfile`](../deploy/Caddyfile) — reverse proxy + TLS  
- [`../deploy/README.md`](../deploy/README.md) — lệnh nhanh trên VPS  

---

## 2. Chọn nơi host (đơn giản cho nhóm sinh viên / MVP)

| Lựa chọn | Phù hợp khi | Ghi chú |
|---|---|---|
| **VPS** (Vultr, DigitalOcean, Linode, AWS Lightsail, Azure VM, VNG/Viettel Cloud…) | Muốn full Docker Compose đúng stack | **Khuyến nghị Phase 1** — dễ nhất khớp doc |
| Railway / Render / Fly.io | Muốn managed nhanh | Phải tách service; PostGIS image cần kiểm tra hỗ trợ |
| Vercel (chỉ `web`) + DB managed | FE tách riêng | API Payload vẫn cần host khác — phức tạp hơn MVP |

**Spec VPS tối thiểu gợi ý:**

| Tài nguyên | MVP |
|---|---|
| CPU | 2 vCPU |
| RAM | 4 GB (2 GB có thể chạy nhưng chật) |
| Disk | 40–60 GB SSD |
| OS | Ubuntu 22.04 / 24.04 LTS |
| Region | Singapore / gần VN |

---

## 3. Chuẩn bị trước khi lên server

### 3.1. Domain & DNS

1. Mua/giữ domain (ví dụ `yourdomain.com`).
2. Tạo DNS **A record**:

| Type | Name | Value |
|---|---|---|
| A | `map` | `<IP_VPS>` |
| A | `api` | `<IP_VPS>` |

3. Đợi DNS propagate (thường 5–30 phút). Kiểm tra:

```bash
dig +short map.yourdomain.com
dig +short api.yourdomain.com
```

### 3.2. Secrets production

Trên máy local, chuẩn bị file `.env.production` (không commit):

| Biến | Giá trị production |
|---|---|
| `POSTGRES_PASSWORD` | Random mạnh (≥ 24 ký tự) |
| `PAYLOAD_SECRET` | Random ≥ 32 ký tự |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_MAP_TILE_URL` | Carto/OpenFreeMap tile URL ($0) |
| `NOMINATIM_USER_AGENT` | Chuỗi có email liên hệ |
| `CORS_ORIGINS` | `https://map.yourdomain.com` |
| `NODE_ENV` | `production` |

Tạo secret nhanh:

```bash
openssl rand -base64 32
```

### 3.3. Map / Geocode — $0

- Dùng Leaflet + Carto/OpenFreeMap (không token).
- Geocode: Photon → Nominatim; điền email thật trong `NOMINATIM_USER_AGENT`.
- Chi tiết: [`09-free-apis-and-urls.md`](./09-free-apis-and-urls.md).

---

## 4. Setup VPS từng bước

### Bước 1 — SSH & bảo mật cơ bản

```bash
ssh root@<IP_VPS>

# Tạo user deploy (khuyến nghị)
adduser deploy
usermod -aG sudo deploy
# Thêm SSH key cho deploy, tắt password login nếu có thể
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### Bước 2 — Cài Docker

```bash
# Ubuntu — script chính thức Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
# logout/login lại để group docker có hiệu lực
docker --version
docker compose version
```

### Bước 3 — Clone repo & cấu hình env

```bash
sudo mkdir -p /opt/mapplatform
sudo chown deploy:deploy /opt/mapplatform
cd /opt/mapplatform

git clone <URL_REPO_GITLAB> .
cp .env.example .env
nano .env   # điền secret production + domain
```

Đặt tối thiểu trong `.env`:

```env
POSTGRES_USER=geouser
POSTGRES_PASSWORD=<STRONG_PASSWORD>
POSTGRES_DB=geo_platform

PAYLOAD_SECRET=<STRONG_SECRET_32+>
NODE_ENV=production

NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
CORS_ORIGINS=https://map.yourdomain.com

NEXT_PUBLIC_MAP_TILE_URL=https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
NOMINATIM_USER_AGENT=MapPlatform/1.0 (contact: you@example.com)
CRAWL_TIMEZONE=Asia/Ho_Chi_Minh
CRAWL_SCHEDULE=0 2 * * *
```

### Bước 4 — Chạy stack + reverse proxy

```bash
cd /opt/mapplatform

# Build & chạy app (db, api, web, crawler) — không publish DB ra ngoài
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Reverse proxy TLS
docker compose -f deploy/docker-compose.caddy.yml up -d
```

Hoặc nếu dùng một lệnh gộp (sau khi đã có đủ file deploy):

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f deploy/docker-compose.caddy.yml \
  up -d --build
```

### Bước 5 — Kiểm tra

```bash
docker compose ps
docker compose logs -f api
curl -I https://map.yourdomain.com
curl -s https://api.yourdomain.com/api/locations?limit=1 | head
```

Trình duyệt:

1. Mở `https://map.yourdomain.com` → map Hà Nội load  
2. Mở `https://api.yourdomain.com/admin` → Payload Admin (đổi mật khẩu admin ngay lần đầu)  
3. Search / Near Me / click marker  

---

## 5. Cấu hình reverse proxy (Caddy — khuyến nghị)

Caddy tự xin & renew Let's Encrypt nếu DNS đã trỏ đúng.

File [`../deploy/Caddyfile`](../deploy/Caddyfile):

```caddy
map.yourdomain.com {
  reverse_proxy web:3000
}

api.yourdomain.com {
  reverse_proxy api:3001
}
```

Đổi `yourdomain.com` thành domain thật trước khi chạy.

**Nginx tương đương (nếu không dùng Caddy):** terminate TLS bằng Certbot, `proxy_pass` tới `http://127.0.0.1:3000` / `3001` — chỉ khi bạn publish port nội bộ localhost. Với Docker network thuần, Caddy trong cùng compose network đơn giản hơn.

---

## 6. Production hardening (bắt buộc trước khi public rộng)

| Hạng mục | Việc cần làm |
|---|---|
| Postgres | Không publish `5432` ra `0.0.0.0` (xem `docker-compose.prod.yml`) |
| CORS | Chỉ `https://map.yourdomain.com` |
| Payload Admin | Tạo user admin mạnh; không để default password |
| Rate limit | Bật limit cho `/api/locations` và `/nearby` |
| Secrets | `.env` permission `600`; chỉ user `deploy` đọc |
| Updates | `apt update && apt upgrade` định kỳ; rebuild image khi có patch |
| Headers | Caddy/Nginx: không lộ version server nếu muốn |

Ví dụ quyền file:

```bash
chmod 600 /opt/mapplatform/.env
```

---

## 7. Backup & khôi phục trên internet deploy

### Backup DB hàng ngày (cron trên VPS)

```bash
sudo mkdir -p /opt/mapplatform/backups
crontab -e
```

Thêm:

```cron
0 3 * * * cd /opt/mapplatform && docker compose exec -T db pg_dump -U geouser -Fc geo_platform > /opt/mapplatform/backups/geo_$(date +\%F).dump && find /opt/mapplatform/backups -name 'geo_*.dump' -mtime +7 -delete
```

### Restore

```bash
docker compose exec -T db pg_restore -U geouser -d geo_platform --clean < backups/geo_YYYY-MM-DD.dump
```

---

## 8. Cập nhật phiên bản mới (rolling deploy đơn giản)

```bash
cd /opt/mapplatform
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f deploy/docker-compose.caddy.yml up -d
docker compose ps
```

Nếu migration Payload/DB:

```bash
docker compose exec api pnpm payload migrate   # chỉnh theo script thật khi đã code
```

Rollback nhanh: `git checkout <commit_cũ>` rồi `up -d --build` lại + restore backup nếu schema đã đổi.

---

## 9. Giám sát sau go-live

| Kiểm tra | Tần suất | Cách |
|---|---|---|
| HTTPS / site up | Mỗi ngày | Mở map URL hoặc UptimeRobot (free) |
| Container healthy | Mỗi ngày | `docker compose ps` |
| Crawl job | Mỗi sáng | Payload Admin → `crawl-jobs` |
| Disk | Mỗi tuần | `df -h` |
| Backup tồn tại | Mỗi tuần | `ls -lh backups/` |

Alert tối thiểu: email/Telegram khi UptimeRobot báo `map` hoặc `api` down.

---

## 10. Checklist Go-Live (in ra và đánh dấu)

### Trước deploy

- [ ] Domain + DNS A record trỏ đúng IP VPS  
- [ ] `.env` production đủ secret, `NODE_ENV=production`  
- [ ] `NEXT_PUBLIC_API_BASE_URL` dùng **https://api...**  
- [ ] `CORS_ORIGINS` = URL map https  
- [ ] Map tiles Carto/OpenFreeMap load OK (không cần Mapbox)  

### Lúc deploy

- [ ] Docker + Compose đã cài  
- [ ] `docker compose ... up -d --build` thành công  
- [ ] Caddy/Nginx TLS OK (ổ khoá HTTPS)  
- [ ] Postgres không lộ port public (`ss -tlnp | grep 5432` chỉ local/docker)  

### Sau deploy

- [ ] Map load, layer charging/store OK  
- [ ] Nearby / Search OK từ trình duyệt thật (không chỉ localhost)  
- [ ] Payload Admin đổi mật khẩu  
- [ ] Cron backup đã gắn  
- [ ] Uptime monitor đã bật  
- [ ] Crawl chạy thử one-shot trên server  

---

## 11. Sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách xử |
|---|---|---|
| Caddy không xin được cert | DNS chưa trỏ / port 80 bị chặn | Kiểm `dig`, `ufw allow 80,443` |
| Map gọi API lỗi CORS | Sai `CORS_ORIGINS` hoặc API URL http thay vì https | Sửa `.env`, recreate `api`/`web` |
| Map trắng / không marker | Sai `NEXT_PUBLIC_API_BASE_URL` (build-time) | Rebuild `web` sau khi đổi env |
| Nearby chậm / lỗi | PostGIS chưa có / thiếu GiST index | Kiểm extension + migration spatial |
| Admin Payload 502 | `api` chưa healthy | `docker compose logs api` |
| Hết disk | Log + backup đầy | `docker system prune`, xoá dump cũ |

---

## 12. Chi phí ước lượng (tham khảo)

| Hạng mục | /tháng (USD, xấp xỉ) |
|---|---|
| VPS 2 vCPU / 4GB | $12–24 |
| Domain | ~$1–2 (chia tháng) |
| Map tiles + geocode (Carto/Photon/Nominatim) | $0 |
| UptimeRobot free | $0 |

---

## 13. Phạm vi không thuộc Phase 08 / Phase 3 deploy

- ❌ Multi-region / K8s / service mesh  
- ❌ Blue-green phức tạp, canary  
- ❌ CDN toàn cầu bắt buộc (có thể thêm Cloudflare proxy sau)  
- ❌ Nationwide data full crawl (multi-city foundation đã có ở Phase 7; seed HCM/ĐN stub)

Cloudflare (optional sau go-live): bật proxy cam cho `map` / `api` để có CDN + DDoS cơ bản — nhớ cấu hình SSL mode `Full (strict)`.

---

## 14. Definition of Done — Phase Deploy Internet

Phase này **xong** khi:

- [ ] Người dùng ngoài internet mở được `https://map.<domain>` không cần VPN  
- [ ] API public `https://api.<domain>/api/locations` trả JSON hợp lệ  
- [ ] HTTPS hợp lệ (không warning certificate)  
- [ ] DB không expose public  
- [ ] Backup tự động ≥ 1 lần/ngày  
- [ ] Có cách cập nhật (`git pull` + rebuild) đã thử thành công 1 lần  

---

## 15. Liên kết

| File | Vai trò |
|---|---|
| [`06-deployment-ops.md`](./06-deployment-ops.md) | Docker local/ops nền |
| [`00-tech-decisions.md`](./00-tech-decisions.md) | Stack bắt buộc |
| [`07-roadmap-and-risks.md`](./07-roadmap-and-risks.md) | Timeline / rủi ro |
| [`../deploy/README.md`](../deploy/README.md) | Lệnh deploy nhanh trên VPS |
