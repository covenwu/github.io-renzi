"""生成 PWA 图标：橙底白字「字」。运行一次即可。"""
from PIL import Image, ImageDraw, ImageFont

for size in (192, 512):
    img = Image.new("RGB", (size, size), "#e8604c")
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", int(size * 0.6))
    bbox = d.textbbox((0, 0), "字", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), "字",
           font=font, fill="white")
    img.save(f"icons/icon-{size}.png")
    print(f"icons/icon-{size}.png")
