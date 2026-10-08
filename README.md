# 🚀 Stremio Anime Vietsub Auto Addon

Addon phụ đề Tiếng Việt tự động, toàn diện cho Stremio. Được thiết kế tối ưu cho cộng đồng xem Anime và phim bộ với mục tiêu: **"Tự động 100% - Không bao giờ lo thiếu Vietsub"**.

---

## ✨ Tính năng nổi bật

- **Đa nguồn phụ đề Tiếng Việt:** Tích hợp trực tiếp từ AnimeSub+, Subsource, OpenSubtitles v3.
- **Auto-Translate thông minh:** Tự động lấy phụ đề tiếng Anh/Nhật chuẩn từ AnimeTosho (Nyaa/Erai/SubsPlease) và dịch tức thì sang Tiếng Việt giữ nguyên mốc thời gian (timestamp).
- **Hoạt động độc lập:** Tương thích 100% với luồng phát video từ **TorBox**, **Real-Debrid**, **Torrentio**, **AnimeStream**...
- **Hỗ trợ toàn bộ hệ ID:** Tự động nhận diện và cross-map giữa IMDb ID (`tt...`), Kitsu ID (`kitsu:...`), MyAnimeList (`mal:...`).
- **Giao diện cấu hình White-Blue hiện đại:** Cài đặt nhanh với 1 cú click (`stremio://`).

---

## 🛠️ Triển khai (Deployment)

### 1. Deploy lên Vercel (Khuyên dùng - Miễn phí & Tự động 100%)
1. Fork hoặc Push repository này lên GitHub cá nhân của bạn.
2. Truy cập [Vercel.com](https://vercel.com) -> Đăng nhập bằng GitHub.
3. Chọn **Add New Project** -> Chọn repository `stremio-vietsub-addon` -> Bấm **Deploy**.
4. Sau khi deploy xong, bạn sẽ có URL dạng: `https://ten-addon-cua-ban.vercel.app/manifest.json`.
5. Dán URL này vào Stremio là hoàn tất!

### 2. Chạy Local trên máy tính (Node.js)
```bash
# Cài đặt dependencies
npm install

# Khởi động server
npm start
```
Truy cập: `http://localhost:7000` hoặc link manifest: `http://localhost:7000/manifest.json`.

---

## 📺 Hướng dẫn sử dụng với TorBox trên Stremio

1. Cài đặt **Torrentio** với **TorBox API Key** tại: `https://torrentio.strem.fun/configure`.
2. Cài đặt Addon **Anime Vietsub Auto** này vào Stremio.
3. Mở bất kỳ bộ Anime nào trong Stremio, chọn nguồn phát từ **TorBox** (`[TB+]`).
4. Bật trình phát phim, bấm vào biểu tượng Phụ đề (Subtitles) ở góc dưới và chọn **Vietsub** hoặc **⚡ [Auto Vietsub]** để thưởng thức!
