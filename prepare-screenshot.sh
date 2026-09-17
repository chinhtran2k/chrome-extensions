#!/usr/bin/env bash
# Chuẩn hoá ảnh chụp màn hình cho Chrome Web Store.
#
# Google đòi đúng 1280x800 (hoặc 640x400), PNG 24-bit KHÔNG alpha. Ảnh chụp
# trên macOS là 32-bit có alpha và kích thước tuỳ ý, nên upload thẳng sẽ bị
# từ chối mà thông báo lỗi không nói rõ lý do.
#
#   ./prepare-screenshot.sh ~/Desktop/anh.png
#
# Kết quả: upload-assets/screenshot-1.png
set -euo pipefail

src="${1:?Cách dùng: ./prepare-screenshot.sh <đường-dẫn-ảnh>}"
[ -f "$src" ] || { echo "Không thấy file: $src" >&2; exit 1; }

out_dir="$(cd "$(dirname "$0")" && pwd)/upload-assets"
mkdir -p "$out_dir"

# Đánh số để chụp nhiều ảnh không ghi đè nhau.
n=1
while [ -f "$out_dir/screenshot-$n.png" ]; do n=$((n + 1)); done
out="$out_dir/screenshot-$n.png"

# sips có sẵn trên mọi máy Mac, không cần cài gì.
# -Z giữ tỷ lệ; phần thừa được nền trắng lấp cho đủ 1280x800.
tmp="$(mktemp -t cws).png"
sips -s format png "$src" --out "$tmp" >/dev/null
sips -Z 1280 "$tmp" --out "$tmp" >/dev/null
sips -p 800 1280 --padColor FFFFFF "$tmp" --out "$tmp" >/dev/null

# Bỏ kênh alpha: ghép lên nền trắng rồi lưu lại không alpha.
python3 - "$tmp" "$out" <<'PY'
import sys, struct, zlib
src, dst = sys.argv[1], sys.argv[2]

def read_png(path):
    data = open(path, "rb").read()
    pos, idat, w = 8, b"", None
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos+4])[0]
        tag = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if tag == b"IHDR":
            w, h, depth, color = struct.unpack(">IIBB", chunk[:10])
        elif tag == b"IDAT":
            idat += chunk
        pos += 12 + ln
    return w, h, depth, color, zlib.decompress(idat)

w, h, depth, color, raw = read_png(src)
channels = {0: 1, 2: 3, 4: 2, 6: 4}[color]
stride = w * channels + 1

# Undo the PNG row filters, then drop alpha onto white.
prev = bytearray(w * channels)
rows = []
for y in range(h):
    f = raw[y*stride]
    line = bytearray(raw[y*stride+1:(y+1)*stride])
    bpp = channels
    for i in range(len(line)):
        a = line[i-bpp] if i >= bpp else 0
        b = prev[i]
        c = prev[i-bpp] if i >= bpp else 0
        if f == 1: line[i] = (line[i] + a) & 255
        elif f == 2: line[i] = (line[i] + b) & 255
        elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
        elif f == 4:
            p = a + b - c
            pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
            pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
            line[i] = (line[i] + pr) & 255
    prev = line
    rows.append(bytes(line))

out_rows = []
for line in rows:
    row = bytearray([0])
    for x in range(w):
        px = line[x*channels:(x+1)*channels]
        if channels == 4:
            r, g, b, al = px
            k = al / 255
            row += bytes((round(r*k + 255*(1-k)), round(g*k + 255*(1-k)), round(b*k + 255*(1-k))))
        elif channels == 3:
            row += px
        elif channels == 2:
            v, al = px; k = al / 255
            v = round(v*k + 255*(1-k)); row += bytes((v, v, v))
        else:
            row += bytes((px[0], px[0], px[0]))
    out_rows.append(bytes(row))

def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))   # colour type 2 = RGB, no alpha
       + chunk(b"IDAT", zlib.compress(b"".join(out_rows), 9))
       + chunk(b"IEND", b""))
open(dst, "wb").write(png)
PY
rm -f "$tmp"

echo "Xong: $out"
sips -g pixelWidth -g pixelHeight -g hasAlpha "$out" | sed 's/^/  /'
