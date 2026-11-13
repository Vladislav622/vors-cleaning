# Ворс — генератор оригинальных моделей мягкой мебели для Blender 4.2+/5.x
# Запуск: Blender > Scripting > Open > Run Script (или blender -b -P generate_models.py -- <out_dir>)
# Все модели созданы этим скриптом с нуля и передаются вместе с исходниками (CC0 / собственность заказчика).
import bpy, bmesh, math, os, sys
from mathutils import Vector

OUT = None
if "--" in sys.argv:
    OUT = sys.argv[sys.argv.index("--") + 1]
OUT = OUT or globals().get("OUT_DIR") or os.path.join(os.path.expanduser("~"), "vors-models")
os.makedirs(OUT, exist_ok=True)

# ---------- utils ----------
def reset():
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for blk in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for d in list(blk):
            if d.users == 0:
                blk.remove(d)

def mat(name, rgb, rough=0.85, metal=0.0, sheen=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*srgb(rgb), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if sheen and "Sheen Weight" in b.inputs:
        b.inputs["Sheen Weight"].default_value = sheen
    m.diffuse_color = (*srgb(rgb), 1)
    return m

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def coll(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

def link(o, c):
    for uc in list(o.users_collection):
        uc.objects.unlink(o)
    c.objects.link(o)
    return o

def box(c, name, size, loc, material, bevel=0.04, seg=4, subsurf=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        m = o.modifiers.new("bev", "BEVEL"); m.width = bevel; m.segments = seg; m.limit_method = "NONE"
    if subsurf:
        s = o.modifiers.new("sub", "SUBSURF"); s.levels = subsurf; s.render_levels = subsurf
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return link(o, c)

def cyl(c, name, r, depth, loc, material, rot=(0, 0, 0), verts=24, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object; o.name = name
    if bevel:
        m = o.modifiers.new("bev", "BEVEL"); m.width = bevel; m.segments = 2; m.limit_method = "ANGLE"
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return link(o, c)

def sphere(c, name, r, loc, material, scale=(1, 1, 1), seg=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=rings)
    o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return link(o, c)

def tube(c, name, pts, radius, material, res=6):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = radius; cu.bevel_resolution = 3; cu.use_fill_caps = True; cu.resolution_u = res
    sp = cu.splines.new("NURBS"); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    sp.use_endpoint_u = True; sp.order_u = min(4, len(pts))
    o = bpy.data.objects.new(name, cu); c.objects.link(o)
    o.data.materials.append(material)
    return to_mesh(o)

def to_mesh(o):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    n = bpy.data.objects.new(o.name, me)
    for c in o.users_collection:
        c.objects.link(n)
    n.matrix_world = o.matrix_world.copy()
    bpy.data.objects.remove(o, do_unlink=True)
    for p in n.data.polygons:
        p.use_smooth = True
    return n

def apply_all(objs):
    for o in objs:
        if o.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)

def join(objs, name):
    apply_all(objs)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object; o.name = name; o.data.name = name
    return o

def set_origin(o, point):
    cur = bpy.context.scene.cursor.location.copy()
    bpy.context.scene.cursor.location = point
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = cur

def uv_unwrap(o, margin=0.02):
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")

# ---------- materials ----------
def palette():
    return dict(
        sofa=mat("Fabric_Sage", "#7FA39A", 0.9, sheen=0.5),
        sofa_dark=mat("Fabric_SageDeep", "#5F857C", 0.9, sheen=0.5),
        arm=mat("Fabric_Clay", "#CF8F70", 0.9, sheen=0.5),
        arm_dark=mat("Fabric_ClayDeep", "#B4765A", 0.9, sheen=0.5),
        matt=mat("Fabric_Ticking", "#EEE9E0", 0.95, sheen=0.3),
        matt_border=mat("Fabric_Border", "#8EA3B8", 0.9),
        piping=mat("Piping", "#55697E", 0.8),
        chair=mat("Fabric_Mustard", "#DDB25F", 0.9, sheen=0.5),
        pouf=mat("Fabric_Lilac", "#A897C6", 0.9, sheen=0.5),
        wood=mat("Wood_Oak", "#B98C5E", 0.55),
        metal=mat("Metal_Dark", "#3A3C40", 0.35, metal=0.8),
        eye=mat("Eye", "#1E2326", 0.25),
        glint=mat("EyeGlint", "#FFFFFF", 0.2),
        mouth=mat("Mouth", "#2A2F33", 0.5),
        cheek=mat("Cheek", "#F2A7A0", 0.9),
        hand=mat("Hand", "#F4EFE6", 0.85),
    )

# ---------- character parts ----------
def face(c, M, center, normal_y=-1, scale=1.0, cheeks=True):
    """Лицо на плоскости XZ, смотрит в -Y. center — точка на поверхности."""
    x, y, z = center
    s = scale
    off = 0.012 * s
    parts = []
    for side, nm in ((-1, "L"), (1, "R")):
        e = sphere(c, f"Face_Eye{nm}", 0.034 * s, (x + side * 0.085 * s, y - off, z + 0.02 * s), M["eye"], scale=(0.85, 0.45, 1.15))
        g = sphere(c, f"Face_Glint{nm}", 0.0095 * s, (x + side * 0.085 * s + 0.01 * s, y - off - 0.016 * s, z + 0.04 * s), M["glint"], seg=12, rings=6)
        g.parent = e; g.matrix_parent_inverse = e.matrix_world.inverted()
        parts += [e, g]
        if cheeks:
            ch = sphere(c, f"Face_Cheek{nm}", 0.026 * s, (x + side * 0.135 * s, y - off * 0.2, z - 0.03 * s), M["cheek"], scale=(1.2, 0.18, 0.75), seg=16, rings=8)
            parts.append(ch)
    pts = []
    for i in range(7):
        t = -0.5 + i / 6
        a = t * math.radians(80)
        pts.append((x + math.sin(a) * 0.045 * s, y - off * 0.8, z - 0.035 * s - math.cos(a) * 0.022 * s + 0.022 * s))
    mo = tube(c, "Face_Mouth", pts, 0.0065 * s, M["mouth"])
    parts.append(mo)
    return parts

def arm(c, M, name, shoulder, direction, length=0.22, r=0.026, droop=0.35, sleeve=None):
    """Рука-трубка с перчаткой-варежкой и большим пальцем. Origin — плечо (для вращения в three.js)."""
    sx, sy, sz = shoulder
    d = direction  # -1 left, +1 right
    p0 = (sx - d * 0.01, sy, sz)
    p1 = (sx + d * length * 0.45, sy - 0.02, sz - length * droop * 0.3)
    p2 = (sx + d * length * 0.8, sy - 0.05, sz - length * droop * 0.85)
    p3 = (sx + d * length, sy - 0.07, sz - length * droop)
    t = tube(c, name + "_tube", [p0, p1, p2, p3], r, sleeve or M["hand"])
    hx, hy, hz = p3[0] + d * r * 1.6, p3[1] - r * 0.2, p3[2] - r * 0.2
    cuff = cyl(c, name + "_cuff", r * 1.45, r * 0.9, (p3[0] + d * r * 0.2, p3[1], p3[2]), M["hand"], rot=(0, math.radians(90), 0), verts=16, bevel=r * 0.25)
    h = sphere(c, name + "_hand", r * 1.9, (hx, hy, hz), M["hand"], scale=(1.15, 0.7, 1.0))
    th = sphere(c, name + "_thumb", r * 0.85, (hx - d * r * 0.4, hy - r * 0.5, hz + r * 1.7), M["hand"], scale=(0.9, 0.8, 1.35), seg=14, rings=8)
    th.rotation_euler.y = -d * 0.4
    o = join([t, cuff, h, th], name)
    set_origin(o, Vector(shoulder))
    return o

# ---------- furniture builders (front = -Y, floor z=0) ----------
def sofa(c, M, seats=2, corner=False):
    W = 0.62 * seats + 0.36
    D = 0.86; seatH = 0.44; armW = 0.18
    up = []
    up.append(box(c, "base", (W, D, 0.22), (0, 0, 0.11 + 0.08), M["sofa_dark"], 0.03))
    for s in range(seats):
        cw = (W - 2 * armW) / seats
        x = -W / 2 + armW + cw * (s + 0.5)
        up.append(box(c, f"seat{s}", (cw - 0.015, D - 0.24, 0.16), (x, -0.06, seatH - 0.06), M["sofa"], 0.06, 4))
        if seats % 2 == 1:
            up.append(box(c, f"back{s}", (cw - 0.02, 0.2, 0.42), (x, D / 2 - 0.16, seatH + 0.2), M["sofa"], 0.08, 4))
    if seats % 2 == 0:
        up.append(box(c, "back", (W - 2 * armW - 0.02, 0.2, 0.42), (0, D / 2 - 0.16, seatH + 0.2), M["sofa"], 0.08, 4))
    up.append(box(c, "backframe", (W, 0.14, 0.62), (0, D / 2 - 0.07, 0.31 + 0.08), M["sofa_dark"], 0.04))
    for side in (-1, 1):
        up.append(box(c, f"armrest{side}", (armW, D, 0.5), (side * (W / 2 - armW / 2), 0, 0.25 + 0.08), M["sofa_dark"], 0.07, 4))
    if corner:
        CW = 0.95; CD = 0.62
        x0 = W / 2 - armW
        # chaise на правой стороне, выдвинут вперёд
        up.append(box(c, "chaise_base", (CW - armW, CD, 0.22), (x0 - (CW - armW) / 2 + armW / 2 + 0.0, -D / 2 - CD / 2 + 0.02, 0.19), M["sofa_dark"], 0.03))
        up.append(box(c, "chaise_seat", (CW - armW - 0.02, CD + 0.02, 0.16), (x0 - (CW - armW) / 2 + armW / 2, -D / 2 - CD / 2 + 0.06, seatH - 0.06), M["sofa"], 0.06, 4))
        up.append(box(c, "chaise_arm", (armW, CD + 0.02, 0.5), (W / 2 - armW / 2, -D / 2 - CD / 2 + 0.02, 0.33), M["sofa_dark"], 0.07, 4))
    legs = []
    for lx in (-W / 2 + 0.08, W / 2 - 0.08):
        for ly in (-D / 2 + 0.08, D / 2 - 0.08):
            legs.append(cyl(c, "leg", 0.022, 0.09, (lx, ly, 0.045), M["wood"], verts=16))
    if corner:
        legs.append(cyl(c, "leg", 0.022, 0.09, (W / 2 - 0.08, -D / 2 - 0.56, 0.045), M["wood"], verts=16))
        legs.append(cyl(c, "leg", 0.022, 0.09, (W / 2 - 0.86, -D / 2 - 0.56, 0.045), M["wood"], verts=16))
    upo = join(up, "Upholstery"); lego = join(legs, "Legs")
    # лицо на спинке по центру
    fy = D / 2 - 0.26 - 0.002
    fz = seatH + 0.25
    f = face(c, M, (0, fy, fz), scale=1.25)
    shoulderZ = 0.47
    al = arm(c, M, "Arm_L", (-W / 2 + 0.002, -0.08, shoulderZ), -1, sleeve=M["sofa_dark"])
    ar_x = W / 2 + 0.002
    ar = arm(c, M, "Arm_R", (ar_x, -0.08 if not corner else -D / 2 - 0.2, shoulderZ), 1, sleeve=M["sofa_dark"])
    return upo, [lego], f, [al, ar]

def armchair(c, M, recliner=False):
    W = 0.86; D = 0.86; seatH = 0.44; armW = 0.17
    up = []
    up.append(box(c, "base", (W, D, 0.22), (0, 0, 0.19), M["arm_dark"], 0.03))
    up.append(box(c, "seat", (W - 2 * armW - 0.01, D - 0.22, 0.16), (0, -0.05, seatH - 0.06), M["arm"], 0.06, 4))
    backTilt = 0.0

    b = box(c, "back", (W - 2 * armW - 0.02, 0.22, 0.5), (0, D / 2 - 0.17, seatH + 0.24), M["arm"], 0.09, 4)
    b.rotation_euler.x = backTilt
    up.append(b)
    up.append(box(c, "backframe", (W, 0.14, 0.7), (0, D / 2 - 0.07, 0.43), M["arm_dark"], 0.04))
    for side in (-1, 1):
        up.append(box(c, f"armrest{side}", (armW, D, 0.5), (side * (W / 2 - armW / 2), 0, 0.33), M["arm_dark"], 0.07, 4))
    if recliner:
        fr = box(c, "footrest", (W - 2 * armW - 0.04, 0.42, 0.12), (0, -D / 2 - 0.2, 0.36), M["arm"], 0.05, 4)
        fr.rotation_euler.x = math.radians(8)
        up.append(fr)
        up.append(box(c, "lever", (0.025, 0.08, 0.03), (W / 2 + 0.012, -0.12, 0.38), M["arm_dark"], 0.01, 2))
    if not recliner:
        up.append(box(c, "back_pillow", (W - 2 * armW - 0.08, 0.1, 0.18), (0, D / 2 - 0.3, seatH + 0.1), M["arm_dark"], 0.06, 4))
    legs = []
    for lx in (-W / 2 + 0.07, W / 2 - 0.07):
        for ly in (-D / 2 + 0.07, D / 2 - 0.07):
            legs.append(cyl(c, "leg", 0.022, 0.09, (lx, ly, 0.045), M["wood"], verts=16))
    if recliner:
        for lx in (-0.18, 0.18):
            legs.append(cyl(c, "strut", 0.012, 0.32, (lx, -D / 2 - 0.02, 0.33), M["metal"], rot=(math.radians(70), 0, 0), verts=10))
    upo = join(up, "Upholstery"); lego = join(legs, "Legs")
    f = face(c, M, (0, D / 2 - 0.28 - 0.002, seatH + 0.33), scale=1.1)
    al = arm(c, M, "Arm_L", (-W / 2 + 0.002, -0.1, 0.47), -1, length=0.2, sleeve=M["arm_dark"])
    ar = arm(c, M, "Arm_R", (W / 2 + 0.002, -0.1 if not recliner else 0.08, 0.47), 1, length=0.2, sleeve=M["arm_dark"])
    return upo, [lego], f, [al, ar]

def mattress(c, M, double=False):
    W = 1.6 if double else 0.9; L = 2.0; H = 0.24
    # матрас лежит длинной стороной к зрителю (ось X), лицо — на боковом бортике
    X, Y = L, W
    up = []
    border = box(c, "border", (X, Y, H - 0.06), (0, 0, H / 2), M["matt_border"], 0.03, 3)
    top = box(c, "top_quilt", (X - 0.01, Y - 0.01, 0.08), (0, 0, H - 0.03), M["matt"], 0.035, 3)
    bottom = box(c, "bottom_quilt", (X - 0.01, Y - 0.01, 0.06), (0, 0, 0.03), M["matt"], 0.025, 3)
    up += [border, top, bottom]
    # канты (piping) по периметру верха и низа
    for z in (H - 0.065, 0.06):
        hx, hy = X / 2, Y / 2
        pts = [(-hx, -hy, z), (hx, -hy, z), (hx, hy, z), (-hx, hy, z), (-hx, -hy + 0.001, z)]
        cu = bpy.data.curves.new("piping", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.009; cu.bevel_resolution = 2
        sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            sp.points[i].co = (*p, 1)
        sp.use_cyclic_u = True
        o = bpy.data.objects.new("piping", cu); c.objects.link(o); o.data.materials.append(M["piping"])
        up.append(to_mesh(o))
    # стёжка: пуговки-углубления на верхнем полотне
    nx, ny = (8, 6) if double else (8, 3)
    for i in range(nx):
        for j in range(ny):
            px = -X / 2 + X * (i + 0.5) / nx
            py = -Y / 2 + Y * (j + 0.5) / ny
            up.append(cyl(c, "tuft", 0.014, 0.012, (px, py, H + 0.006), M["piping"], verts=10, bevel=0.003))
    # ручки-петли на бортике и вентиляционные люверсы
    for px in (-0.45, 0.45):
        up.append(tube(c, "handle", [(px - 0.08, -Y / 2 - 0.004, H / 2 + 0.01), (px, -Y / 2 - 0.03, H / 2 - 0.01), (px + 0.08, -Y / 2 - 0.004, H / 2 + 0.01)], 0.008, M["piping"]))
    for px in (-0.8, 0.8):
        for py in (-Y / 2 - 0.001,):
            up.append(cyl(c, "vent", 0.016, 0.006, (px, py, H / 2), M["metal"], rot=(math.radians(90), 0, 0), verts=12))
    upo = join(up, "Upholstery")
    f = face(c, M, (0, -Y / 2 - 0.001, H / 2 + 0.008), scale=0.95, cheeks=True)
    al = arm(c, M, "Arm_L", (-X / 2 - 0.001, -Y / 2 + 0.2, H / 2 + 0.02), -1, length=0.2, droop=0.15, sleeve=M["matt_border"])
    ar = arm(c, M, "Arm_R", (X / 2 + 0.001, -Y / 2 + 0.2, H / 2 + 0.02), 1, length=0.2, droop=0.15, sleeve=M["matt_border"])
    return upo, [], f, [al, ar]

def chair(c, M, back=True):
    W = 0.46; D = 0.48; seatH = 0.46
    up = [box(c, "seat", (W, D, 0.08), (0, 0, seatH), M["chair"], 0.035, 4)]
    legs = []
    if back:
        up.append(box(c, "back", (W - 0.02, 0.06, 0.36), (0, D / 2 - 0.02, seatH + 0.25), M["chair"], 0.03, 4))
    else:
        legs.append(box(c, "rail", (W - 0.02, 0.035, 0.15), (0, D / 2 - 0.0, seatH + 0.33), M["wood"], 0.012, 3))
        for sx in (-0.09, 0, 0.09):
            legs.append(box(c, "slat", (0.03, 0.02, 0.22), (sx, D / 2 + 0.002, seatH + 0.15), M["wood"], 0.006, 2))
    for lx in (-W / 2 + 0.04, W / 2 - 0.04):
        for ly in (-D / 2 + 0.04, D / 2 - 0.04):
            legs.append(cyl(c, "leg", 0.018, seatH - 0.03, (lx, ly, (seatH - 0.03) / 2), M["wood"], verts=14))
    for lx in (-W / 2 + 0.04, W / 2 - 0.04):
        legs.append(cyl(c, "post", 0.016, 0.42, (lx, D / 2 + 0.015, seatH + 0.19), M["wood"], verts=14))
    legs.append(box(c, "stretcher", (W - 0.08, 0.02, 0.02), (0, -D / 2 + 0.04, 0.18), M["wood"], 0.005, 2))
    upo = join(up, "Upholstery"); lego = join(legs, "Legs")
    sh = seatH + 0.22
    if back:
        f = face(c, M, (0, D / 2 - 0.051, seatH + 0.27), scale=0.85, cheeks=True)
        sleeve = M["chair"]
    else:
        f = face(c, M, (0, D / 2 - 0.0175 - 0.001, seatH + 0.33), scale=0.6, cheeks=True)
        sleeve = M["wood"]
    al = arm(c, M, "Arm_L", (-W / 2 + 0.024, D / 2 + 0.015, sh), -1, length=0.16, r=0.02, sleeve=sleeve)
    ar = arm(c, M, "Arm_R", (W / 2 - 0.024, D / 2 + 0.015, sh), 1, length=0.16, r=0.02, sleeve=sleeve)
    return upo, [lego], f, [al, ar]

def pouf(c, M):
    up = [box(c, "pouf", (0.56, 0.56, 0.4), (0, 0, 0.22), M["pouf"], 0.14, 5)]
    up.append(cyl(c, "button", 0.022, 0.02, (0, 0, 0.425), M["piping"], verts=14, bevel=0.005))
    upo = join(up, "Upholstery")
    f = face(c, M, (0, -0.281, 0.25), scale=0.95)
    al = arm(c, M, "Arm_L", (-0.281, -0.04, 0.27), -1, length=0.16, sleeve=M["pouf"])
    ar = arm(c, M, "Arm_R", (0.281, -0.04, 0.27), 1, length=0.16, sleeve=M["pouf"])
    return upo, [], f, [al, ar]

VARIANTS = {
    "sofa-2": lambda c, M: sofa(c, M, 2),
    "sofa-3": lambda c, M: sofa(c, M, 3),
    "sofa-corner": lambda c, M: sofa(c, M, 3, corner=True),
    "armchair-standard": lambda c, M: armchair(c, M),
    "armchair-recliner": lambda c, M: armchair(c, M, recliner=True),
    "mattress-single": lambda c, M: mattress(c, M),
    "mattress-double": lambda c, M: mattress(c, M, True),
    "chair-seat": lambda c, M: chair(c, M, back=False),
    "chair-seat-back": lambda c, M: chair(c, M, back=True),
    "other": pouf,
}

def build_all(export=True, only=None):
    reset()
    M = palette()
    xoff = 0
    report = {}
    for key, fn in VARIANTS.items():
        if only and key not in only:
            continue
        c = coll(key)
        upo, extra, f, arms = fn(c, M)
        uv_unwrap(upo)
        root = bpy.data.objects.new(key, None); c.objects.link(root)
        for o in [upo, *extra, *f, *arms]:
            if o.parent is None:
                o.parent = root
        report[key] = sum(len(o.data.polygons) for o in c.objects if o.type == "MESH")
        if export:
            bpy.ops.object.select_all(action="DESELECT")
            for o in c.objects:
                o.select_set(True)
            bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, key + ".glb"), use_selection=True, export_format="GLB",
                                      export_apply=True, export_yup=True, export_materials="EXPORT")
        root.location.x = xoff
        xoff += 2.6
    return report

if __name__ == "__main__":
    print(build_all())
