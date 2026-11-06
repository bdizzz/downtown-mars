# The farm's crops (#365), shared by the planter beds and hydroponic racks, one script per item
# (planter_bed.py, hydroponic_rack_wheat.py...). Not a model itself: scripts/models.mjs skips files
# starting with "_". Each plant is a handful of cheap shapes (blades seg 1, three- to six-sided
# stalks and lathes), so a bed of ten or a rack of thirty stays under the 800-triangle budget.
# Positions jitter by a fixed hash, so every export is the same.
import math


def jitter(i, j, k=0):
    """A fixed pseudo-random number in [-1, 1] for plant (i, j), draw k."""
    h = math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453
    return (h - math.floor(h)) * 2 - 1


def _lean(dx, dy, dz):
    """The turn [x, 0, z] (degrees) that points a y-up shape along (dx, dy, dz)."""
    n = math.sqrt(dx * dx + dy * dy + dz * dz)
    dx, dy, dz = dx / n, dy / n, dz / n
    return [math.degrees(math.atan2(dz, dy)), 0, -math.degrees(math.asin(max(-1, min(1, dx))))]


def stalk(m, base, d, length, width, c, seg=3, ear=None):
    """A stalk from base along d, `width` across; with ear = (colour, length, width, bend), an ear on its tip."""
    n = math.sqrt(sum(v * v for v in d))
    d = [v / n for v in d]
    mid = [base[k] + d[k] * length / 2 for k in range(3)]
    m.cyl(mid, width, length, c, seg=seg, caps=False, r=_lean(*d), d2=width * 0.7)
    if ear:
        ec, el, ew, bend = ear
        tip = [base[k] + d[k] * length for k in range(3)]
        e = [d[0] * (1 - bend) + (0.3 if d[0] >= 0 else -0.3) * bend, d[1] * (1 - bend) - 0.6 * bend, d[2] * (1 - bend) + 0.5 * bend]
        n = math.sqrt(sum(v * v for v in e))
        e = [v / n for v in e]
        m.cyl([tip[k] + e[k] * el / 2 for k in range(3)], ew, el, ec, seg=4, caps=False, r=_lean(*e), d2=ew * 0.35)


# ---- one plant each, centred on (x, y, z) at the soil, s its scale (1 in a bed) ---------------------

def bush(m, x, y, z, s, c, i, j, seg=5, h=0.2, w=0.17):
    """A low, faceted mound of foliage (a lathe), turned a little at random."""
    m.lathe([x, y, z], [(0.06 * s, 0), (w * s, h * 0.4 * s), (w * 0.8 * s, h * 0.8 * s), (0, h * s)], c, seg=seg, r=[0, 60 * jitter(i, j, 30), 0])


def greens(m, x, y, z, s, i, j, rich=True):
    """A head of leafy greens: a turned rosette, outer leaves curling out round it."""
    bush(m, x, y, z, s, "plant", i, j, h=0.19, w=0.16)
    for k in range(2 if rich else 0):
        yaw = k * 180 + 40 * jitter(i, j, k)
        m.blade([x, y + 0.05 * s, z], yaw, 30, 0.2 * s, 0.14 * s, "leaf", droop=0.05 * s, seg=1)


def potato(m, x, y, z, s, i, j, rich=True):
    """A potato plant: a bush of broad leaves on a ridge, sometimes a white flower."""
    bush(m, x, y, z, s, "potato", i, j, h=0.26, w=0.2)
    if rich:
        for k in range(2):
            m.blade([x, y + 0.12 * s, z], k * 180 + 40 * jitter(i, j, k), 25, 0.22 * s, 0.13 * s, "leaf", droop=0.06 * s, seg=1)
        if (i + j) % 2:
            m.cyl([x + 0.04 * s, y + 0.26 * s, z], 0.05 * s, 0.025 * s, "flower", seg=4)


def soy(m, x, y, z, s, i, j, rich=True):
    """A soybean bush: a stem, a crown of leaves, pods hanging under it."""
    if rich:
        m.cyl([x, y + 0.09 * s, z], 0.025 * s, 0.18 * s, "plant", seg=4, caps=False)
    bush(m, x, y + (0.12 if rich else 0.0) * s, z, s, "soy", i, j, h=0.24, w=0.18)
    if rich:
        m.blade([x, y + 0.3 * s, z], 360 * jitter(i, j, 7), 55, 0.16 * s, 0.11 * s, "leaf", seg=1)
        for k in (0, 1):
            a = math.radians(k * 180 + 60 * jitter(i, j, k + 3))
            m.blade([x + 0.13 * s * math.cos(a), y + 0.17 * s, z + 0.13 * s * math.sin(a)], k * 180 + 40, -70, 0.1 * s, 0.04 * s, "stalk", seg=1)


def grain(ear, nod):
    """Wheat or barley: a clump of stalks, each with its ear (barley's nod)."""
    def plant(m, x, y, z, s, i, j, rich=True):
        n = 3 if rich else 2
        for k in range(n):
            a = math.radians(k * 360 / n + 50 * jitter(i, j, k))
            lean = 0.12 + 0.06 * jitter(i, j, k + 4)
            h = (0.55 + 0.06 * jitter(i, j, k + 8)) * s
            stalk(m, [x + 0.02 * s * math.cos(a), y, z + 0.02 * s * math.sin(a)], [lean * math.cos(a), 1, lean * math.sin(a)], h, 0.016 * s, "stalk", ear=(ear, 0.12 * s, 0.05 * s, nod))
    return plant


def hemp(m, x, y, z, s, i, j, rich=True):
    """Fibre hemp: a tall bare stalk, a fan of narrow leaves near the top, a pointed tip."""
    h = (0.8 + 0.08 * jitter(i, j)) * s
    m.cyl([x, y + h / 2, z], 0.025 * s, h, "hemp", seg=3, caps=False, d2=0.012 * s)
    n = 5 if rich else 3
    for k in range(n):
        yaw = k * 360 / n + 30 * jitter(i, j, k)
        m.blade([x, y + h * (0.72 if k % 2 else 0.84), z], yaw, 20, 0.26 * s, 0.06 * s, "hempLeaf", droop=0.08 * s, seg=1)
    m.blade([x, y + h * 0.95, z], 90 * jitter(i, j, 6), 80, 0.14 * s, 0.05 * s, "hempLeaf", seg=1)


def mushrooms(m, x, y, z, s, i, j, rich=True):
    """A block of dark substrate with a cluster of mushrooms, stems pale, caps brown."""
    m.box([x, y + 0.08 * s, z], [0.32 * s, 0.16 * s, 0.28 * s], "substrate", omit=("bottom",), r=[0, 15 * jitter(i, j), 0])
    for k in range(2 if rich else 1):
        a = math.radians(k * 180 + 40 * jitter(i, j, k))
        big = 1.3 + 0.4 * jitter(i, j, k + 3)
        px, pz = x + 0.07 * s * math.cos(a) * rich, z + 0.06 * s * math.sin(a) * rich
        top = y + 0.16 * s + 0.06 * s * big
        m.cyl([px, y + 0.16 * s + 0.03 * s * big, pz], 0.025 * s, 0.06 * s * big, "mushroom", seg=4, caps=False)
        m.lathe([px, top, pz], [(0.055 * s * big, 0), (0.045 * s * big, 0.025 * s * big), (0, 0.036 * s * big)], "cap", seg=5)


PLANTS = {
    "leafyGreens": greens,
    "potatoes": potato,
    "soybeans": soy,
    "wheat": grain("wheat", 0.0),
    "barley": grain("barley", 0.55),
    "hemp": hemp,
    "mushrooms": mushrooms,
}

# Plants per row and rows, in a bed and on each rack shelf (two channels), by crop.
BED_GRID = {"leafyGreens": (5, 2), "potatoes": (5, 2), "soybeans": (4, 2), "wheat": (6, 2), "barley": (6, 2), "hemp": (4, 2), "mushrooms": (4, 2)}
RACK_GRID = {"leafyGreens": (3, 2), "potatoes": (3, 2), "soybeans": (3, 2), "wheat": (3, 2), "barley": (3, 2), "hemp": (2, 2), "mushrooms": (3, 2)}


def plant_rows(m, crop, w, d, y, s, grid, rich):
    cols, rows = grid
    plant = PLANTS[crop]
    for i in range(cols):
        for j in range(rows):
            x = -w / 2 + w / cols * (i + 0.5) + (w / cols * 0.25 if j % 2 else 0) - w / cols * 0.125
            z = -d / 2 + d / rows * (j + 0.5)
            plant(m, x + 0.02 * jitter(i, j, 20), y, z + 0.02 * jitter(i, j, 21), s, i, j, rich)


# ---- the beds and racks --------------------------------------------------------------------------

def planter_bed(crop):
    """A raised bed (#365): a grained composite box with inset panels, a rim in the room's colour, soil,
    a drip line with a valve, a plant label; two posts holding a hood with a recessed grow light
    (a misting bar for mushrooms, which grow dark). Algae grow in a glass trough instead."""
    def fp(m):
        if crop == "algae":
            body = m.box([0, 0.29, 0], [2.56, 0.58, 1.06], "mirror", omit=("bottom",))
            for sx in (-1, 1):
                for sz in (-1, 1):
                    m.box([sx * 1.27, 0.3, sz * 0.54], [0.06, 0.6, 0.06], "metal", omit=("bottom",), tex="brushed")
            m.box([0, 0.06, 0], [2.6, 0.12, 1.1], "dark", omit=("bottom",))
            m.box([0, 0.585, 0], [2.48, 0.01, 0.98], "algae", omit=("bottom", "left", "right", "front", "back"))
            m.box([0.1, 0.6, 0], [1.9, 0.04, 0.03], "white", omit=("bottom",))  # the raceway's divider
            # A paddle wheel at one end, stirring.
            m.cyl([-1.05, 0.62, 0], 0.06, 0.9, "steel", seg=6, r=[90, 0, 0], tex="brushed")
            for a in (0, 45, 90, 135):
                m.box([-1.05, 0.62, 0.22], [0.28, 0.025, 0.36], "accent", r=[0, 0, a], omit=())
            for i in range(16):
                bx = -0.8 + 1.8 * (i / 15) + 0.05 * jitter(i, 1)
                bz = (0.25 if i % 2 else -0.25) + 0.12 * jitter(i, 2)
                rr = 0.018 + 0.01 * jitter(i, 3)
                m.lathe([bx, 0.585, bz], [(0, 0), (rr, rr), (0, rr * 1.6)], "white", seg=5)
        else:
            body = m.box([0, 0.29, 0], [2.56, 0.58, 1.06], "panel", omit=("bottom",), tex="grain")
            for p in m.split(m.side(body, "front")[0], 4, "right"):
                m.inset([p], 0.04, 0.012)
            m.box([0, 0.58, 0], [2.44, 0.02, 0.96], "substrate" if crop == "mushrooms" else "soil", omit=("bottom", "left", "right", "front", "back"))
        # The rim, in the room's colour.
        for sz in (-1, 1):
            m.box([0, 0.61, sz * 0.535], [2.6, 0.05, 0.08], "accent", bevel=0.01, edges="top", omit=("bottom",))
        for sx in (-1, 1):
            m.box([sx * 1.26, 0.61, 0], [0.08, 0.05, 0.99], "accent", omit=("bottom", "front", "back"))
        if crop != "algae":
            plant_rows(m, crop, 2.3, 0.86, 0.59, 1.0, BED_GRID[crop], True)
            # The drip line along the front, its valve, and a label stake.
            m.cyl([0, 0.605, 0.44], 0.025, 2.36, "rubber", seg=5, caps=False, r=[0, 0, 90])
            m.cyl([1.19, 0.63, 0.44], 0.05, 0.04, "hazard", seg=6, r=[90, 0, 0])
            m.box([-1.08, 0.66, 0.4], [0.1, 0.07, 0.006], "white", r=[-15, 0, 0], omit=("back",))
            m.box([-1.08, 0.61, 0.4], [0.01, 0.06, 0.006], "white", omit=("back", "top", "bottom"))
        # Posts and the hood.
        for sx in (-1, 1):
            m.cyl([sx * 1.25, 1.58, 0], 0.05, 1.94, "metal", seg=6, caps=False, tex="brushed")
            m.box([sx * 1.25, 2.53, 0], [0.08, 0.1, 0.08], "dark")
        hood = m.box([0, 2.56, 0], [2.6, 0.07, 0.3], "dark", tex="brushed")
        if crop == "mushrooms":
            m.cyl([0, 2.5, 0], 0.03, 2.3, "steel", seg=5, caps=False, r=[0, 0, 90])
            for x in (-0.8, 0, 0.8):
                m.cyl([x, 2.47, 0], 0.03, 0.04, "white", seg=5, d2=0.015)
        else:
            m.inset(m.side(hood, "bottom"), 0.03, 0.008, "grow", glow=True)

    return fp


def hydroponic_rack(crop):
    """A hydroponic rack (#365): brushed posts, three shelves each a tray holding two channels of plants
    under a recessed grow light (none for mushrooms; algae in glass tubes instead), a supply pipe up
    the back with a feed to each shelf, and a reservoir underneath in the room's colour."""
    def fp(m):
        for sx in (-1, 1):
            for sz in (-1, 1):
                m.box([sx * 0.95, 1.25, sz * 0.295], [0.045, 2.5, 0.045], "metal", omit=("bottom",), tex="brushed")
        for k, y in enumerate((0.3, 1.1, 1.9)):
            m.box([0, y, 0], [1.86, 0.05, 0.6], "white", omit=("left", "right"))
            if crop == "algae":
                for z in (-0.15, 0.0, 0.15):
                    m.cyl([0, y + 0.08, z], 0.1, 1.8, "algae", seg=6, r=[0, 0, 90])
                    m.cyl([0, y + 0.08, z], 0.11, 0.03, "metal", seg=6, r=[0, 0, 90], caps=False)
                for i in range(4):
                    m.lathe([-0.6 + 0.4 * i + 0.06 * jitter(i, k), y + 0.11, 0.15 * (i % 3 - 1)], [(0, 0), (0.012, 0.012), (0, 0.022)], "white", seg=4)
            else:
                for z in (-0.13, 0.13):
                    m.box([0, y + 0.055, z], [1.8, 0.06, 0.17], "white", omit=("bottom", "left", "right", "back" if z > 0 else "front"))
                plant_rows(m, crop, 1.7, 0.52, y + 0.085, 0.5 if crop == "hemp" else 0.75, RACK_GRID[crop], False)
            if crop != "mushrooms":
                lamp = m.box([0, y + 0.6, 0], [1.8, 0.035, 0.26], "dark", omit=("top",) if k < 2 else ())
                m.inset(m.side(lamp, "bottom"), 0.025, 0.006, "grow", glow=True)
        m.cyl([0.88, 1.2, -0.27], 0.04, 2.3, "water" if crop != "algae" else "algae", seg=6, caps=False)
        m.box([0, 0.12, 0], [1.5, 0.22, 0.5], "accent", omit=("bottom",))
        m.cyl([0.3, 0.24, 0.1], 0.12, 0.03, "dark", seg=6)  # the reservoir's cap

    return fp
