---
name: masar-design
description: Use this skill to generate well-branded interfaces and assets for Masar (مسار), the bilingual (Arabic/English, RTL+LTR) Smart Childcare Operating System — for production or throwaway prototypes/mocks. Contains design guidelines, colors, type, fonts, logo assets, the signature day-path status system, and UI kit components for the Parent App, Teacher App, and Nursery Manager Dashboard.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files (tokens, components, ui_kits, assets, guidelines/cards).

Masar is a childcare operating system. The signature idea: **a child's day is a path** — the brand mark (two teal "done" dots + one amber "live" dot) is the product's live-status feature. Keep that motif central. Core palette: teal (trust/care) + amber (rationed "live/now" accent) on warm paper surfaces. Type: Plus Jakarta Sans (Latin) + Tajawal (Arabic) + IBM Plex Mono (codes/amounts). Icons: Lucide, 2px stroke. Everything is bilingual — design for both LTR and RTL (`dir="rtl"`), with native Arabic copy, not transliteration. No emoji.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and create static HTML files for the user to view — start from `ui_kits/_shared/masar-ui.jsx` (inline primitives) or the screens in `ui_kits/`, and link `styles.css` for tokens. If working on production code, copy assets and read the rules here to become an expert in designing with this brand; the bundled React components live under `components/` and are exposed on `window.<Namespace>` via the compiled `_ds_bundle.js`.

If the user invokes this skill without other guidance, ask them what they want to build or design (which portal? which screen? EN, AR, or both?), ask a few focused questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
