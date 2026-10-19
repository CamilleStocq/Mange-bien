"""Génère les icônes de l'app à partir du dessin de Camille (assets/icone-dessin.jpg).

Le dessin est centré sur un carré dont le fond reprend le bleu du dessin.
Usage : python scripts/icons-from-drawing.py
"""
from PIL import Image, ImageStat

SRC = 'assets/icone-dessin.jpg'
src = Image.open(SRC).convert('RGB')
w, h = src.size

# Couleur de fond : moyenne des bords du dessin (le bleu du papier)
edges = [src.crop((0, 0, w, 24)), src.crop((0, h - 24, w, h)), src.crop((0, 0, 24, h)), src.crop((w - 24, 0, w, h))]
bg = tuple(round(sum(ImageStat.Stat(e).mean[i] for e in edges) / len(edges)) for i in range(3))


def square(size: int, fill: float) -> Image.Image:
    """Dessin entier, centré, occupant `fill` de la hauteur du carré."""
    # Fond : le papier du dessin (bandes de bord répétées), pour éviter une couture avec un aplat
    paper = src.resize((round(w * size / h), size), Image.LANCZOS)
    strip_l, strip_r = paper.crop((0, 0, 12, size)), paper.crop((paper.width - 12, 0, paper.width, size))
    canvas = Image.new('RGB', (size, size), bg)
    for x in range(0, size // 2 + 12, 12):
        canvas.paste(strip_l, (x, 0))
    for x in range(size // 2, size, 12):
        canvas.paste(strip_r, (x, 0))
    target_h = round(size * fill)
    target_w = round(w * target_h / h)
    art = src.resize((target_w, target_h), Image.LANCZOS)
    if fill < 1:  # icône Android : marge haut et bas en papier aussi
        canvas.paste(Image.new('RGB', (size, size), bg), (0, 0))
    canvas.paste(art, ((size - target_w) // 2, (size - target_h) // 2))
    return canvas


square(192, 1.0).save('public/icons/icon-192.png', optimize=True)
square(512, 1.0).save('public/icons/icon-512.png', optimize=True)
square(512, 0.78).save('public/icons/icon-maskable-512.png', optimize=True)  # zone sûre Android
square(180, 1.0).save('public/icons/apple-touch-icon.png', optimize=True)
square(64, 1.0).save('public/favicon.png', optimize=True)
print('Icônes générées depuis', SRC, '— fond', '#%02x%02x%02x' % bg)
