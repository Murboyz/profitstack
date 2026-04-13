import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), 'icons')
os.makedirs(OUT_DIR, exist_ok=True)

BG = (11, 31, 58, 255)       # deep navy
PANEL = (20, 52, 92, 255)    # lighter navy
GREEN = (38, 208, 124, 255)  # bright green
WHITE = (245, 248, 252, 255)


def png_chunk(tag, data):
    return struct.pack('!I', len(data)) + tag + data + struct.pack('!I', zlib.crc32(tag + data) & 0xffffffff)


def save_png(path, width, height, pixels):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        start = y * width * 4
        raw.extend(pixels[start:start + width * 4])
    ihdr = struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0)
    data = b'\x89PNG\r\n\x1a\n'
    data += png_chunk(b'IHDR', ihdr)
    data += png_chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    data += png_chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)


def set_px(buf, size, x, y, color):
    if 0 <= x < size and 0 <= y < size:
        i = (y * size + x) * 4
        buf[i:i+4] = bytes(color)


def fill_rect(buf, size, x0, y0, x1, y1, color):
    for y in range(max(0, y0), min(size, y1)):
        for x in range(max(0, x0), min(size, x1)):
            set_px(buf, size, x, y, color)


def draw_icon(size):
    buf = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            set_px(buf, size, x, y, BG)

    pad = max(1, size // 12)
    fill_rect(buf, size, pad, pad, size - pad, size - pad, PANEL)

    # white top line
    fill_rect(buf, size, size // 5, size // 4, size - size // 5, size // 4 + max(1, size // 18), WHITE)

    # three green bars
    bar_w = max(2, size // 8)
    gap = max(2, size // 16)
    left = size // 4
    base = size - size // 4
    heights = [size // 5, size // 3, size // 2]
    for idx, h in enumerate(heights):
        x = left + idx * (bar_w + gap)
        fill_rect(buf, size, x, base - h, x + bar_w, base, GREEN)

    # white connector/check
    points = [
        (size // 4, size // 2),
        (size // 2 - size // 16, size // 2 + size // 10),
        (size - size // 4, size // 3),
    ]
    thickness = max(1, size // 24)
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for s in range(steps + 1):
            x = round(x0 + (x1 - x0) * s / steps)
            y = round(y0 + (y1 - y0) * s / steps)
            fill_rect(buf, size, x - thickness, y - thickness, x + thickness + 1, y + thickness + 1, WHITE)

    return buf


for size in (16, 32, 48, 128):
    save_png(os.path.join(OUT_DIR, f'icon-{size}.png'), size, size, draw_icon(size))
    print(f'Wrote icon-{size}.png')
