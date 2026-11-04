# The family photos (#364), first person: five frames hung together, each a moulded frame in
# fibre composite, dark or copper round a mat and a picture set in, some a little crooked.
# Run: blender -b --factory-startup -P models/family_photos.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

# (centre x, y, width, height, frame, picture, tilt)
FRAMES = (
    (-0.36, 0.5, 0.26, 0.32, "fibre", "water", 2),
    (-0.02, 0.53, 0.34, 0.26, "dark", "cream", 0),
    (0.33, 0.45, 0.24, 0.3, "copper", "plant", -3),
    (-0.2, 0.18, 0.3, 0.2, "dark", "rust", 0),
    (0.16, 0.14, 0.22, 0.16, "fibre", "glow", 4),
)


def fp(m):
    for x, y, w, h, frame, pic, tilt in FRAMES:
        f = m.box([x, y, 0], [w, h, 0.028], frame, bevel=0.006, edges="all", r=[0, 0, tilt], omit=("back",), tex="grain" if frame == "fibre" else None)
        m.inset(m.side(f, "front"), 0.02, 0.006, "cream")
        m.box([x, y, 0.012], [w - 0.08, h - 0.08, 0.004], pic, r=[0, 0, tilt], omit=("back",))


build("family_photos", fp)
