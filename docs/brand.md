# Jotaish brand guidelines

Everything here comes from the logo: a gold crescent holding a four-point
star, a thin orbit line with three planets, and three circuit legs below.
It says two things at once: the night sky of Jyotish, and a guide that is
always on. The look should feel calm, warm and modern, never like clip-art
astrology.

## Logo

- Mark: `apps/web/public/brand/mark.svg`. Icons are generated from it with
  `node scripts/brand-icons.mjs`.
- Wordmark: "Jotaish" in Sora SemiBold, next to the mark, in Gold 200.
- Keep clear space around the mark of at least a quarter of its width.
- Use the mark on Night backgrounds. On white (emails, PDFs) it sits on a
  Night band.
- Never recolour, outline, stretch or add effects to the mark.

## Colour

The logo's gold is the only loud colour. Everything else is night sky.

| Role | Name | Hex | Use |
| --- | --- | --- | --- |
| Primary | Gold 400 | `#F9C23C` | Main buttons, active tab, key numbers, the star |
| Primary light | Gold 200 | `#FDE98C` | Headings on dark, wordmark, highlights |
| Primary deep | Gold 600 | `#F5A51E` | Pressed states, the warm end of gradients |
| Secondary | Orbit violet | `#8F7CFF` | Jotaish and AI moments, your chat bubbles, Rahu/Ketu, focus rings |
| Accent | Dawn rose | `#FF8FA3` | Sparingly: love and matching, reversed cards |
| Background | Night 950 | `#0C0A1C` | Page background |
| Surface | Night 900 | `#141129` | Cards, sheets, tab bar |
| Raised | Night 800 | `#1D1938` | Inputs, selected rows, chips |
| Line | Night 700 | `#2A2550` | Borders, dividers, orbit lines |
| Text | Starlight | `#F3F0FF` | Body text |
| Muted text | Haze | `#ABA5CF` | Secondary text |
| Faint text | Dusk | `#736E9A` | Hints, timestamps |
| Success | Jade | `#5FD4A0` | Saved, approved |
| Error | Ember | `#F47C7C` | Errors, rejected |

Brand gradient, from the logo: `linear-gradient(135deg, #FDE98C, #F9C23C 55%, #F5A51E)`.
Use it for the primary button and hero numbers, not for large areas.

Background glow: soft radial washes of violet (top right) and gold (top
left) at low opacity over Night 950, like the sky just after dusk.

Text on gold is always Night 950. Gold 400 on Night 950 has a contrast of
about 12:1, so gold text is fine for short labels and numbers.

## Type

| Role | Font | Notes |
| --- | --- | --- |
| Display and headings | Sora (600) | Geometric and round like the logo's circles; tight tracking (-0.02em) at large sizes |
| Body and interface | Inter (400, 500) | 16px minimum on phones |
| Indian scripts | Noto Sans Devanagari, Malayalam, Kannada, Bengali | Loaded as fallbacks for both roles |

Scale on phones: 30 / 24 / 20 / 16 / 14 / 12. Headings step up one size
from 640px wide.

## Shapes and motifs

- Circles and pills: buttons and chips are fully rounded; cards use a 24px
  radius, sheets 28px on top.
- Orbit line: a 1.5px line in Line or Gold at 30%, with small filled dots.
  Used for progress through a form (each step a planet on the orbit) and as
  quiet decoration behind heroes.
- Four-point star (✦): the sparkle from the logo. Bullet for highlights,
  the "new" marker, and the icon on primary actions.
- Circuit nodes: small rings joined by lines, from the logo's legs. Used for
  "how it works" steps and connections between people in matching.
- Icons: Lucide, 1.75 stroke, 20px on phones.

## Layout and motion

- Phones first. A bottom tab bar (Today, Ask, Readings, Me) with the safe
  area respected; the content column is 16px from the edges.
- One question per screen in forms, with Continue fixed at the bottom
  within thumb reach.
- Bottom sheets instead of pop-ups on phones.
- Motion is slow and soft: 200 to 300ms ease-out fades and rises. The star
  may twinkle while something is being prepared. Respect reduced motion.

## Voice

Warm, clear and guiding, never fatalistic. Jotaish explains, suggests the
next step and never leaves anyone wondering what to do. Short sentences,
plain words, astrology terms explained the first time they appear.
