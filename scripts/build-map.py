"""
Build the founding map's images from real Mars data (#499), in place of the height-coloured relief:

    python3 scripts/build-map.py path/to/Mars_Viking_ClrMosaic_global_925m.tif path/to/megt90n000fb.img

Sources (public domain, not kept in the repo):
- USGS Astrogeology's Viking colour mosaic of Mars, 925 m a pixel (about 64 px a degree):
  https://planetarymaps.usgs.gov/mosaic/Mars_Viking_ClrMosaic_global_925m.tif (798 MB). Simple cylindrical,
  longitude -180 at its left edge.
- NASA's MOLA MEGDR 32 px/degree grid, MEGT90N000FB.IMG from the PDS Geosciences Node:
  https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg032/megt90n000fb.img (133 MB):
  11520 × 5760 big-endian int16 metres, rows from 90°N south, columns from 0°E east.

Needs Python 3 with numpy and Pillow, and GDAL's gdal_translate (to read and average the mosaic).

Writes, all with longitude 0 at the left edge and north at the top:
- data/mars-relief.jpg: the whole planet, 4096 × 2048, the mosaic's colour shaded by MOLA's relief (the web's
  map and Godot's globe both wear it).
- public/map/tiles/<row>_<col>.jpg: the same at 32 px a degree in 15° squares (12 rows from the north, 24
  columns from 0°E), 480 px each, fetched as the globe zooms in.
- public/map/height.png: MOLA's heights at 4 px a degree, 8-bit from HEIGHT_MIN to HEIGHT_MAX metres, for the
  globe's relief.
- data/mars-soil.json: the mosaic's colour, unshaded, on a 2° grid, for each site's ground (sim/map.ts soilAt).
"""
import base64
import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 11520, 5760  # 32 px a degree
BASE = (4096, 2048)
TILE_DEG = 15
TILE_PX = TILE_DEG * 32
HEIGHT = (1440, 720)
HEIGHT_MIN, HEIGHT_MAX = -8500, 21500
SOIL_DEG = 2
# The relief's light: from the north-west and above; how strongly it shades the mosaic (which carries its own light already).
LIGHT = (-0.6, 0.6, 0.53)
SHADE = {"per_m": 1 / 260, "min": 0.62, "max": 1.3, "mix": 0.75}


def mosaic(path):
    """The colour mosaic at 32 px a degree, longitude 0 at the left."""
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "m.raw")
        subprocess.run(["gdal_translate", "-q", "-of", "ENVI", "-ot", "Byte", "-outsize", str(W), str(H), "-r", "average", "-co", "INTERLEAVE=BIP", path, raw], check=True)
        rgb = np.fromfile(raw, dtype=np.uint8).reshape(H, W, 3).astype(np.float32)
    return np.roll(rgb, W // 2, axis=1)


def mola(path):
    return np.fromfile(path, dtype=">i2").reshape(H, W).astype(np.float32)


def shade(height):
    """Hillshade: the surface's slope against the light, per pixel, with the ground's true size at each latitude."""
    lat = np.radians(90 - (np.arange(H) + 0.5) / H * 180)[:, None]
    px_m = 2 * math.pi * 3396190 / W
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) / (2 * px_m * np.maximum(0.05, np.cos(lat)))
    dy = (np.roll(height, 1, 0) - np.roll(height, -1, 0)) / (2 * px_m)
    dy[0] = dy[-1] = 0
    n = np.stack([-dx, -dy, np.ones_like(height)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    lx, ly, lz = LIGHT
    l = np.array([lx, ly, lz]) / math.sqrt(lx * lx + ly * ly + lz * lz)
    lit = (n @ l) / l[2]  # 1 on the flat
    s = np.clip(lit, SHADE["min"], SHADE["max"])
    return 1 + (s - 1) * SHADE["mix"]


def save(img, path, quality=86):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(path, quality=quality, optimize=True, progressive=True)


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    colour = mosaic(sys.argv[1])
    height = mola(sys.argv[2])
    lit = colour * shade(height)[..., None]

    # The whole planet.
    base = Image.fromarray(np.clip(lit, 0, 255).astype(np.uint8)).resize(BASE, Image.Resampling.BOX)
    base.save(os.path.join(ROOT, "data", "mars-relief.jpg"), quality=86, optimize=True, progressive=True)

    # The tiles.
    tiles = os.path.join(ROOT, "public", "map", "tiles")
    for row in range(180 // TILE_DEG):
        for col in range(360 // TILE_DEG):
            y0, x0 = row * TILE_PX, col * TILE_PX
            save(lit[y0 : y0 + TILE_PX, x0 : x0 + TILE_PX], os.path.join(tiles, f"{row}_{col}.jpg"), quality=78)

    # The heights, for the relief.
    small = height.reshape(HEIGHT[1], H // HEIGHT[1], HEIGHT[0], W // HEIGHT[0]).mean(axis=(1, 3))
    h8 = np.clip((small - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN) * 255, 0, 255).round().astype(np.uint8)
    Image.fromarray(h8, "L").save(os.path.join(ROOT, "public", "map", "height.png"), optimize=True)

    # The soil's colour: the mosaic unshaded, averaged over 2° cells.
    k = SOIL_DEG * 32
    cells = colour.reshape(H // k, k, W // k, k, 3).mean(axis=(1, 3)).round().astype(np.uint8)
    soil = {
        "_note": "Each site's ground colour (#499): the Viking colour mosaic of Mars, unshaded, averaged over 2° cells; rows from 90°N south, columns from 0°E east, RGB bytes in base64. Made by scripts/build-map.py.",
        "degreesPerCell": SOIL_DEG,
        "width": cells.shape[1],
        "height": cells.shape[0],
        "rgb": base64.b64encode(cells.tobytes()).decode(),
    }
    with open(os.path.join(ROOT, "data", "mars-soil.json"), "w") as f:
        json.dump(soil, f, indent=1)
        f.write("\n")
    print("wrote data/mars-relief.jpg, public/map/tiles/, public/map/height.png and data/mars-soil.json")


main()
