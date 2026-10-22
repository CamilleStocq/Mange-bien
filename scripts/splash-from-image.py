"""Page de chargement : les légumes de l'image de Camille (assets/icone-mange-bien.jpg), détourés.

On garde la partie dessinée (sans le bandeau « MANGE BIEN ! ») et on rend transparent le vert du fond,
pour poser les légumes sur le fond crème de la page de chargement.
Usage : python scripts/splash-from-image.py
"""
from PIL import Image, ImageFilter

SRC = 'assets/icone-mange-bien.jpg'
OUT = 'public/splash-legumes.webp'

src = Image.open(SRC).convert('RGB')
w, h = src.size
art = src.crop((0, 0, w, round(h * 0.755)))  # au-dessus du bandeau
bg = art.getpixel((6, 6))

def dist(p):
    return max(abs(p[i] - bg[i]) for i in range(3))

# Masque : transparent là où la couleur est celle du fond (avec un léger fondu sur les bords)
mask = Image.new('L', art.size)
px, mk = art.load(), mask.load()
for y in range(art.height):
    for x in range(art.width):
        d = dist(px[x, y])
        mk[x, y] = 0 if d < 14 else 255 if d > 34 else round((d - 14) / 20 * 255)
mask = mask.filter(ImageFilter.MedianFilter(3))
out = art.convert('RGBA')
out.putalpha(mask)
box = mask.getbbox()
out = out.crop(box)
out.thumbnail((900, 900), Image.LANCZOS)
out.save(OUT, 'WEBP', quality=88, method=6)
print('Légumes détourés :', OUT, out.size, 'fond retiré', '#%02x%02x%02x' % bg)
