# Media map — 22 new PNGs in `media-source/`

Method: each of the first 20 files was opened and visually inspected (plus zoomed
crops of hands/grips/faces for the ambiguous ones), then matched against the
exercise ids in `src/lib/data/exercises.ts` using the "Form to specify" notes in
`docs/image-brief.md` Batch 2, and the Batch 1 note that Clean and Press and
Snatch needed regenerating as 2-panel images.

Two more files arrived later, generated directly against the Batch A prompts in
`docs/images-to-regenerate.md` for Two-Hand Swing and Single-Arm Swing, and are
mapped the same way below.

| Filename | Exercise id | Confidence | Visual evidence | Form assessment |
|---|---|---|---|---|
| `a-single-athletic-male-figure--short-brown-hair--b.png` | `goblet-squat` (likely duplicate, not a Batch 2 gap) | Medium | Two hands gripping the bell horns at chest, mid-squat stance. This is a two-handed goblet grip, not the single-arm front rack Batch 2 needed. | Grip and stance are anatomically fine (5 fingers, straight wrists). No injury-teaching error, but it fills no gap — Goblet Squat is already "good" in the grid. |
| `a-single-athletic-male-figure--short-brown-hair--b (1).png` | `racked-front-squat` | High | Single hand gripping the handle, forearm vertical, elbow tucked to the ribs, bottom-of-squat depth, knees tracking over toes. Matches the brief's form note exactly. | Clean: wrist straight in line with forearm, five fingers, no rounding visible. Ship as-is. |
| `a-single-athletic-male-figure--short-brown-hair--b (2).png` | `squat-to-press` (likely duplicate, not a Batch 2 gap) | Medium | Two hands locked out overhead on the bell horns, knees still slightly bent — the finishing position of the two-handed Squat to Press, not any single-arm Batch 2 lift. | Grip and lockout look correct. Not a form problem, just redundant — Squat to Press is already covered and already 2-panel in Batch 1. |
| `a-single-athletic-male-figure--short-brown-hair--b (3).png` | `floor-press` | High | Lying on back, one knee bent with foot flat, other leg extended with shoe visible, one arm pressing the bell straight up, other forearm flat on the floor. Matches the brief's form note exactly. | Zoomed the pressing hand: single-hand grip, wrist straight in line with forearm. Ship as-is. |
| `a-single-athletic-male-figure--short-brown-hair--b (4).png` | `single-leg-deadlift` | High | Standing on one leg, torso and rear leg forming one straight line parallel to the floor, bell hanging from a straight arm. Matches the brief's form note exactly. | Grip and spine line look correct, no rounding. Ship as-is. |
| `a-single-athletic-male-figure--short-brown-hair--b (5).png` | `farmers-carry` | High | Mid-stride walking gait, one kettlebell in each hand hanging at the sides, tall spine. Matches the brief's form note exactly. | Both hands grip normally, wrists straight. Ship as-is. |
| `a-single-athletic-male-figure--short-brown-hair--b (6).png` | `suitcase-carry` | High | Mid-stride walking gait, single bell in one hand at the side, free hand loose near the torso. Matches the brief's form note. | Single-hand grip is clean, wrist straight. Ship as-is. |
| `a-single-athletic-male-figure--short-brown-hair--b (7).png` | Unidentified — no clean match | Low / unsure | Walking gait, but BOTH hands are on the one bell's handle held at chest height — not Farmer's (needs 2 bells), not Suitcase (needs 1 hand only), not Racked Carry (needs single-arm front rack, forearm vertical against ribs). Closest intended target is probably Racked Carry, drawn with the wrong (bilateral) grip. | Grip itself is clean, no anatomical fault, but the pose does not match any of the three defined carry variants. Do not map to `racked-carry` as-is. |
| `a-single-athletic-male-figure--short-brown-hair--b (8).png` | `windmill` | High | One arm locked overhead holding the bell, torso hinged sideways, free hand reaching down near the front foot. Matches the brief's form note. | Free-hand grip and overhead lockout look fine. The exact eye-line relative to the bell is hard to verify in a rotated cartoon pose — worth a human glance, but not an obvious fault. |
| `a-single-athletic-male-figure--short-brown-hair--b (9).png` | `renegade-row` | High | High plank with both hands gripping two kettlebell handles on the floor, feet wide. Matches the setup half of the brief's form note. | Hands, fingers and wrists look normal. Note: this shows the plank/setup, not the moment "one bell rowed to the ribs" the brief specified — still clearly identifiable as Renegade Row, but it's the static half of the movement. |
| `a-single-athletic-male-figure--short-brown-hair--b (10).png` | `clean` (Kettlebell Clean) | Low | Standing, one hand holding the bell up near the chin/shoulder — closest match among the 14 gaps is the clean's rack landing. | **Form problem.** Zoomed crop shows the hand wrapped around the round ball of the bell rather than a handle grip, and the elbow is flared out and raised near the face instead of tucked vertically against the ribs — this is the exact "elbow flared away from the ribs" mistake the app's own cue list warns about. Recommend regenerating rather than shipping. |
| `a-single-athletic-male-figure--short-brown-hair--b (11).png` | `step-up` (likely duplicate, not a Batch 2 gap) | Medium | Front foot planted on a bench/box, two-handed goblet hold, rear foot trailing — matches Step-Up, already "good" in the grid and already `needsBench`. | Clean grip and stance. Not a form problem, just redundant with existing coverage. |
| `a-single-athletic-male-figure--short-brown-hair--b (12).png` | `suitcase-carry` (duplicate of image 6) | Medium | Near-identical walking pose to file (6): single bell in one hand, free arm swinging. | Clean grip. Likely a second take of the same exercise rather than a new gap-fill. |
| `a-single-athletic-male-figure--short-brown-hair--b (13).png` | Unidentified | Unsure | Standing, feet planted wide, hands on hips, no kettlebell anywhere in frame. | No kettlebell present — this doesn't match any of the 29 bell exercises. Looks like a bodyweight warm-up stance (Batch 3 territory), out of scope for this pass. |
| `a-single-athletic-male-figure--short-brown-hair--b (14).png` | Unidentified | Unsure | Standing on one leg, other leg kicked forward, arms out for balance, no kettlebell. | No bell. Looks like a bodyweight "leg swing" warm-up movement (Batch 3), not one of the 29 main exercises. |
| `a-single-athletic-male-figure--short-brown-hair--b (15).png` | Unidentified | Unsure | On hands and knees, back arched/rounding, no kettlebell. | No bell. Looks like a "cat-cow" bodyweight stretch (Batch 3). |
| `a-single-athletic-male-figure--short-brown-hair--b (16).png` | Unidentified | Unsure | Deep lunge with one hand on the floor, other arm reaching straight up, torso rotated, no kettlebell. | No bell. Looks like "world's greatest stretch" (Batch 3). |
| `a-single-athletic-male-figure--short-brown-hair--b (17).png` | Unidentified | Unsure | Standing, arms crossed and reaching forward at chest height, no kettlebell. | No bell. Looks like an arm/shoulder mobility stretch (Batch 3 territory — closest named item would be "arm circles" or a chest-adjacent stretch, but the pose doesn't cleanly match either). |
| `a-single-athletic-male-figure--short-brown-hair--b (18).png` | Unidentified | Unsure | Bodyweight squat, arms reaching forward for counterbalance, no kettlebell. | No bell. Looks like "bodyweight squat" (Batch 3). |
| `two-positions-of-the-same-character-shown-side-by-.png` | `turkish-get-up` | High | Two-panel image, left-to-right with an arrow between: left panel is lying on the side/back propped on the forearm with the bell pressed overhead; right panel is the tall-kneeling position, bell still locked overhead, free hand on the front knee. Matches the brief's 2-panel form note exactly. | Zoomed the left panel's pressing arm: single-hand grip, wrist straight, arm vertical over the shoulder throughout. Ship as-is. |
| `two-hand-swing-hinge-to-standing.png` | `two-hand-swing` | High | Renamed from `ChatGPT Image Aug 27, 2026, 11_56_44 AM.png`. Two-panel image with an arrow between: left panel is the hinge, bell hanging between the legs held in both hands; right panel is standing tall, bell floated up to chest height, still both hands, arms straight. Matches the Batch A 2-panel form note in `docs/images-to-regenerate.md` exactly. | Zoomed both grips: both hands are on the cylindrical handle, not the ball, in both panels. Back is flat in the hinge. Wrist stays straight in line with the forearm throughout. Ship as-is. |
| `single-arm-swing-hinge-to-standing.png` | `single-arm-swing` | High | Renamed from `ChatGPT Image Aug 27, 2026, 11_58_19 AM.png`. Two-panel image with an arrow between: left panel is the hinge, bell hanging between the legs held in one hand, free hand loose; right panel is standing tall, bell forward at chest height in one hand, free arm hanging clear. Matches the Batch A 2-panel form note in `docs/images-to-regenerate.md` exactly. | Zoomed both grips: the working hand is on the handle, not the ball, in both panels. Back is flat in the hinge. Wrist stays straight in line with the forearm throughout. Ship as-is. |

## Unidentified

Seven images could not be confidently mapped to any of the 29 exercise ids:

- **File (7)** — a walking pose with both hands on one kettlebell held at chest height. It doesn't match Farmer's Carry (needs two bells), Suitcase Carry (needs a single hand only) or Racked Carry (needs a single-arm front rack with the forearm vertical against the ribs). It looks like an attempt at Racked Carry that came out bilateral instead of single-arm.
- **Files (13), (14), (15), (16), (17), (18)** — none show a kettlebell at all. They read as bodyweight warm-up/mobility poses (a wide athletic stance with hands on hips, a standing leg swing, a hands-and-knees cat-cow, a rotating lunge stretch, a standing arm/shoulder reach, and a bodyweight squat). These match the flavour of the Batch 3 warm-up list in `docs/image-brief.md`, not any Batch 1/2 kettlebell exercise, so none of them can be assigned an id from `exercises.ts`.

## Batch 2 exercises still missing an image

Of the 14 Batch 2 exercises, 5 have **no usable image** among the 20:

- **Push Press** — no image shows a single-arm bell mid-drive with a knee dip and the arm not yet locked out.
- **Racked Carry** — file (7) attempts a walking rack-style carry but is drawn two-handed instead of single-arm; no correct version exists.
- **High Pull** — no image shows the bell at chest height with the elbow driven high and behind.
- **Bulgarian Split Squat** — no image shows a rear foot elevated on a bench (file (11)'s bench is used for a front-foot step-up, not a rear-foot split squat).
- **Figure 8** — no image shows the bell passing between the legs.

**Kettlebell Clean** has only the flawed candidate at file (10) (see "Do not ship" below) — treat it as effectively missing a shippable image too.

Separately, outside Batch 2: the Batch 1 note that **Clean and Press** and **Snatch** needed regenerating as 2-panel images does not appear to have been fulfilled — only Turkish Get-Up shows up as a genuine 2-panel image among the 20. Both regenerations are still outstanding.

## Do not ship

- **`a-single-athletic-male-figure--short-brown-hair--b (10).png`** (candidate Kettlebell Clean) — the gripping hand appears to wrap around the round ball of the bell rather than the handle, and the elbow is flared out and raised near the face instead of tucked vertically against the ribs. This is the specific "elbow flared away from the ribs" mistake the app already warns about in its own cue text for this exercise — regenerate rather than ship.

No other image showed a rounded lower back under load, a bent wrist under load, an extra/missing limb, a malformed hand, or a bell that isn't actually being held by its handle.

## Grid cells not shipped, and why

These come off the two sheets in `media-source/`, not from the individual stills,
so they are outside the "Do not ship" list above — that one names filenames and
these are cells. `scripts/slice-grid.mts` carries `null` for each, with the same
reason written beside the id.

| Sheet, cell | Intended exercise | Why it does not ship |
|---|---|---|
| grid-01, cell 1 | `two-hand-swing` | Not a fault — superseded. This single frozen pose is replaced by a proper 2-panel still, `two-hand-swing-hinge-to-standing.png`: the hinge, then standing tall with the bell floated to chest height. Left `null` so this sheet can never overwrite the better version back in. |
| grid-01, cell 4 | `clean-and-press` | The figure holds **two** bells, one pressed overhead and one racked with the elbow away from the ribs. The lift is one bell, single-arm, and its cues say to spear one hand through the handle. |
| grid-01, cell 7 | `single-arm-swing` | Not a fault — superseded the same way as cell 1, by the 2-panel `single-arm-swing-hinge-to-standing.png`: the hinge, then standing tall with the bell forward at chest height, one hand. |
| grid-01, cell 12 | Front Raise | Dropped from the app: not real kettlebell programming. |
| grid-02, cell 2 | `clean`, front view | Not a fault, just second best. Only one file can be `clean.webp`, and the side view in cell 1 shows what the cue asks for: forearm vertical against the ribs, elbow tucked, wrist straight. |
| grid-02, cell 4 | `high-pull` | Drawn with **both** hands on the handle and both elbows flared wide. The lift is one bell, unilateral, and its cues say one hand on the handle with the free arm out of the way. |
| grid-02, cell 11 | `floor-pullover` | **Both palms are splayed flat on the round BALL of the bell, with the handle hanging unused below it.** The exercise's own setup cue reads "hold the bell by the horns with both hands", so the picture contradicts its own caption — and a still was already banned from this app for the same fault (see "Do not ship"). A regeneration must be checked against this line before it ships: **both hands on the horns of the handle, never on the ball**, elbows soft, ribs down. Two panels: the bell over the chest, and the far end of the range. |

## Notes on pictures that do ship

- **`bent-over-row`** — the picture braces the free hand on a **bench**, but the
  exercise declares `needsBench: false` and that is correct: a bent-over row needs
  a hinge and a free hand on the thigh, which is what its own setup cue says. The
  data is not changed to match the drawing. If the bench in the picture ever reads
  as a requirement to a user, the fix is a new picture with the free hand on the
  thigh, not a new flag on the exercise.
- **`racked-front-squat`** — the shorts are drawn with an odd sweeping loop around
  the left hip that reads as a stray shape rather than a garment. It is an artwork
  wobble in the source still, not a form fault: the grip, the rack, the depth and
  the knee tracking are all right, so it ships. Worth replacing if the still is
  ever regenerated.

## What the dark-background conversion costs

Turning the white source sheets into dark card images means deciding which enclosed
white regions are background and which are part of the drawing. The rule fills any
enclosed light region whose colour matches the exterior and which sits further from
the exterior than the outline is thick. It deliberately ignores region SIZE — an
earlier version used an area threshold and shipped nine tiles with white pockets in
them, because a real background pocket can be as small as 0.1% of the image.

The cost is that a flat white detail fully enclosed by the figure is treated as
background. Five tiles lost decoration this way:

| Tile | What it lost |
|---|---|
| `single-leg-deadlift` | the white shorts stripe, entirely (758px) |
| `floor-press` | the shorts stripe (1084px) and the ankle sock, now dark grey (1412px) |
| `racked-front-squat` | the lower two-thirds of the white hip crescent (715px) |
| `turkish-get-up` | the LEFT panel's stripe (475px); the right panel keeps its own |
| `farmers-carry` | a thin sliver (162px) |

All 24 grid tiles keep their stripes, so the seam is two stills in plain black shorts
beside 24 striped ones, plus the get-up disagreeing with itself panel to panel.

**The trade-off is deliberate and it is the right way round.** The alternative is
white pockets inside the figures, which is far more visible on a dark card than a
missing stripe. Judgement on the get-up mismatch: not worth regenerating. The stripe
is a few pixels at the size the card actually displays, and the two figures differ in
pose and scale anyway, so the eye does not read them as a matched pair.

**If you regenerate any of these images**, know that a flat white detail fully
enclosed by the figure will be removed. Ask for the stripes to carry a thin outline
and they will survive.

## Notes on pictures that do ship

- `bent-over-row` shows a bench, but the exercise declares `needsBench: false` and
  that is correct — the movement needs no bench. Benchless users will see equipment
  they do not have. Cosmetic; regenerate when convenient.
- `racked-front-squat` has an odd loop on the shorts. An artwork wobble in the
  source, not a form fault.
