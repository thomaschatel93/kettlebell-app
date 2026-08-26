# Exercise image brief

One still per exercise. Style must match the first grid you supplied: flat vector
illustration, bold black outline, one athletic male figure, blue short-sleeve
t-shirt, black shorts with a white side stripe, red-and-white trainers, matte
black kettlebell, pure white background, no shadow, no ground line.

**Ask for no text in the image.** The app renders the exercise name itself, and
baked-in labels ruin the crop.

---

## Batch 1 — already covered by your grid (16)

These get sliced out of `media-source/grid-01.png`. No new generation needed.

| # | Exercise | Pattern | Note |
|---|----------|---------|------|
| 1 | Two-Hand Swing | Hinge | good |
| 2 | Goblet Squat | Squat | good |
| 3 | Deadlift | Hinge | good |
| 4 | Clean and Press | Push | shows lockout only, regenerate as 2-panel |
| 5 | Front Lunge | Squat | good |
| 6 | Sumo Deadlift | Hinge | good |
| 7 | Single-Arm Swing | Hinge | good |
| 8 | Overhead Press | Push | good |
| 9 | Russian Twist | Core | good |
| 10 | Step-Up | Squat | good |
| 11 | Bent-Over Row | Pull | good |
| 12 | Front Raise | Push | drop, not real kettlebell programming |
| 13 | Snatch | Hinge | shows lockout only, regenerate as 2-panel |
| 14 | Halo | Core | good |
| 15 | Reverse Lunge | Squat | good |
| 16 | Squat to Press | Full body | good, and the 2-panel format works well |

## Batch 2 — need generating (14)

The gaps that stop the generator from building balanced routines. Carries are the
whole missing pattern.

| # | Exercise | Pattern | Form to specify in the prompt |
|---|----------|---------|-------------------------------|
| 17 | Kettlebell Clean | Hinge | bell landing in the rack, forearm vertical against ribs, elbow tucked, wrist straight |
| 18 | Racked Front Squat | Squat | bottom of squat, one bell in the rack, chest up, knees tracking over toes |
| 19 | Push Press | Push | mid-drive, slight knee dip finishing, bell travelling overhead, arm not yet locked |
| 20 | Floor Press | Push | lying on back, knees bent, one bell pressed up, opposite arm flat on the floor |
| 21 | Single-Leg Deadlift | Hinge | torso and rear leg forming one straight line parallel to the floor, bell hanging |
| 22 | Farmer's Carry | Carry | walking, one bell in each hand at the sides, shoulders down, tall spine |
| 23 | Suitcase Carry | Carry | walking, one bell in one hand only, torso resisting the lean, shoulders level |
| 24 | Racked Carry | Carry | walking, one bell in the front rack position, elbow tight to the ribs |
| 25 | Turkish Get-Up | Core | **3-panel**: lying press-up to elbow, then the tall kneeling position, then standing, bell locked overhead throughout. Two panels cannot carry a six-position movement |
| 26 | Windmill | Core | bell locked overhead, opposite hand reaching to the inside of the front foot, eyes on the bell |
| 27 | Renegade Row | Pull | high plank on two bells, one bell rowed to the ribs, hips square and level |
| 28 | High Pull | Pull | bell at chest height, elbow high and behind, hips fully extended |
| 29 | Bulgarian Split Squat | Squat | rear foot on a bench, front knee at ninety degrees, bell held in the rack |
| 30 | Figure 8 | Core | athletic stance, bell passing backwards between the legs, hand meeting it behind the knee |

## Batch 3 — warm-up and cool-down (12, lower priority)

Bodyweight, no kettlebell. Same illustration style, same figure.

Hip circles, leg swings, cat-cow, world's greatest stretch, arm circles,
bodyweight squat, glute bridge, couch stretch, standing hamstring stretch,
child's pose, seated thoracic twist, doorway chest stretch.

---

## Master prompt for ChatGPT

Paste this once, then feed it one exercise at a time from the tables above.

> Create a flat vector fitness illustration in this exact style, and keep the
> style identical across every image I ask for:
>
> - A single athletic male figure, clean bold black outlines, flat colour fill,
>   no gradients, no shading beyond one simple highlight.
> - Wearing a bright blue short-sleeve t-shirt, black athletic shorts with a
>   single white side stripe, and red-and-white trainers. Short brown hair.
> - Matte black cast-iron kettlebell with a single soft grey highlight on the bell.
> - Pure white background. No shadow, no floor line, no props unless I name one.
> - Side or three-quarter view, whichever shows the movement most clearly.
> - Square image, the figure filling most of the frame.
> - **No text, no labels, no captions, no watermark anywhere in the image.**
>
> The exercise is: **[NAME]**.
> Show this exact position: [FORM DESCRIPTION FROM THE TABLE].
> Anatomy must be correct: five fingers per hand, a neutral spine unless the
> movement requires otherwise, and a wrist that stays straight in line with the
> forearm wherever the bell is held.

For the 2-panel ones (Turkish Get-Up, Snatch, Clean and Press), add:

> Show two positions side by side in the same image, left to right, with a small
> black arrow between them. Same figure, same style, both on the one white
> background.

---

## Before an image goes in the app

Check the hands, the grip, and the spine. Image models get wrists and fingers
wrong, and a picture showing a rounded back on a deadlift teaches the injury.
Regenerate anything that looks off rather than shipping it.
