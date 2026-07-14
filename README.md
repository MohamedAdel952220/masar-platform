# Masar — Design System · نظام مسار للتصميم

**Masar (مسار — "path / route")** is the design system for a bilingual (Arabic / English, LTR + RTL) **Smart Childcare Operating System**: one ecosystem connecting parents, children, teachers, supervisors, drivers, nursery managers, accountants, support, and an AI reporting engine.

The signature idea: **a child's day is a path.** The brand mark — two completed teal dots, one live amber dot — *is* the product's core status feature (At Home → In Bus → Arrived → Classroom → Playing → Nap → Left → Delivered). That mark recurs everywhere as the live-status indicator.

This is **Phase 1**: the three foundational portals — **Nursery Manager Dashboard**, **Parent App**, **Teacher App** — plus the full token, component, and asset foundation. Later phases (Driver app, Supervisor, Accountant, Support, Super Admin, deeper AI reporting, multi-nursery SaaS) extend the same system.

---

## Sources & provenance
Store these even if the reader can't open them today:

- **Uploaded logo concept:** `uploads/daypath_logo_concept.svg` — the original "daypath" progression-dot mark in teal + amber. The mark was kept and refined; the name was changed to **Masar** (native-Arabic meaning, bilingual).
- **Brief:** product spec for the Childcare OS (8 portals, parent/teacher/dashboard priority, EN/AR requirement) supplied by the project owner.
- **Reference skill repos** (browse for deeper technique — animation, motion, web-artifact patterns; nothing was imported wholesale):
  - https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
  - https://github.com/freshtechbro/claudedesignskills (motion-framer, gsap-scrolltrigger, threejs-webgl, animated-component-libraries subtrees)
  - https://github.com/leadgenjay/claude-skills (animation-designer)
  - https://github.com/anthropics/skills (web-artifacts-builder)
  - https://github.com/BehiSecc/awesome-claude-skills
  - https://github.com/avelikiy/great_cto

---

## Brand at a glance
- **Name:** Masar · مسار (path / route / track — child's day-path, bus route, learning journey).
- **Mark:** three dots on a line — `done` (teal) · `done` (teal) · `live` (amber). See `assets/masar-*.svg`.
- **Palette:** calm **teal** (trust & care) + warm **amber** (the single "live / now" accent) on **paper** surfaces (never clinical white).
- **Type:** Plus Jakarta Sans (Latin) · Tajawal (Arabic) · IBM Plex Mono (codes, IDs, amounts).
- **Icons:** Lucide (rounded, 2px stroke).

---

## CONTENT FUNDAMENTALS — how Masar writes

**Voice:** warm, calm, and reassuring to parents; crisp and operational to staff. Masar speaks *to* the reader ("you", "your child") and never about itself in marketing-speak.

- **Tone:** caring but not saccharine. We report a child's day plainly and kindly. Example (parent daily report): *"Yousef had a focused morning — strong participation in English circle and a calm transition into free play. Mood: cheerful."* In Arabic, the same warmth: *«قضى يوسف صباحًا مليئًا بالتركيز…»*.
- **Casing:** Sentence case for UI labels and buttons ("Generate QR", "Track bus", "Add child"). Reserve ALL-CAPS for tiny eyebrows/overlines only (`TEACHER`, `PENDING`), set with wide tracking.
- **Person:** Parent-facing = second person ("your child", "your day path"). Staff-facing = imperative/operational ("Save evaluation", "Send to 6 parents").
- **Bilingual:** Every label has an Arabic equivalent; the app flips to full RTL with `dir="rtl"`. Arabic is *native*, not a literal translation — "In Classroom" → «في الفصل», "Pickup QR" → «كود الاستلام». Status names are localized, never transliterated.
- **Numbers & time:** Mono font, tabular figures. Times like `10:24`, IDs like `MSR-04821`, QR codes like `7K2-9QF`, amounts like `2,400 EGP`.
- **Emoji:** none. Warmth comes from color, rounding, and the soft paper surface — not emoji. Status is communicated by the dot system and Lucide icons.
- **Microcopy vibe:** short, concrete, child-centered. "Where every child is, right now." "AI daily reports are ready." Avoid jargon, avoid hype.

---

## VISUAL FOUNDATIONS

**Color.** Teal is the brand spine (`--teal-600 #0F6E56` primary, deepening to `--teal-900 #0E2422` for dark surfaces and the sidebar). Amber (`--amber-500 #EF9F27`) is *rationed* — it means "live / happening now / needs attention" and nothing else, so a pulsing amber dot always reads as real-time. Neutrals are a **warm sand/stone** ramp, not cool grey; the default app background is paper `--neutral-100 #F5F3EE`. Each of the 8 portals carries a **role accent** (parent=teal, teacher=violet, driver=blue, supervisor=terracotta, …) for instant orientation. Semantic set: success green, warning amber, danger warm-red, info blue.

**Type.** Plus Jakarta Sans — friendly geometric, warm without being childish, great at dense dashboard sizes and roomy mobile. Display weights 800/700 with tight tracking (`-0.02em`); body 400/500 at 15px. Arabic uses Tajawal at matching weights (tracking neutralized in RTL). Mono (IBM Plex Mono) for anything you'd scan digit-by-digit. Scale runs 11 → 46px on a ~1.2 ratio.

**Spacing & layout.** 8px base grid (`--space-*`). Desktop: 264px dark sidebar + sticky topbar + 32px content padding. Mobile: 390px frame, 18px gutters, 44px minimum tap target, bottom tab nav. Generous breathing room; dashboards are dense but never cramped.

**Surfaces & cards.** Cards are white (`--surface-card`) on paper, `--radius-lg (20px)`, hairline border `--neutral-300`, and a **soft, warm-tinted shadow** (`--shadow-sm` resting). Interactive cards lift `-2px` to `--shadow-md` on hover. Optional 3px **left role-stripe** for accenting (e.g. a teacher note). Mobile surfaces go larger-radius (`--radius-xl 28px`); bottom sheets use `28px 28px 0 0`.

**Backgrounds.** Flat paper and warm-neutral fills — **no decorative gradients** except two intentional uses: the bus map placeholder (subtle teal→stone) and progress fills. Dark surfaces are solid deep-teal `--teal-900`, used for the sidebar and "hero" feature cards (Learning Journey, AI reports banner). No photographic hero imagery in the system itself (real child photos are user content, shown in avatars and media tiles).

**The dot / path motif.** The most important visual pattern. `DayPath` renders the day as dots + connectors: filled teal = done, hollow = pending, amber-with-halo = live. Connectors are teal-40% behind completed steps, hairline ahead. It appears horizontally (parent home, child row), vertically (bus trip, learning path), and miniaturized (the logo). The `StatusPill` is its inline cousin.

**Motion.** Restrained and gentle. `--ease-out` for most transitions, `--ease-spring` (gentle overshoot) sparingly. Durations 120/200/320ms. Bottom sheets slide up (`translateY 100%→0`). The amber live-dot carries a static halo (`--shadow-amber`) rather than a distracting loop. No bouncy/infinite decorative animation.

**States.** Hover = `brightness(0.94)` (buttons) or shadow-lift (cards). Press = `scale(0.98)`. Focus = `--border-focus` teal border + 3px `--focus-ring` halo. Disabled = 50% opacity, `not-allowed`. Selected (chips, segmented controls) = tinted role surface + colored border.

**Borders & radii.** 1px hairlines in warm `--neutral-300`; 1.5px for inputs and emphasis. Radii: 6 / 10 / 14 / 20 / 28 + pill. Default card/input = 14–20px; pills for badges, status, and toggles.

**Transparency & blur.** Used only for overlays: scrim `rgba(14,36,34,.46)` + a light `blur(2px)` behind modals/sheets. UI surfaces are otherwise opaque.

---

## ICONOGRAPHY
- **System:** [Lucide](https://lucide.dev) — rounded caps/joins, **2px stroke**, friendly geometric. Matches the warmth of Plus Jakarta Sans without being childish.
- **Delivery:** loaded from CDN (`https://unpkg.com/lucide`). The `Icon` component (and the kits' shared `Icon`) render each glyph **inline as an SVG** built from `window.lucide.icons[Name]` — *not* via `createIcons()` DOM replacement — so icons survive React re-renders without reconciliation crashes. See the iconography specimen card.
- **Color rule:** icons default to `currentColor` / ink. **Amber is reserved** for live/alert icons (bell with unread, bus in transit) only — never decorative.
- **No emoji, no unicode-as-icon.** A small curated key set maps to product concepts: `house, bus, graduation-cap, moon (nap), qr-code, bell, map-pin, calendar-check, book-open, sparkles (AI), heart-handshake, credit-card, message-circle, users, clipboard-list, smile (mood)`.
- **Substitution flag:** no icon set was supplied with the brief, so Lucide was chosen as the closest fit to the rounded, warm mark. Swap freely if you adopt a licensed set later.

---

## INDEX — what's in this project

**Root**
- `styles.css` — the entry point consumers link (only `@import`s).
- `README.md` — this file. · `SKILL.md` — portable Agent-Skill wrapper.

**`tokens/`** — `fonts.css` (Plus Jakarta Sans / Tajawal / IBM Plex Mono via Google Fonts), `colors.css`, `typography.css`, `spacing.css` (spacing, radius, shadow, motion, layout).

**`assets/`** — `masar-mark.svg`, `masar-logo.svg`, `masar-logo-dark.svg`, `masar-logo-ar.svg`, `masar-appicon.svg`.

**`components/`** (reusable React primitives; `<Name>.jsx` + `.d.ts` + `.prompt.md`, one card HTML per group)
- `core/` — **Button, Badge, Card, Avatar, Input, Icon**
- `status/` — **DayPath** (signature), **StatusPill** (8 bilingual day-states)
- `data/` — **StatCard**
- `navigation/` — **Tabs**

**`ui_kits/`** (high-fidelity interactive recreations; each is standalone)
- `_shared/masar-ui.jsx` — inline primitives shared by the kits.
- `parent-app/` — bilingual mobile app: child dashboard + day-path, daily report, learning journey, live bus tracking, QR pickup, payments. Multi-child switcher, EN/AR toggle.
- `teacher-app/` — mobile: my subject, today's classes, class roster + attendance, individual evaluation, **bulk evaluation**, media upload.
- `nursery-dashboard/` — desktop manager control center: overview (live-now distribution, recent activity, AI reports banner), children table, attendance, payments, + teacher/classroom/bus/reports views.

**`guidelines/cards/`** — foundation specimen cards rendered in the Design System tab (Colors, Type, Spacing, Brand).

**`explorations/`** — `Brand Exploration.html` (the original name+logo evaluation: Masar vs daypath vs Nurtura).

---

## Using the system
Link the tokens, then either compose the bundled components or copy a kit screen as a starting point:

```html
<link rel="stylesheet" href="styles.css">
<!-- React components: load _ds_bundle.js, then -->
<script>const { Button, DayPath, StatusPill } = window.MasarDesignSystem_dfb72a;</script>
```

> **Note on fonts:** the webfonts load via a Google Fonts `@import` in `tokens/fonts.css` (so the DS compiler reports 0 local `@font-face` files — expected). If you need fully self-hosted fonts for offline/production, drop the `.ttf`/`.woff2` files into `assets/fonts/` and replace the `@import` with local `@font-face` rules. **Flag for the owner:** confirm Plus Jakarta Sans + Tajawal are acceptable, or send preferred brand fonts to substitute.
