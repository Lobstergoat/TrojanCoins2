"""Convert img/horse.png into data/horse.json (a grid of ASCII density characters).
Usage: python3 tools/make-horse-ascii.py [cols]"""
import json, sys
from collections import deque
from PIL import Image, ImageFilter

COLS = int(sys.argv[1]) if len(sys.argv) > 1 else 190
RAMP = " .,:;-=+*#%@"
im = Image.open("img/horse.png").convert("RGB")
im = im.crop((4, 4, im.width - 4, im.height - 4))
W, H = im.size
px = im.load()

# background = flat grey, flood-filled from the edges so horse highlights are never lost
def is_bg(c): return abs(c[0] - 178) < 26 and abs(c[1] - 178) < 26 and abs(c[2] - 178) < 26
bg = [[False] * W for _ in range(H)]
q = deque((x, y) for x in range(W) for y in (0, H - 1)); q.extend((x, y) for y in range(H) for x in (0, W - 1))
while q:
    x, y = q.popleft()
    if x < 0 or y < 0 or x >= W or y >= H or bg[y][x] or not is_bg(px[x, y]): continue
    bg[y][x] = True
    q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

lum = im.convert("L").filter(ImageFilter.GaussianBlur(0.6))
lp = lum.load()
soft = im.convert('L').filter(ImageFilter.GaussianBlur(7)).load()  # local contrast reveals the face and muscle
vals = sorted(lp[x, y] for y in range(H) for x in range(W) if not bg[y][x])
lo, hi = vals[int(len(vals) * .10)], vals[int(len(vals) * .985)]

cw = W / COLS; ch = cw / 0.56
ROWS = int(H / ch)
out = []
for r in range(ROWS):
    line = ""
    for c in range(COLS):
        x0, x1, y0, y1 = int(c * cw), max(int(c * cw) + 1, int((c + 1) * cw)), int(r * ch), max(int(r * ch) + 1, int((r + 1) * ch))
        s = n = k = 0
        for y in range(y0, min(H, y1)):
            for x in range(x0, min(W, x1)):
                k += 1
                if not bg[y][x]: n += 1; s += lp[x, y] + 1.6 * (lp[x, y] - soft[x, y])
        if k == 0 or n < k * 0.45: line += " "; continue
        v = (s / n - lo) / max(1, hi - lo)
        v = min(1, max(0, v))
        b = 0.24 + 0.76 * (v ** 0.95)          # keep dark parts (legs, mane) visible as a silhouette
        line += RAMP[min(len(RAMP) - 1, int(b * (len(RAMP) - 1) + 0.5))]
    out.append(line.rstrip())
json.dump({"cols": COLS, "rows": ROWS, "lines": out}, open("data/horse.json", "w"))
print("\n".join(out))
