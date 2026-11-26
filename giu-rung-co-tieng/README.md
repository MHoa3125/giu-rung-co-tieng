# Giữ Rừng Có Tiếng – Crowdfunding Prototype

Trang crowdfunding **mô phỏng** (phục vụ học tập/demo) cho dự án truyền thông xã hội bảo vệ **tê tê**.
Flask + HTML/CSS/JS thuần. **Không** database, đăng nhập hay thanh toán thật. Phong cách hoạt hình vẽ tay.

## 1. Yêu cầu
Python 3.9 trở lên. Font (Baloo 2, Nunito) tải từ Google Fonts khi có internet; offline sẽ tự dùng font hệ thống.

## 2–4. Cài đặt và chạy
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
python app.py
```

## 5. Mở website
Truy cập http://127.0.0.1:5000

## 6. Cấu trúc project
```
giu-rung-co-tieng/
├── app.py                # Flask + TOÀN BỘ dữ liệu demo (CAMPAIGN)
├── requirements.txt
├── templates/index.html  # Giao diện (Jinja2), 1 trang duy nhất
├── static/
│   ├── css/style.css     # Toàn bộ style (biến màu ở đầu file)
│   ├── js/script.js      # Modal, updateProgress(), toast, menu
│   ├── images/{hero,pangolin,rewards,logo}/
│   └── video/            # đặt campaign.mp4
└── assets/               # file nguồn/e-book lưu trữ (không phục vụ web)
```

## 7. Cách thay hình ảnh (ảnh tê tê do nhóm cung cấp, hãy ghi rõ nguồn/bản quyền trong báo cáo; các ảnh còn lại là minh hoạ tạm tự vẽ)
Cách nhanh nhất: **thay file cùng tên**. Hoặc đổi đường dẫn trong `CAMPAIGN["images"]` ở `app.py`.

| Cần thay | File / khoá cấu hình |
|---|---|
| Ảnh nền hero (rừng) | `static/images/hero/hero.svg` – `hero_bg` |
| Ảnh tê tê chính (hero) | `static/images/pangolin/pangolin-hero.png` – `pangolin` |
| Tê tê cuộn tròn (khối kêu gọi) | `static/images/pangolin/pangolin-curled.png` – `pangolin_cta` |
| Ảnh phần Câu chuyện | `static/images/pangolin/forest-story.svg` – `story` |
| 3 hình nền điện thoại (preview) | `static/images/rewards/wallpaper-1..3.svg` – `wallpapers` |
| Bìa e-book (preview) | `static/images/rewards/ebook-cover.svg` – `ebook_cover` |
| Logo | `static/images/logo/logo.svg` – `logo` |

Dùng ảnh .jpg/.png/.webp: copy vào thư mục tương ứng rồi sửa đường dẫn trong `app.py`
(ví dụ `"images/hero/hero.jpg"`). Ảnh hero nên rộng ≥ 1600px, đáy ảnh là phần đồi/cây vì được neo ở đáy.

### Quà ở màn hình "Hoàn tất"
Sau khi ủng hộ thành công, khu **Quà của bạn** liệt kê quà theo mức (30K: 3 hình nền; 70K: thêm e-book).
Bấm *Tải về* chỉ chạy thanh tải và hiện dấu tích xanh "Đã tải về" — **không tải file thật**.
Đổi tên quà: `GIFT_WALLPAPERS` / `GIFT_EBOOK` trong `app.py`. Muốn tải file thật sau này: đặt file vào `static/` và đổi nút thành link `<a download>`.
Lưu file nguồn lớn/ chưa công khai ở `assets/`.

## 8. Cách thay video
Đặt video vào `static/video/campaign.mp4` (≈ 2 phút). Có file là trình phát tự hiện, không cần sửa code.
Đổi tên/ảnh bìa: `CAMPAIGN["video"]` trong `app.py`.

## 9. Cách thay nội dung
- Văn bản các khu vực: sửa trực tiếp `templates/index.html` (có comment từng khu vực; headline ở thẻ `<h1>`).
- Mức đóng góp, phần quà, phân bổ vốn, thông tin chuyển khoản giả lập: `CAMPAIGN` trong `app.py`.
- Dòng thông tin môn học ở footer: `templates/index.html` (class `footer-sub`), sửa hoặc xoá tuỳ ý.
- Màu sắc, font, độ dày nét viền: biến `:root` ở đầu `static/css/style.css`.

## 10. Cách thay số tiền demo
Trong `app.py`:
```python
"target_amount": 5_000_000,    # mục tiêu
"current_amount": 2_850_000,   # số tiền ban đầu (57%)
```
Phần trăm, thanh tiến độ, số "còn lại" và biểu đồ phân bổ tự tính lại. Mỗi mức ủng hộ sửa ở `CAMPAIGN["tiers"]`.

## Ghi chú
- Tiến độ chỉ cập nhật trên giao diện; **tải lại trang sẽ về số ban đầu** (không lưu dữ liệu) – tiện demo nhiều lần.
- Thông tin chuyển khoản trong modal là **giả lập**, có ghi chú rõ để không bị hiểu là tài khoản thật.
- Không có số liệu thống kê về tê tê vì chưa có nguồn được cung cấp.
