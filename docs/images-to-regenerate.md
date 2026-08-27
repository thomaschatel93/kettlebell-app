# Images to regenerate

## Why, in one paragraph

26 of the 31 exercise pictures are under 400px wide. The clean is 90px. All 26 were
sliced off a single 4x4 sheet, so each figure only ever got a sixteenth of the canvas.
The five good ones are the five generated one at a time at 1024px.

That one fact causes all three complaints at once. **Quality**: a 90px drawing shown on
a phone card is blown up about eleven times. **Cutouts**: the script has to find the
figure's edge against white in a low-resolution tile, and at 90px the edge is a guess.
**Panels**: a grid cell has no room for two positions side by side.

Upscaling does not fix it. Interpolation cannot recover detail that was never captured,
and an AI upscaler invents detail — which for a form illustration is the one thing it
must not do. That is how a hand ends up on the ball instead of the handle.

**One exercise per image, at the largest canvas offered.** Then there is no cell to fit
into, no neighbour to be sliced from, and nothing to cut out.

## The master prompt

Paste this once, then feed it one exercise at a time from the lists below. The
description under each name is taken from the app's own cue text, so the picture cannot
contradict the coaching the user reads beside it.

> Create one flat vector fitness illustration.
>
> - A single athletic male figure, clean bold black outlines, flat colour fill, no
>   gradients, no shading beyond one simple highlight.
> - Bright blue short-sleeve t-shirt, black athletic shorts with a single white side
>   stripe, red-and-white trainers, short brown hair.
> - Matte black cast-iron kettlebell with one soft grey highlight on the bell.
> - Pure white background. No shadow, no floor line, no props unless I name one.
> - Side or three-quarter view, whichever shows the movement most clearly.
> - The figure fills most of the frame. Square image, largest size available.
> - **No text, no labels, no captions, no watermark anywhere.**
>
> Anatomy, without exception:
> - Five fingers per hand.
> - The hand grips the kettlebell HANDLE, never the round ball.
> - The wrist stays straight, in line with the forearm, wherever the bell is held.
> - A neutral spine unless the movement requires otherwise. No rounded lower back.
>
> The exercise is: **[NAME]**
> Show this: **[DESCRIPTION]**

For anything marked `[2 panels]`, add:

> Show two positions side by side in the same image, left to right, with a small black
> arrow between them. Same figure, same style, one white background.

For the Turkish get-up, marked `[3 panels]`, ask for three positions in a row.

## If you would rather do grids

Understandable — 44 images is a lot of pasting. Then use **six per image at the largest
landscape canvas**, not twelve or sixteen. Six on a 1536px canvas gives roughly 500px a
figure, against the 200px you have now. Keep every other rule above, especially the ban
on text, which is what made the first sheet awkward to slice.

Do not put the `[2 panels]` ones in a grid. They need the width.

## Before any of these goes in the app

Check the hands, the grip and the spine on each one. Two images have already been
rejected for exactly this: a clean gripping the ball with the elbow flared, and a
clean-and-press holding two bells for a one-bell lift. A picture that contradicts its
own caption is worse than no picture.

---

Generated from the app's own cue text, so the pictures cannot contradict the coaching.


## Batch A — need more than one position (8)

These teach a movement, not a pose. A single frozen frame of a swing at chest height is
indistinguishable from a front raise, which is the error the picture exists to prevent.

Two-Hand Swing and Single-Arm Swing are done: both now ship as 2-panel stills
(`two-hand-swing.webp`, `single-arm-swing.webp`), imported from
`media-source/two-hand-swing-hinge-to-standing.png` and
`media-source/single-arm-swing-hinge-to-standing.png`. See `docs/media-map.md` for
the form assessment.

**Snatch** (`snatch`)  [2 panels]
Bell a forearm’s length in front of you, one hand on the handle. Hinge back, chest proud, free arm out of the way. Hike the bell back, then snap the hips hard. Pull the elbow high and close, then punch your hand through the handle.

**Kettlebell Clean** (`clean`)  [2 panels]
Bell just outside the foot on the working side. Hinge back and grip the handle, free arm out for balance. Hike the bell back, then snap the hips. Keep the bell close and spear your hand through the handle.

**Push Press** (`push-press`)  [2 panels]
Bell in the front rack, forearm vertical, elbow tight to the ribs. Feet hip width, weight through the whole foot. Dip a few inches at the knees with the torso upright. Drive out of the dip and let the legs start the bell moving.

**Figure 8** (`figure-8`)  [2 panels]
Feet a little wider than your hips in an athletic stance. Hinge back with a flat back, bell in one hand in front of you. Pass the bell backwards between your legs. Meet it with the other hand behind the knee and bring it round the outside.

**Clean and Press** (`clean-and-press`)  [2 panels]
Bell just outside the foot on the working side. Hinge back and take a firm grip, free arm out for balance. Hike the bell back, then snap the hips and keep it close to the body. Spear your hand through the handle so it lands in the rack, wrist straight.

**High Pull** (`high-pull`)  [2 panels]
Bell a forearm’s length in front of your toes, one hand on the handle. Hinge back, chest proud, free arm out of the way. Hike the bell back and snap the hips through. As the bell floats up, pull the elbow high and behind you.

**Floor Pullover** (`floor-pullover`)  [2 panels]
Lie on your back with the knees bent and the feet flat. Hold the bell by the horns with both hands over your chest, arms straight and the elbows soft. Press the lower back into the floor and keep it there. Take the bell back over your head only as far as the ribs stay down.

**Turkish Get-Up** (`turkish-get-up`)  [3 panels]
Lie on your back with the bell pressed up over the working shoulder. Bend the knee on that same side with the foot flat; the other arm and leg out at forty-five degrees. Roll onto the free elbow, then up onto the free hand. Bridge the hips up and sweep the straight leg back into a kneeling position.


## Batch B — single position, currently too low-resolution (20)

All sliced off the original sheet. Widths in brackets show what they are now.


**Bent-Over Row** (`bent-over-row`, now 213px)
Hinge forward until the torso is near parallel with the floor. Free hand on your thigh, spine long, bell hanging under the shoulder. Pull the bell to your ribs with the elbow tracking back. Draw the shoulder blade in towards the spine.

**Bulgarian Split Squat** (`bulgarian-split-squat`, now 276px)
Rest the rear foot on a bench behind you, laces down. Bell in the rack on one side, front foot far enough forward to stack the knee over the ankle. Lower straight down until the front knee is at about ninety degrees. Keep the torso upright and the weight in the front heel.

**Dead Row** (`dead-row`, now 209px)
Bell on the floor just outside the foot on the working side. Hinge back with a flat back until the torso is near parallel with the floor, free hand on your thigh. Take the grip, then pull the bell to your ribs with the elbow tracking back. Set it down on the floor and let it settle before the next rep.

**Kettlebell Deadlift** (`deadlift`, now 137px)
Bell between your feet, handle in line with your ankles. Hips back, shins near vertical, chest proud. Take the slack out of the arms before you pull. Push the floor away and stand tall.

**Farmer’s Carry** (`farmers-carry`, now 378px)
A bell either side, handles in line with your feet. Stand up with a flat back. Walk tall with short, quiet steps. Shoulders down and back.

**Front Lunge** (`front-lunge`, now 173px)
Hold the bell at your chest, elbows tucked in. Stand tall with your feet under your hips. Step forward and lower the back knee towards the floor. Keep the torso upright and the weight through the front heel.

**Goblet Carry** (`goblet-carry`, now 128px)
Hold the bell by the horns at chest height, elbows tucked in. Stand tall with the ribs down and the shoulders back. Walk with short, quiet steps. Keep the bell against the chest rather than letting it drift out in front.

**Goblet Squat** (`goblet-squat`, now 130px)
Hold the bell by the horns at chest height, elbows tucked in. Feet a little wider than your hips, toes turned out slightly. Sit down between your hips with the chest tall. Drive the knees out as you descend.

**Half-Kneeling Press** (`half-kneeling-press`, now 229px)
Kneel on the knee on the same side as the bell, the other foot flat in front, both knees at about ninety degrees. Bring the bell into the rack with both hands: forearm vertical, elbow tight to the ribs, wrist straight. Squeeze the back glute and draw the ribs down before you press. Press straight up with the wrist in line with the forearm.

**Halo** (`halo`, now 111px)
Hold the bell upside down by the horns at chest height. Feet hip width, ribs down, glutes braced. Circle the bell around your head, close to the skull. Keep the elbows tight so the bell stays near.

**Overhead Carry** (`overhead-carry`, now 194px)
Press one bell overhead and lock the elbow, wrist in line with the forearm. Shoulder packed down, ribs down, free arm out for balance. Walk with short, quiet steps, the arm staying vertical over the shoulder. Keep the elbow locked and the upper arm close to your ear.

**Overhead Press** (`overhead-press`, now 104px)
Bell in the front rack, forearm vertical, elbow tight to the ribs. Feet hip width, glutes and stomach braced. Press straight up with the wrist in line with the forearm. Finish with the arm by your ear and the shoulder packed down.

**Racked Carry** (`racked-carry`, now 174px)
Bring one bell into the rack with both hands, forearm vertical against the ribs. Elbow tight to the body, wrist straight. Walk tall with short, quiet steps. Keep the elbow glued to the ribs.

**Racked Front Squat** (`racked-front-squat`, now 354px)
Clean one bell into the rack, forearm vertical, elbow tight to the ribs. Feet a little wider than your hips, toes turned out slightly. Sit down between your hips with the chest up. Keep the knees tracking over the toes.

**Reverse Lunge** (`reverse-lunge`, now 171px)
Hold the bell at your chest, elbows tucked in. Stand tall with your feet under your hips. Step straight back and lower the back knee towards the floor. Keep the weight in the front heel and the torso upright.

**Russian Twist** (`russian-twist`, now 209px)
Sit with the knees bent and the heels on the floor. Hold the bell close to your chest with a long spine. Lean back a little and hold that angle. Rotate from the ribs and take the bell across your body.

**Squat to Press** (`squat-to-press`, now 202px)
Hold the bell by the horns at chest height. Feet a little wider than your hips, toes turned out slightly. Squat down between your hips with the chest tall. Stand up and carry that drive into the press overhead.

**Step-Up** (`step-up`, now 156px)
Set a bench or box at about knee height and stand close to it. Hold one bell in the rack or hanging at your side. Place the whole foot on the box, not just the toes. Drive through the front heel to stand up tall.

**Suitcase Carry** (`suitcase-carry`, now 361px)
One bell at your side, handle in line with your foot. Stand up with a flat back, free arm hanging. Walk tall with short, quiet steps. Keep the shoulders level and square.

**Sumo Deadlift** (`sumo-deadlift`, now 184px)
Feet wide, toes turned out, bell between the arches. Hinge back and grip the handle with both hands. Chest up, arms long, take the slack out. Drive the knees out and stand tall.


## Batch C — warm-up and cool-down (14)

Only needed if these become full cards rather than a checklist.
No kettlebell in any of them: same figure, same style, bodyweight movement.

**Marching on the Spot** (`marching-on-the-spot`, warmup)
Stand tall with your feet under your hips. March on the spot, driving each knee up to hip height. Swing the opposite arm with each step.

**Heel Flicks** (`heel-flicks`, warmup)
Stand tall with your feet under your hips. Jog on the spot, flicking each heel up towards your backside. Stay light and keep the contacts quiet.

**Arm Circles** (`arm-circles`, warmup)
Stand tall with your arms out to the sides at shoulder height. Circle the arms forward, letting the circles grow. Halfway through, reverse and circle them back.

**Cat-Cow** (`cat-cow`, warmup)
On all fours, hands under the shoulders, knees under the hips. Round the upper back and drop the head. Reverse it: lift the chest and let the belly sink.

**Leg Swings** (`leg-swings`, warmup)
Hold a wall or door frame and stand on one leg. Swing the free leg forward and back, low and loose at first. Let the range grow as it frees up.

**Hip Hinge** (`hip-hinge`, warmup)
Feet hip width, knees soft, hands flat on the front of your hips. Push the hips straight back and let the chest come forward. Go until you feel the hamstrings, then drive the hips through to stand.

**Glute Bridge** (`glute-bridge`, warmup)
Lie on your back, knees bent, heels close to your hips. Push through the heels and lift the hips into one straight line. Squeeze the glutes at the top, then lower slowly.

**Bodyweight Squat** (`bodyweight-squat`, warmup)
Feet a little wider than your hips, toes turned out slightly. Sit down between your hips with the chest tall. Drive the knees out, then stand up.

**World’s Greatest Stretch** (`worlds-greatest-stretch`, warmup)
Step one foot forward into a long lunge, both hands on the floor inside the front foot. Sink the back hip towards the floor. Reach the inside arm up and turn the chest to follow it.

**Standing Hamstring Stretch** (`standing-hamstring-stretch`, cooldown)
Put one heel on the floor a step in front of you, toes up. Hinge back over the standing leg until the hamstring pulls. Hold there and keep breathing.

**Couch Stretch** (`couch-stretch`, cooldown)
Kneel on one knee with the other foot flat in front. Squeeze the back glute and tuck the hips under. Stand tall through the chest and hold.

**Child’s Pose** (`childs-pose`, cooldown)
Kneel and sit back on your heels with the knees wide. Walk the hands forward and let the chest sink towards the floor. Breathe slowly into the back of the ribs.

**Seated Thoracic Twist** (`seated-thoracic-twist`, cooldown)
Sit cross-legged or on a chair with a long spine. Turn the ribs slowly to one side and hold there. Keep the hips square and the shoulders level.

**Doorway Chest Stretch** (`doorway-chest-stretch`, cooldown)
Forearm flat on a door frame, elbow at shoulder height. Step through slowly until the chest opens. Hold there and keep breathing.
