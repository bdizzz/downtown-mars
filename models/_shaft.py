# A helper for the elevator models (#367), not a model itself (scripts/models.mjs --export skips files
# starting with "_"): the shaft both share, 2.4 m square and 4 m tall. Brushed corner posts, a dark
# back wall with two guide rails, frosted side panes in frames, accent sills at the landing, a hazard
# tread floor and the hoist cables.


def shaft(m, cables=True):
    for x in (-1.15, 1.15):
        for z in (-1.15, 1.15):
            m.box([x, 2.0, z], [0.1, 4.0, 0.1], "metal", bevel=0.015, edges="vertical", tex="brushed")
    m.box([0, 2.0, -1.18], [2.2, 4.0, 0.04], "dark", omit=("back",))
    for x in (-0.9, 0.9):
        m.box([x, 2.0, -1.13], [0.1, 4.0, 0.03], "steel", omit=("back",), tex="brushed")
        m.box([x, 2.0, -1.09], [0.025, 4.0, 0.06], "steel", omit=("back",), tex="brushed")
        for y in (0.6, 2.0, 3.4):
            m.box([x, y, -1.13], [0.16, 0.08, 0.05], "dark")
    for x in (-1.15, 1.15):
        m.box([x, 2.0, 0], [0.03, 3.9, 2.2], "mirror")
        for y in (1.0, 2.0, 3.0):
            m.box([x, y, 0], [0.05, 0.05, 2.2], "metal", tex="brushed")
    # The landing: sills, a header and the floor.
    m.box([0, 0.04, 1.15], [2.2, 0.08, 0.1], "accent", omit=("bottom",), tex="tread")
    m.box([0, 3.96, 1.15], [2.2, 0.08, 0.1], "accent")
    m.box([0, 3.88, 1.17], [1.6, 0.06, 0.03], "hazard", omit=("back",))
    m.box([0, 0.03, -0.02], [2.2, 0.06, 2.24], "hazard", omit=("bottom",), tex="tread")
    if cables:
        for x in (-0.12, 0.0, 0.12):
            m.cyl([x, 2.4, -0.4], 0.02, 3.2, "dark", seg=4, caps=False)
