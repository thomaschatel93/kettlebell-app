# Installing it on the phone

Everything in this document needs a physical iPhone. None of it can be checked
from a desk, which is why it is a checklist for you rather than a test in the
suite: a simulator will happily report a wake lock that a real screen ignores,
and no browser on a laptop can tell you whether a beep carries over music.

Work through it in order. Each step says what it is actually checking and what
"wrong" looks like, so a half-pass is not mistaken for a pass.

---

## 1. Get it onto the Home Screen

Open the deployed URL in **Safari** — not Chrome, not a link opened inside
another app. Share, then **Add to Home Screen**, then Add.

- **Right:** the icon on the Home Screen is the orange kettlebell on near-black,
  and it is named Kettlebell.
- **Wrong:** the icon is a small screenshot of the page, or a white square. That
  means `apple-touch-icon.png` did not load. Check it resolves at
  `<your-url>/icons/apple-touch-icon.png`.

## 2. Open it and look at the top and bottom of the screen

Launch it from the Home Screen icon, not from Safari.

- **Right:** no address bar, no toolbar, no Safari chrome at all. The tab bar's
  labels sit above the home indicator, not under it.
- **Wrong:** an address bar at the top means it is running as a web page, not an
  installed app — the manifest or the capable meta did not reach the device.
  Delete it from the Home Screen, hard-refresh in Safari, and add it again.
- **Also wrong:** the bottom row of tab labels touching or hidden behind the
  home indicator bar. That is `viewport-fit=cover` or the safe-area insets not
  applying.

## 3. Set the kit up **inside the installed app**

This is the step that catches people out, so do it deliberately.

iOS keeps a **separate storage partition** for an installed web app and for
Safari. A kit you entered in Safari while testing is not there when the
installed app opens: same site, same URL, different box. The installed app
starts with nothing.

So: in the installed app, go to Kit, add your bells, set where you train and set
the capability.

- **Right:** Kit shows your bells. Close the app fully (swipe it away from the
  app switcher), reopen from the Home Screen, and they are still there.
- **Wrong:** the bells are gone after a relaunch. That is storage not
  persisting, which is a real bug — not the partition, which only explains the
  first empty screen.

## 4. Run a real workout with the phone where you actually put it

Generate a workout, start it, and put the phone down where it lives during a
session — floor or bench, about a metre away. Then work, do not just look.

- **The countdown** should be readable without leaning in.
- **The move name** should be readable without leaning in.
- **On a one-sided move, the LEFT / RIGHT pill** should be readable without
  leaning in. This one matters most: misreading it costs a whole set on the
  wrong arm.
- **Wrong:** any of the three needing you to pick the phone up, or to squint.
  Say which one and it gets made bigger.

## 5. Play music, then listen for the cues

Start whatever you normally train to, at the volume you normally train at.
Then let a rest run down to zero without touching the phone.

- **Right:** the three ticks in the last three seconds and the tone at zero are
  audible over the music, from a metre, without you watching the screen.
- **Wrong:** you only notice the rest ended because you happened to look. Note
  whether the ticks were inaudible or merely late — those are different faults
  and they get fixed differently.
- **Also check:** the very first cue of the session plays. iOS will not let a
  page make a sound until you have tapped it once, so if the first tick of the
  first rest is silent and every later one works, that is the unlock, not the
  audio.

## 6. Leave the screen alone for two minutes

During a long rest, do not touch the phone.

- **Right:** the screen stays lit for the whole rest.
- **Wrong:** the screen dims or locks. Then re-open the app: the countdown must
  show the time that has **actually** passed, not the time it had when the
  screen went dark. It reads the clock rather than counting down, so a stalled
  screen should cost nothing but the light. If it comes back reading full, that
  is a real bug and worth reporting.

## 7. Finish the session and check it was written down

Tap through to the end, or use Exit → End here partway.

- **Right:** the Done screen appears, and the session is on History with the
  date and the minutes worked.
- **Wrong:** History is empty or shows the session before this one.

---

## What is deliberately not here

**There is no service worker,** so there is no offline caching. The app will not
load with no signal on a cold start. This was a decision, not an oversight:
precaching is the most failure-prone part of a build like this and the least
load-bearing for a phone that sits on Wi-Fi at home. If a missing signal ever
costs you a workout, that is the moment to add one — and not before.

**The deployed URL is public.** Nothing in the app is sensitive — no account, no
personal data leaves the phone, and your kit and history live only in that
phone's storage — but the page itself is reachable by anyone with the link.
