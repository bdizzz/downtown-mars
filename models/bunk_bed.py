# The bunk bed (#357), first person (#360): round steel tube posts with capped tops, side rails
# and slats under two soft mattresses in the room's colour, cream blankets turned down with a
# folded hem, plump pillows, a guard rail on the top bunk, a ladder of round rungs hooked over
# the rail, a curtain in folds on rings along a rod, a clip-on reading lamp and a drawer under
# the bottom bunk. The proof of the first-person tier: drawn only in first person, up close.
# Run: blender -b --factory-startup -P models/bunk_bed.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

BUNKS = (0.34, 1.24)  # the frames' heights
POST_X, POST_Z = 0.955, 0.425
TUBE = 0.055  # the posts' and rails' diameter


def fp(m):
    # The posts: round tubes, a little cap on each top.
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl([sx * POST_X, 0.95, sz * POST_Z], TUBE, 1.86, "metal", seg=6, caps=False)
            m.cyl([sx * POST_X, 1.89, sz * POST_Z], TUBE + 0.012, 0.03, "dark", seg=6)
    for y in BUNKS:
        # The frame: rails round the bunk, round along the sides, flat at the ends; slats between.
        for sz in (-1, 1):
            m.cyl([0, y, sz * POST_Z], TUBE * 0.9, 2 * POST_X, "metal", seg=5, r=[0, 0, 90], caps=False)
        for sx in (-1, 1):
            m.box([sx * POST_X, y, 0], [0.04, 0.07, 2 * POST_Z], "metal", omit=("left", "right"))
        for i in range(3):
            m.box([-0.55 + i * 0.55, y + 0.02, 0], [0.09, 0.02, 0.82], "dark", omit=("bottom", "left", "right"))
        # The mattress, soft and rounded on top.
        m.box([0, y + 0.11, 0], [1.86, 0.16, 0.82], "accent", bevel=0.05, seg=2, edges="top", omit=("bottom",))
        # The blanket over the foot two-thirds, its hem turned back, and where it hangs down the front.
        m.box([0.27, y + 0.198, 0.015], [1.28, 0.022, 0.85], "cream", omit=("bottom",))
        m.box([-0.33, y + 0.215, 0.015], [0.1, 0.03, 0.86], "cream", bevel=0.014, edges="top", omit=("bottom",))
        m.box([0.27, y + 0.12, 0.437], [1.28, 0.17, 0.022], "cream", omit=("back", "bottom"))
        # The pillow, plump and a little turned.
        m.box([-0.7, y + 0.25, -0.02], [0.36, 0.11, 0.6], "white", bevel=0.045, seg=2, edges="top", r=[0, 4, -6], omit=("bottom",))
    # The guard rail along the top bunk's open side, and its two uprights.
    m.cyl([0.06, 1.6, POST_Z], 0.04, 1.3, "metal", seg=6, r=[0, 0, 90])
    for x in (-0.55, 0.6):
        m.cyl([x, 1.42, POST_Z], 0.03, 0.36, "metal", seg=6, caps=False)
    # The ladder at the foot: round rails hooked over the top rail, round rungs.
    for x in (0.72, 0.9):
        m.cyl([x, 0.84, 0.475], 0.04, 1.68, "metal", seg=6, caps=False)
        m.box([x, 1.69, 0.45], [0.035, 0.035, 0.07], "metal", omit=("left", "right", "bottom"))
    for y in (0.3, 0.64, 0.98, 1.32):
        m.cyl([0.81, y, 0.475], 0.03, 0.18, "metal", seg=5, r=[0, 0, 90], caps=False)
    # The curtain: a rod under the top bunk, rings along it, and a sheet in soft folds, half drawn.
    m.cyl([-0.45, 1.15, 0.47], 0.018, 1.0, "metal", seg=5, r=[0, 0, 90])
    folds = [(-0.92 + i * 0.09, 0.47 + (0.028 if i % 2 else -0.018)) for i in range(9)]
    m.strip(folds, 0.44, 1.13, 0.012, "accent")
    for i in range(0, 9, 4):
        m.cyl([folds[i][0], 1.15, 0.47], 0.04, 0.012, "steel", seg=4, r=[0, 0, 90])
    # A reading lamp clipped to the top bunk's post, over the bottom pillow.
    m.box([-0.93, 1.1, -0.38], [0.04, 0.05, 0.05], "dark")
    m.cyl([-0.86, 1.06, -0.33], 0.016, 0.16, "metal", seg=5, r=[30, 0, 55], caps=False)
    m.cyl([-0.78, 1.0, -0.28], 0.08, 0.07, "dark", seg=6, d2=0.04, caps=False)
    m.cyl([-0.78, 0.966, -0.28], 0.07, 0.006, "lamp", seg=6, glow=True)
    # A drawer under the bottom bunk, with a handle.
    m.box([0.1, 0.15, 0.05], [1.2, 0.24, 0.72], "fibre", omit=("bottom", "back"))
    m.box([0.1, 0.18, 0.42], [0.3, 0.03, 0.025], "dark", omit=("back",))


build("bunk_bed", fp)
