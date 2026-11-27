"""
GIỮ RỪNG CÓ TIẾNG – Crowdfunding Prototype (mô phỏng, phục vụ học tập)

- Không database, không đăng nhập, không thanh toán thật.
- Toàn bộ dữ liệu demo nằm trong CAMPAIGN bên dưới: sửa ở đây là website đổi theo.
- Số tiền/tiến độ được đẩy xuống JavaScript qua thẻ <script type="application/json">
  trong templates/index.html, nên chỉ có MỘT nơi cấu hình duy nhất.
"""
import os

from flask import Flask, render_template

app = Flask(__name__)

# --------------------------------------------------------------------------- #
# CẤU HÌNH DỮ LIỆU DEMO – SINH VIÊN CHỈNH Ở ĐÂY
# --------------------------------------------------------------------------- #
# --- QUÀ HIỂN THỊ Ở MÀN HÌNH "HOÀN TẤT" ---
# Nút "Tải về" chỉ chạy hiệu ứng tải trên giao diện rồi hiện dấu tích xanh
# "Đã tải về thành công" (không tải file thật). Muốn đổi tên quà: sửa "label".
GIFT_WALLPAPERS = [{"label": f"Hình nền điện thoại {i}", "kind": "image"} for i in (1, 2, 3)]
GIFT_EBOOK = {"label": "E-book “Làm quen với tê tê”", "kind": "ebook"}


# --- ẢNH PHẦN "CÂU CHUYỆN" (ví dụ: poster của dự án / ảnh thật) ---
# Đặt ảnh vào static/images/story/ với tên "story-poster" (đuôi .jpg / .jpeg / .png / .webp đều được) -> trang tự dùng ảnh đó.
# Muốn đổi ảnh khác: thay file này (giữ tên) hoặc sửa "file" bên dưới. Không có file -> dùng lại ảnh vẽ minh hoạ cũ.
# "credit" = nguồn/tác giả hiển thị dưới ảnh (để trống "" nếu là ảnh của chính bạn).
STORY_IMAGE = {
    "file": "images/story/story-poster",   # không cần ghi đuôi file
    "alt": "Poster “Tê tê Java – khi lớp vảy bảo vệ trở thành lời cầu cứu” kêu gọi nói không với động vật hoang dã",
    "credit": "Poster: Bảo tàng Thiên nhiên Duyên hải miền Trung (Sở Khoa học và Công nghệ TP. Huế)",
}

CAMPAIGN = {
    "name": "Giữ Rừng Có Tiếng",
    "subject": "Tê tê (Pangolin)",

    # --- Tiền (đơn vị: VNĐ) ---
    "target_amount": 5_000_000,    # Mục tiêu gọi vốn (mô phỏng)
    "current_amount": 2_850_000,   # Số tiền ban đầu (mô phỏng) -> 57%

    # --- Các mức đóng góp & phần quà ---
    "tiers": [
        {
            "id": "tier-30",
            "amount": 30_000,
            "label": "Mức 1",
            "featured": False,
            "badge": None,
            "rewards": ["Bộ 3 hình nền điện thoại"],
            "downloads": GIFT_WALLPAPERS,
        },
        {
            "id": "tier-70",
            "amount": 70_000,
            "label": "Mức 2",
            "featured": True,
            "badge": "Được yêu thích",
            "rewards": ["Bộ 3 hình nền điện thoại", "E-book “Làm quen với tê tê”"],
            "downloads": GIFT_WALLPAPERS + [GIFT_EBOOK],
        },
    ],

    # --- Phân bổ nguồn vốn (tổng phải = target_amount) ---
    "funds": [
        {"key": "conservation", "label": "Bảo tồn", "amount": 3_000_000,
         "color": "#1f5a43", "desc": "Phần lớn nguồn vốn dành cho hoạt động bảo tồn."},
        {"key": "education", "label": "Truyền thông & giáo dục", "amount": 1_500_000,
         "color": "#c9893a", "desc": "Lan tỏa thông điệp bảo vệ tê tê đến cộng đồng."},
        {"key": "operations", "label": "Vận hành", "amount": 500_000,
         "color": "#8a5a3c", "desc": "Duy trì hoạt động của dự án."},
    ],

    # --- Thông tin nhận ủng hộ (dữ liệu tự đặt cho prototype, sửa tuỳ ý) ---
    # Luồng chuyển khoản chỉ chạy trên giao diện; không có kết nối ngân hàng nào.
    "payment": {
        "bank_name": "Ngân hàng TMCP Rừng Xanh (RXB)",
        "branch": "Chi nhánh TP. Hồ Chí Minh",
        "account_name": "QUY GIU RUNG CO TIENG",
        "account_number": "1903 6868 2026",
        "memo_prefix": "GRCT",      # nội dung CK sẽ có dạng: GRCT 70K 4821
        "expire_seconds": 600,      # thời gian hiệu lực của mã giao dịch (10 phút)
    },

    # --- Đường dẫn ảnh/video (tính từ thư mục static/) ---
    # Muốn đổi ảnh: thay file cùng tên, hoặc sửa đường dẫn tại đây.
    "images": {
        "logo": "images/logo/logo.svg",
        "hero_bg": "images/hero/forest-bg",                   # ảnh nền hero: đặt forest-bg.jpg (hoặc .png/.webp) vào static/images/hero/. Không có ảnh -> dùng tranh vẽ cũ hero.svg
        "pangolin": "images/pangolin/pangolin-hero.png",      # ảnh tê tê chính (hero)
        "pangolin_cta": "images/pangolin/pangolin-curled.png", # tê tê cuộn tròn (khối kêu gọi)
        "story": "images/pangolin/forest-story.svg",          # ảnh phần Câu chuyện
        "wallpapers": [                                       # 3 hình nền điện thoại
            "images/rewards/wallpaper-1.svg",
            "images/rewards/wallpaper-2.svg",
            "images/rewards/wallpaper-3.svg",
        ],
        "ebook_cover": "images/rewards/ebook-cover.svg",      # bìa e-book
    },
    "video": {
        "file": "video/campaign.mp4",       # đặt video thật vào static/video/
        "poster": "images/hero/hero.svg",   # ảnh bìa dự phòng; ảnh bìa chính: đặt video-poster.jpg vào static/images/video/
        "duration": "khoảng 2 phút",
    },
}


# --------------------------------------------------------------------------- #
# Tiện ích
# --------------------------------------------------------------------------- #
@app.template_filter("vnd")
def format_vnd(value):
    """2850000 -> '2.850.000 VNĐ'"""
    return f"{int(value):,}".replace(",", ".") + " VNĐ"


@app.template_filter("num")
def format_num(value):
    """2850000 -> '2.850.000'"""
    return f"{int(value):,}".replace(",", ".")


def _find_static_image(base):
    """Tìm ảnh theo tên (không cần đuôi): static/<base>.(jpg|jpeg|png|webp).
    Chịu được tên file bị thừa đuôi (vd. forest-bg.jpg.jpg do Windows ẩn đuôi) hoặc có thêm hậu tố như "forest-bg (1).jpg".
    Trả về đường dẫn tính từ static/ hoặc None."""
    folder = os.path.join(app.static_folder, os.path.dirname(base))
    stem = os.path.basename(base)
    if not os.path.isdir(folder):
        return None
    exts = (".jpg", ".jpeg", ".png", ".webp")
    names = sorted(os.listdir(folder))
    # ưu tiên tên chuẩn, sau đó mới tới tên có thừa đuôi/hậu tố
    for name in names:
        if name.lower() in [stem.lower() + e for e in exts]:
            return os.path.join(os.path.dirname(base), name).replace(os.sep, "/")
    for name in names:
        if name.lower().startswith(stem.lower()) and name.lower().endswith(exts):
            return os.path.join(os.path.dirname(base), name).replace(os.sep, "/")
    return None


def _percent(part, total):
    return round(part / total * 100) if total else 0


def build_context():
    c = dict(CAMPAIGN)
    funds = []
    start = 0.0
    for f in CAMPAIGN["funds"]:
        pct = f["amount"] / CAMPAIGN["target_amount"] * 100
        funds.append({**f, "percent": round(pct), "start": start, "end": start + pct})
        start += pct
    c["funds"] = funds
    c["donut_gradient"] = "conic-gradient(" + ", ".join(
        f"{f['color']} {f['start']:.2f}% {f['end']:.2f}%" for f in funds) + ")"
    c["initial_percent"] = min(100, _percent(c["current_amount"], c["target_amount"]))

    # Video: chỉ hiển thị player khi file thật tồn tại
    video_path = os.path.join(app.static_folder, CAMPAIGN["video"]["file"])
    c["has_video"] = os.path.isfile(video_path)

    # Ảnh nền hero: dùng ảnh người dùng đặt nếu có, không thì tranh vẽ cũ (để nền không bao giờ trống)
    c["images"] = {**CAMPAIGN["images"],
                   "hero_bg": _find_static_image(CAMPAIGN["images"]["hero_bg"]) or "images/hero/hero.svg"}

    # Ảnh bìa video: dùng ảnh người dùng đặt (static/images/video/video-poster.jpg) nếu có, không thì ảnh cũ trong CAMPAIGN["video"]
    c["video_poster"] = _find_static_image("images/video/video-poster") or CAMPAIGN["video"]["poster"]

    # Ảnh phần Câu chuyện: dùng ảnh người dùng đặt (poster/ảnh thật) nếu có, không thì ảnh vẽ cũ
    custom = _find_static_image(STORY_IMAGE["file"])
    c["story_image"] = {
        "src": custom or CAMPAIGN["images"]["story"],
        "custom": bool(custom),
        "alt": STORY_IMAGE["alt"] if custom else "Cảnh rừng lúc hoàng hôn, minh hoạ cho câu chuyện của dự án",
        "credit": STORY_IMAGE["credit"] if custom else "",
    }

    # Quà hiển thị sau khi ủng hộ (chỉ cần nhãn)
    def _downloads(items):
        return [{"label": g["label"], "kind": g["kind"]} for g in items]

    # Cấu hình gửi xuống JavaScript
    c["js_config"] = {
        "campaignName": CAMPAIGN["name"],
        "targetAmount": CAMPAIGN["target_amount"],
        "currentAmount": CAMPAIGN["current_amount"],
        "tiers": {t["id"]: {"amount": t["amount"], "rewards": t["rewards"],
                           "downloads": _downloads(t["downloads"])} for t in CAMPAIGN["tiers"]},
        "payment": {
            "bankName": CAMPAIGN["payment"]["bank_name"],
            "accountName": CAMPAIGN["payment"]["account_name"],
            "accountNumber": CAMPAIGN["payment"]["account_number"],
            "memoPrefix": CAMPAIGN["payment"]["memo_prefix"],
            "expireSeconds": CAMPAIGN["payment"]["expire_seconds"],
        },
    }
    return c


@app.route("/")
def index():
    return render_template("index.html", c=build_context())


if __name__ == "__main__":
    # debug=True chỉ dùng khi phát triển/demo local
    app.run(host="127.0.0.1", port=5000, debug=True)