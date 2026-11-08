# A helper for the storage models (#367), not a model itself (scripts/models.mjs --export skips files
# starting with "_"): a cargo crate of grained composite with recessed panels, corner posts and bands
# in another colour, on skids, with a hazard label and a stencilled code on its front.


def crate(m, p, size, c="composite", trim="accent", label=True, skids=True, omit_bottom=True):
    """A crate whose bottom centre is p = (x, y, z), size (w, h, d)."""
    x, y, z = p
    w, h, d = size
    sk = 0.06 if skids else 0.0
    if skids:
        for k in (-1, 1):
            m.box([x + k * (w / 2 - 0.1), y + sk / 2, z], [0.12, sk, d - 0.04], "dark", omit=("bottom",))
    body = m.box([x, y + sk + (h - sk) / 2, z], [w - 0.04, h - sk, d - 0.04], c, omit=("bottom",) if omit_bottom else (), tex="grain")
    for s in ("front", "left", "right", "top", "back"):
        faces = m.side(body, s)
        if faces:
            m.inset(faces, 0.07, 0.025)
    for kx in (-1, 1):
        for kz in (-1, 1):
            m.box([x + kx * (w / 2 - 0.04), y + sk + (h - sk) / 2, z + kz * (d / 2 - 0.04)], [0.08, h - sk, 0.08], trim, omit=("bottom",))
    if label:
        fy = y + sk + (h - sk) * 0.55
        m.box([x, fy, z + d / 2 - 0.035], [min(0.4, w * 0.4), 0.2, 0.01], "hazard", omit=("back",))
        m.box([x, fy, z + d / 2 - 0.028], [min(0.26, w * 0.26), 0.07, 0.006], "dark", omit=("back",))
        for k in range(3):
            m.box([x - 0.08 + k * 0.08, fy - 0.2, z + d / 2 - 0.03], [0.06, 0.06, 0.006], "dark", omit=("back",))
