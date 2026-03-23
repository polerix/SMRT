"""
Generate placeholder / prototype sprites for security_adventure.json.

Outputs
-------
assets/sa/lobby.png          960×520  background
assets/sa/server_room.png    960×520  background
assets/sa/parking_lot.png    960×520  background
assets/sa/cafeteria.png      960×520  background
assets/sa/workstation.png    960×520  background
assets/sa/boardroom.png      960×520  background

assets/sa/justin.png         character spritesheet  (player)
assets/sa/smarty.png         character spritesheet  (ai_guide)
assets/sa/wanda.png          character spritesheet  (antagonist)

Spritesheet layout
------------------
Horizontal strip: [idle frames | walk frames | talk frames]
Frame size: 80 × 160 px (roughly matching FRAME_W=59 × FRAME_H=163 with a round number)

Each frame has:
  - coloured silhouette for the character
  - small label (animation state + frame index)
  - a simple pose indicator drawn with lines

Walk cycle poses (4 frames):  arms / legs at 4 positions: mid, stride-L, mid, stride-R
Talk poses:                    mouth open / closed alternation
Idle poses:                    neutral / slight lean
"""

import os
import json
import math
from PIL import Image, ImageDraw, ImageFont

# ── paths ──────────────────────────────────────────────────────────────────────
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO, "assets", "sa")
os.makedirs(OUT_DIR, exist_ok=True)

# ── constants ──────────────────────────────────────────────────────────────────
CW, CH = 960, 520          # scene canvas
FRAME_W, FRAME_H = 80, 160 # sprite frame size

# ── font helpers ───────────────────────────────────────────────────────────────
try:
    FONT_LG = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    FONT_MD = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    FONT_SM = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
    FONT_XS = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
except IOError:
    FONT_LG = ImageFont.load_default()
    FONT_MD = FONT_LG
    FONT_SM = FONT_LG
    FONT_XS = FONT_LG


def text_centre(draw, text, cx, cy, font, fill):
    bb = draw.textbbox((0, 0), text, font=font)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    draw.text((cx - w // 2, cy - h // 2), text, font=font, fill=fill)


# ══════════════════════════════════════════════════════════════════════════════
# BACKGROUND GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

SCENES = {
    "lobby": {
        "bg": (210, 220, 235),
        "floor": (180, 175, 165),
        "accent": (100, 130, 180),
        "desc": "Corporate lobby — reception desk, notice board, security poster",
        "horizon_x": 480, "horizon_y": 200,
        "walkbox": [(80, 510), (880, 510), (760, 320), (200, 320)],
        "hotspots": [
            {"id": "notice_board",    "x": 80,  "y": 160, "w": 200, "h": 220, "color": (255, 200, 100, 120)},
            {"id": "reception_desk",  "x": 310, "y": 340, "w": 340, "h": 120, "color": (100, 200, 255, 120)},
            {"id": "security_poster", "x": 590, "y": 140, "w": 160, "h": 200, "color": (200, 255, 150, 120)},
        ],
        "transporters": [
            {"label": "→ Server Room", "x": 820, "y": 200, "w": 120, "h": 310},
            {"label": "← Parking",    "x":   0, "y": 200, "w":  80, "h": 310},
            {"label": "↓ Cafeteria",  "x": 360, "y": 540, "w": 240, "h":  60},
            {"label": "↑ Workstation","x": 600, "y": 100, "w": 200, "h": 100},
            {"label": "↑ Boardroom",  "x": 200, "y": 100, "w": 200, "h": 100},
        ],
    },
    "server_room": {
        "bg": (30, 40, 55),
        "floor": (50, 55, 65),
        "accent": (0, 200, 150),
        "desc": "Server room — server racks, cable management, access panel",
        "horizon_x": 480, "horizon_y": 195,
        "walkbox": [(80, 510), (880, 510), (760, 310), (200, 310)],
        "hotspots": [
            {"id": "server_rack",     "x": 80,  "y": 130, "w": 200, "h": 310, "color": (0,   200, 150, 100)},
            {"id": "access_panel",    "x": 700, "y": 180, "w": 160, "h": 200, "color": (255, 200,   0, 100)},
            {"id": "cable_mess",      "x": 350, "y": 390, "w": 200, "h": 100, "color": (255, 100, 100, 100)},
        ],
        "transporters": [
            {"label": "← Lobby", "x": 0, "y": 280, "w": 80, "h": 240},
        ],
    },
    "parking_lot": {
        "bg": (160, 170, 160),
        "floor": (120, 125, 115),
        "accent": (200, 180, 80),
        "desc": "Parking lot — secure entry door, badge reader, security sign",
        "horizon_x": 480, "horizon_y": 190,
        "walkbox": [(60, 510), (900, 510), (800, 305), (160, 305)],
        "hotspots": [
            {"id": "secure_door",   "x": 380, "y": 120, "w": 200, "h": 280, "color": (200, 100, 100, 120)},
            {"id": "badge_reader",  "x": 590, "y": 240, "w": 80,  "h": 130, "color": (100, 200, 255, 120)},
            {"id": "security_sign", "x": 750, "y": 160, "w": 120, "h": 160, "color": (200, 255, 150, 120)},
        ],
        "transporters": [
            {"label": "→ Lobby", "x": 880, "y": 280, "w": 80, "h": 240},
        ],
    },
    "cafeteria": {
        "bg": (240, 230, 210),
        "floor": (210, 200, 185),
        "accent": (200, 130, 60),
        "desc": "Cafeteria — Wanda's table, lunch counter, notice board",
        "horizon_x": 480, "horizon_y": 192,
        "walkbox": [(60, 510), (900, 510), (800, 305), (160, 305)],
        "hotspots": [
            {"id": "wandas_table",    "x": 540, "y": 280, "w": 200, "h": 160, "color": (200, 100, 100, 120)},
            {"id": "lunch_counter",   "x": 100, "y": 250, "w": 280, "h": 130, "color": (100, 200, 255, 120)},
            {"id": "notice_board_cafe","x": 800, "y": 140, "w": 130, "h": 180, "color": (200, 255, 150, 120)},
        ],
        "transporters": [
            {"label": "↑ Lobby", "x": 0, "y": 280, "w": 80, "h": 240},
        ],
    },
    "workstation": {
        "bg": (220, 225, 235),
        "floor": (195, 190, 180),
        "accent": (80, 140, 220),
        "desc": "Open-plan workstation — unlocked screen, sticky note, document pile",
        "horizon_x": 480, "horizon_y": 188,
        "walkbox": [(60, 510), (900, 510), (800, 305), (160, 305)],
        "hotspots": [
            {"id": "unlocked_screen", "x": 300, "y": 170, "w": 200, "h": 180, "color": (200, 100, 100, 120)},
            {"id": "sticky_note",     "x": 530, "y": 240, "w": 100, "h":  90, "color": (255, 230,  80, 140)},
            {"id": "document_pile",   "x": 100, "y": 300, "w": 160, "h": 100, "color": (200, 255, 150, 120)},
        ],
        "transporters": [
            {"label": "↓ Lobby", "x": 0, "y": 280, "w": 80, "h": 240},
        ],
    },
    "boardroom": {
        "bg": (200, 195, 215),
        "floor": (170, 165, 155),
        "accent": (120, 90, 170),
        "desc": "Boardroom — Wanda (visitor), projector screen, whiteboard",
        "horizon_x": 480, "horizon_y": 185,
        "walkbox": [(60, 510), (900, 510), (800, 305), (160, 305)],
        "hotspots": [
            {"id": "visitor_wanda",     "x": 620, "y": 210, "w": 140, "h": 260, "color": (200, 100, 100, 120)},
            {"id": "projector_screen",  "x": 160, "y": 120, "w": 300, "h": 200, "color": (100, 200, 255, 120)},
            {"id": "whiteboard",        "x": 700, "y": 140, "w": 200, "h": 180, "color": (200, 255, 150, 120)},
        ],
        "transporters": [
            {"label": "↓ Lobby", "x": 0, "y": 280, "w": 80, "h": 240},
        ],
    },
}


def draw_perspective_floor(draw, bg_color, floor_color, horizon_x, horizon_y, scene_w=CW, scene_h=CH):
    """Draw a simple vanishing-point floor grid."""
    # Sky/wall area
    draw.rectangle([0, 0, scene_w, horizon_y], fill=bg_color)
    # Floor area
    draw.rectangle([0, horizon_y, scene_w, scene_h], fill=floor_color)
    # Horizon line
    draw.line([(0, horizon_y), (scene_w, horizon_y)], fill=(0, 0, 0, 60), width=2)
    # Perspective grid lines (vanishing point = horizon_x, horizon_y)
    grid_color = (0, 0, 0, 30)
    vx, vy = horizon_x, horizon_y
    # Floor vertical lines
    for gx in range(0, scene_w + 1, 80):
        draw.line([(vx, vy), (gx, scene_h)], fill=grid_color, width=1)
    # Floor horizontal lines (evenly spaced in screen space)
    for gy in range(horizon_y, scene_h + 1, 40):
        draw.line([(0, gy), (scene_w, gy)], fill=grid_color, width=1)


def make_background(name, spec):
    img = Image.new("RGBA", (CW, CH), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img, "RGBA")

    draw_perspective_floor(
        draw,
        spec["bg"] + (255,),
        spec["floor"] + (255,),
        spec["horizon_x"], spec["horizon_y"],
    )

    # Accent border strip (top)
    draw.rectangle([0, 0, CW, 8], fill=spec["accent"] + (200,))

    # Walkbox overlay (semi-transparent green)
    wb = spec["walkbox"]
    if wb:
        poly = [(p[0], p[1]) for p in wb]
        draw.polygon(poly, fill=(0, 255, 100, 30), outline=(0, 200, 80, 180))
        text_centre(draw, "WALKBOX", sum(p[0] for p in poly)//len(poly),
                    sum(p[1] for p in poly)//len(poly), FONT_SM, (0, 160, 60, 200))

    # Hotspot overlays
    for hs in spec.get("hotspots", []):
        x, y, w, h = hs["x"], hs["y"], hs["w"], hs["h"]
        draw.rectangle([x, y, x+w, y+h], fill=hs["color"], outline=(0,0,0,180), width=2)
        text_centre(draw, hs["id"], x + w//2, y + h//2, FONT_XS, (0, 0, 0, 220))

    # Transporter overlays (dashed-look via stipple)
    for tr in spec.get("transporters", []):
        x, y, w, h = tr["x"], tr["y"], tr["w"], tr["h"]
        draw.rectangle([x, y, x+w, y+h], fill=(255, 255, 0, 45), outline=(200, 160, 0, 200), width=2)
        text_centre(draw, tr["label"], x + w//2, y + h//2, FONT_XS, (120, 100, 0, 220))

    # Vanishing point cross
    vx, vy = spec["horizon_x"], spec["horizon_y"]
    draw.ellipse([vx-6, vy-6, vx+6, vy+6], fill=(255, 0, 0, 180))
    draw.line([(vx-20, vy), (vx+20, vy)], fill=(255, 0, 0, 180), width=2)
    draw.line([(vx, vy-20), (vx, vy+20)], fill=(255, 0, 0, 180), width=2)

    # Title bar at top
    draw.rectangle([0, 10, CW, 50], fill=(0, 0, 0, 140))
    text_centre(draw, f"[PLACEHOLDER] {name.upper()}  960×520", CW//2, 30, FONT_LG, (255, 255, 255))

    # Description at bottom
    draw.rectangle([0, CH-30, CW, CH], fill=(0, 0, 0, 140))
    text_centre(draw, spec["desc"], CW//2, CH-15, FONT_SM, (220, 220, 220))

    # Dimension watermark
    text_centre(draw, "960 × 520", CW//2, CH//2, FONT_LG, (255, 255, 255, 60))

    return img.convert("RGB")


# ══════════════════════════════════════════════════════════════════════════════
# CHARACTER SPRITESHEET GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

CHARACTERS = {
    "justin": {
        "color": (200, 160, 40),       # gold
        "skin": (255, 210, 170),
        "shirt": (40,  100, 200),
        "pants": (60,  60,  100),
        "hair": (80, 50, 20),
        "role": "PLAYER",
        "frames": {"idle": 1, "walk": 4, "talk": 2},
    },
    "smarty": {
        "color": (220, 120, 20),       # orange AI guide
        "skin": (200, 180, 255),       # slightly violet (robot tint)
        "shirt": (255, 140, 0),
        "pants": (80,  60,  140),
        "hair": (180, 180, 220),
        "role": "AI GUIDE",
        "frames": {"idle": 2, "walk": 1, "talk": 3},
    },
    "wanda": {
        "color": (160, 30, 30),        # red antagonist
        "skin": (255, 200, 160),
        "shirt": (160, 30,  30),
        "pants": (50,  40,  40),
        "hair": (20, 10, 10),
        "role": "ANTAGONIST",
        "frames": {"idle": 2, "walk": 4, "talk": 3},
    },
}

# Walk cycle arm/leg swing angles (degrees from vertical) for 4 frames
WALK_POSES = [
    {"arm_l": -20, "arm_r":  20, "leg_l": -15, "leg_r":  15},  # mid
    {"arm_l": -35, "arm_r":  35, "leg_l": -30, "leg_r":  30},  # stride L
    {"arm_l": -20, "arm_r":  20, "leg_l": -15, "leg_r":  15},  # mid
    {"arm_l":  35, "arm_r": -35, "leg_l":  30, "leg_r": -30},  # stride R
]

IDLE_POSES = [
    {"lean": 0},
    {"lean": 3},   # subtle tilt
]

TALK_POSES = [
    {"mouth": "open"},
    {"mouth": "closed"},
    {"mouth": "open"},   # for 3-frame talk
]


def polar(cx, cy, angle_deg, length):
    """Return endpoint of a line from (cx,cy) at angle_deg (0=up) with given length."""
    a = math.radians(angle_deg - 90)
    return (cx + length * math.cos(a), cy + length * math.sin(a))


def draw_stick_figure(draw, cx, cy, fw, fh, char_spec, pose, anim_label, frame_idx, bg_color):
    """Draw a labelled stick figure character frame."""
    # Background
    draw.rectangle([cx, cy, cx+fw-1, cy+fh-1], fill=bg_color)
    # Border
    draw.rectangle([cx, cy, cx+fw-1, cy+fh-1], outline=(0, 0, 0, 180), width=1)

    skin  = char_spec["skin"]
    shirt = char_spec["shirt"]
    pants = char_spec["pants"]
    hair  = char_spec["hair"]

    # Figure proportions (in frame-local coords, then offset by cx,cy)
    HEAD_R  = fw * 0.16
    head_cx = fw * 0.50
    head_cy = fh * 0.18
    neck_y  = fh * 0.28
    shoulder_y = fh * 0.32
    hip_y   = fh * 0.62
    knee_y  = fh * 0.79
    foot_y  = fh * 0.93
    arm_len = fw * 0.28
    fore_len= fw * 0.22
    thigh_l = (hip_y - knee_y) * 0.85
    shin_l  = (foot_y - knee_y) * 0.85

    lean = pose.get("lean", 0)
    offset_x = lean * 0.5  # horizontal body offset for idle lean

    def pt(lx, ly):
        return (cx + lx + offset_x, cy + ly)

    # ── LEGS ──
    la = pose.get("leg_l", -15)
    ra = pose.get("leg_r",  15)
    # Thighs from hip centre
    hip_cx = head_cx
    lknee = polar(hip_cx, hip_y, la, thigh_l)
    rknee = polar(hip_cx, hip_y, ra, thigh_l)
    lfoot = polar(lknee[0], lknee[1], la, shin_l)
    rfoot = polar(rknee[0], rknee[1], ra, shin_l)

    draw.line([pt(hip_cx, hip_y), pt(*lknee)], fill=pants, width=5)
    draw.line([pt(*lknee), pt(*lfoot)], fill=pants, width=4)
    draw.line([pt(hip_cx, hip_y), pt(*rknee)], fill=pants, width=5)
    draw.line([pt(*rknee), pt(*rfoot)], fill=pants, width=4)
    # Feet dots
    draw.ellipse([pt(lfoot[0]-3, lfoot[1]-2), pt(lfoot[0]+3, lfoot[1]+2)], fill=(40,40,40))
    draw.ellipse([pt(rfoot[0]-3, rfoot[1]-2), pt(rfoot[0]+3, rfoot[1]+2)], fill=(40,40,40))

    # ── TORSO ──
    draw.rectangle([pt(head_cx - fw*0.12, shoulder_y),
                    pt(head_cx + fw*0.12, hip_y)], fill=shirt)

    # ── ARMS ──
    al = pose.get("arm_l", -20)
    ar = pose.get("arm_r",  20)
    lelbow = polar(head_cx, shoulder_y, al, arm_len)
    relbow = polar(head_cx, shoulder_y, ar, arm_len)
    lhand  = polar(lelbow[0], lelbow[1], al, fore_len)
    rhand  = polar(relbow[0], relbow[1], ar, fore_len)

    draw.line([pt(head_cx, shoulder_y), pt(*lelbow)], fill=shirt, width=5)
    draw.line([pt(*lelbow), pt(*lhand)], fill=skin,  width=4)
    draw.line([pt(head_cx, shoulder_y), pt(*relbow)], fill=shirt, width=5)
    draw.line([pt(*relbow), pt(*rhand)], fill=skin,  width=4)

    # ── NECK ──
    draw.line([pt(head_cx, neck_y), pt(head_cx, shoulder_y)], fill=skin, width=4)

    # ── HEAD ──
    hx, hy = cx + head_cx + offset_x, cy + head_cy
    draw.ellipse([hx - HEAD_R, hy - HEAD_R, hx + HEAD_R, hy + HEAD_R], fill=skin, outline=(80, 60, 40), width=2)

    # Hair (top arc)
    hair_r = HEAD_R * 1.05
    draw.arc([hx - hair_r, hy - hair_r, hx + hair_r, hy + hair_r],
             start=200, end=340, fill=hair, width=int(HEAD_R * 0.35))

    # Eyes
    ex_off = HEAD_R * 0.3
    ey = hy - HEAD_R * 0.1
    draw.ellipse([hx-ex_off-2, ey-2, hx-ex_off+2, ey+2], fill=(30,30,80))
    draw.ellipse([hx+ex_off-2, ey-2, hx+ex_off+2, ey+2], fill=(30,30,80))

    # Mouth
    if pose.get("mouth") == "open":
        draw.ellipse([hx-HEAD_R*0.25, hy+HEAD_R*0.2, hx+HEAD_R*0.25, hy+HEAD_R*0.5],
                     fill=(160, 60, 60))
    else:
        draw.line([pt(head_cx - HEAD_R*0.25, head_cy + HEAD_R*0.35),
                   pt(head_cx + HEAD_R*0.25, head_cy + HEAD_R*0.35)],
                  fill=(120, 70, 70), width=2)

    # ── LABEL ──
    label = f"{anim_label}[{frame_idx}]"
    draw.rectangle([cx, cy+fh-16, cx+fw, cy+fh], fill=(0, 0, 0, 160))
    text_centre(draw, label, cx+fw//2, cy+fh-8, FONT_XS, (255,255,255))


def make_spritesheet(name, spec):
    frames = spec["frames"]
    total_frames = frames["idle"] + frames["walk"] + frames["talk"]
    sheet_w = total_frames * FRAME_W
    sheet_h = FRAME_H + 28  # extra row for labels at top

    img = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")

    # Header bar
    draw.rectangle([0, 0, sheet_w, 28], fill=(30, 30, 30, 230))
    header = (f"[PLACEHOLDER] {name.upper()} — {spec['role']}   "
              f"idle×{frames['idle']} walk×{frames['walk']} talk×{frames['talk']}   "
              f"frame {FRAME_W}×{FRAME_H}px   total {sheet_w}×{FRAME_H}px")
    text_centre(draw, header, sheet_w//2, 14, FONT_XS, (255, 255, 200))

    col = 0
    # Alternating bg tones for animation sections
    section_colors = {
        "idle": (50, 60, 70, 230),
        "walk": (40, 55, 45, 230),
        "talk": (60, 45, 50, 230),
    }

    for anim, count in [("idle", frames["idle"]),
                        ("walk", frames["walk"]),
                        ("talk", frames["talk"])]:
        for fi in range(count):
            cx = col * FRAME_W
            cy = 28  # below header

            bg = section_colors[anim]

            if anim == "walk":
                pose = WALK_POSES[fi % len(WALK_POSES)]
            elif anim == "idle":
                pose = IDLE_POSES[fi % len(IDLE_POSES)]
            else:
                pose = TALK_POSES[fi % len(TALK_POSES)]

            draw_stick_figure(draw, cx, cy, FRAME_W, FRAME_H, spec, pose, anim, fi, bg)

            # Section divider at first frame of each section
            if fi == 0 and col > 0:
                draw.line([(cx, cy), (cx, cy + FRAME_H)], fill=(255, 255, 0, 180), width=2)

            col += 1

    # Column index ruler at very bottom
    for c in range(total_frames):
        draw.rectangle([c*FRAME_W, 28+FRAME_H-12, (c+1)*FRAME_W, 28+FRAME_H],
                       fill=(0, 0, 0, 160))
        text_centre(draw, str(c), c*FRAME_W + FRAME_W//2, 28+FRAME_H-6, FONT_XS, (200, 200, 200))

    return img


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"Output directory: {OUT_DIR}")

    # Backgrounds
    for scene_name, spec in SCENES.items():
        path = os.path.join(OUT_DIR, f"{scene_name}.png")
        img = make_background(scene_name, spec)
        img.save(path)
        print(f"  ✓  {scene_name}.png  ({img.width}×{img.height})")

    # Character spritesheets
    for char_name, spec in CHARACTERS.items():
        path = os.path.join(OUT_DIR, f"{char_name}.png")
        img = make_spritesheet(char_name, spec)
        img.save(path)
        frames = spec["frames"]
        total = frames["idle"] + frames["walk"] + frames["talk"]
        print(f"  ✓  {char_name}.png  ({img.width}×{img.height})  "
              f"idle×{frames['idle']} walk×{frames['walk']} talk×{frames['talk']} = {total} frames")

    print("Done.")
