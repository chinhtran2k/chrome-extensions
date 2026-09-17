# Hướng dẫn đăng lên Chrome Web Store

File đã đóng gói sẵn:
```
~/chrome-extensions/page-to-markdown.zip   (12 KB)
~/chrome-extensions/table-to-csv.zip       (12 KB)
```

---

## BƯỚC 0 — Thử dưới máy trước (miễn phí)

Đừng trả $5 khi chưa tự dùng thử.

1. Mở `chrome://extensions`
2. Bật **Developer mode** (góc trên bên phải)
3. Bấm **Load unpacked** → chọn thư mục `page-to-markdown`
4. Lặp lại với `table-to-csv`
5. Ghim hai extension lên thanh công cụ, dùng thử vài ngày

Sửa gì thì bấm nút reload (hình mũi tên vòng) ở thẻ extension.

---

## BƯỚC 1 — Tạo tài khoản nhà phát triển ($5)

1. Vào https://chrome.google.com/webstore/devconsole
2. Đăng nhập bằng tài khoản Google
3. Trả **$5 một lần** bằng thẻ

**Thẻ Việt Nam hay bị từ chối ở bước này.** Nếu gặp lỗi:
- Dùng thẻ Visa/Mastercard quốc tế, không dùng thẻ nội địa
- Bật thanh toán quốc tế trong app ngân hàng
- Thử thẻ ảo (Timo, Cake, TPBank EVO)
- Đảm bảo địa chỉ thanh toán khớp với thông tin ngân hàng

Trả một lần, dùng trọn đời, đăng **cả hai extension** không phải trả thêm.

---

## BƯỚC 2 — Tạo listing

Trong Developer Console → **Add new item** → tải file `.zip` lên.

Điền theo đúng nội dung trong `STORE-LISTING.md` của từng extension:

| Mục | Lấy ở đâu |
|---|---|
| Name | `STORE-LISTING.md` → Name |
| Short description | `STORE-LISTING.md` → Short description |
| Detailed description | `STORE-LISTING.md` → Detailed description |
| Category | Productivity → Workflow & Planning |
| Language | English |

---

## BƯỚC 3 — Ảnh chụp màn hình (bắt buộc)

Cần **ít nhất 1 ảnh, kích thước 1280×800**.

Cách chụp trên Mac:
1. Mở trang ví dụ, bấm extension cho popup hiện ra
2. `Cmd + Shift + 4` rồi kéo chọn vùng
3. Nếu ảnh không đúng 1280×800, mở bằng Preview → Tools → Adjust Size

Nên chụp:
- **Page to Markdown**: popup mở cạnh một bài viết, thấy rõ số token
- **Table to CSV**: popup liệt kê các bảng trên trang Wikipedia GDP

---

## BƯỚC 4 — Khai quyền riêng tư (quan trọng nhất)

Đây là chỗ hay bị từ chối nhất. Điền đúng như sau:

**Single purpose** — copy từ `STORE-LISTING.md`

**Permission justification** — mỗi quyền một dòng, đã viết sẵn trong `STORE-LISTING.md`:
- `activeTab`
- `scripting`
- `storage`

**Data usage** — tích **KHÔNG thu thập** cho tất cả các mục. Hai extension này không gửi dữ liệu đi đâu cả.

**Remote code** — chọn **No**. Toàn bộ mã nằm trong gói.

Cuối trang tích vào ô cam kết tuân thủ chính sách.

---

## BƯỚC 5 — Gửi duyệt

Bấm **Submit for review**.

Thời gian duyệt:
- Extension đơn giản, ít quyền như của bạn: thường **vài giờ đến 24 tiếng**
- Nếu xin quyền rộng: có thể vài tuần

Hai extension này chỉ xin `activeTab`, `scripting`, `storage` — không xin quyền truy cập toàn bộ website — nên thuộc nhóm duyệt nhanh.

Bị từ chối thì email của Google ghi rõ vi phạm điều nào. Sửa rồi gửi lại. Khiếu nại thường được trả lời trong 3 ngày làm việc.

---

## Trước khi đăng Table to CSV (nếu thu phí)

Hiện đã thống nhất để **miễn phí**, nên bỏ qua phần này.

Nếu sau này muốn thu phí, cần điền hai chỗ:
```
src/licence.js : PADDLE_PUBLIC_KEY = "..."   (lấy trong dashboard Paddle)
src/popup.js   : BUY_URL = "..."             (link checkout Paddle)
```
Rồi đóng gói lại và cập nhật.

---

## Sau khi được duyệt

- Link công khai: `https://chromewebstore.google.com/detail/<tên>/<id>`
- Số liệu lượt cài xem trong Developer Console, cập nhật hằng ngày
- Muốn cập nhật: sửa `version` trong `manifest.json` (ví dụ `1.0.0` → `1.0.1`), đóng gói lại, upload

## Đóng gói lại sau khi sửa code

```bash
cd ~/chrome-extensions
rm -f page-to-markdown.zip
cd page-to-markdown && zip -qr ../page-to-markdown.zip . -x "node_modules/*" "test/*" "*.md" ".*"
```
