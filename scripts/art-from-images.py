"""Illustrations de l'app à partir des images de Camille, fond retiré.

- assets/ustensiles.jpg (fond blanc)      → public/art/ustensiles.webp (en-tête de la page Repas)
- assets/fruits.jpg     (fond vert foncé) → public/art/fruits.webp     (accueil, bienvenue, écrans vides)
Usage : python scripts/art-from-images.py
"""
from PIL import Image, ImageFilter


def cutout(src: str, out: str, low: int, high: int, size: int) -> None:
    img = Image.open(src).convert('RGB')
    bg = img.getpixel((8, 8))  # couleur du fond, prise dans un coin
    mask = Image.new('L', img.size)
    px, mk = img.load(), mask.load()
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            d = max(abs(p[i] - bg[i]) for i in range(3))
            mk[x, y] = 0 if d < low else 255 if d > high else round((d - low) / (high - low) * 255)
    mask = mask.filter(ImageFilter.MedianFilter(3))
    res = img.convert('RGBA')
    res.putalpha(mask)
    res = res.crop(mask.getbbox())
    res.thumbnail((size, size), Image.LANCZOS)
    res.save(out, 'WEBP', quality=88, method=6)
    print(out, res.size, 'fond', '#%02x%02x%02x' % bg)


cutout('assets/ustensiles.jpg', 'public/art/ustensiles.webp', 10, 40, 520)
cutout('assets/fruits.jpg', 'public/art/fruits.webp', 14, 34, 720)
