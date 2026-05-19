# Responsiveness across devices

Target breakpoints (suggested):

| Class            | Width          | Notes |
| ---------------- | -------------- | ----- |
| Mobile portrait  | ≤ 480 px       | Single-hand thumb reach |
| Mobile landscape | 481 – 767 px   | Notch / safe-area insets |
| Tablet           | 768 – 1023 px  | iPad portrait, Surface  |
| Desktop          | 1024 – 1599 px | Standard laptop         |
| Ultrawide        | ≥ 1600 px      | Cap content width       |

Audit the entire site at each breakpoint **with the 3D scene running**, not
just static screenshots — the scene's pixel ratio + camera framing matters.

---

## must — touch / mobile

- [ ] **HUD nav overflows below ~640 px.** `src/ui/Hud.tsx:29-41` — fixed
      `top: 20, right: 24` with `gap: 26` and 3 nav links + ThemeSwitcher +
      avatar + SIGN OUT + DASHBOARD link wraps onto the brand on small screens.
      Add a hamburger / drawer pattern below 768 px. Brand stays top-left,
      nav collapses into a button.
- [ ] **Sign-in card buttons readable but not thumb-sized.** Buttons are
      40 px tall — bump to 48 px on touch devices and increase tap padding.
      `src/ui/SignInCard.tsx:5-20`.
- [ ] **WelcomeOnboarding modal width fits but the serif title (30 px)
      overflows on 320 px screens.** `src/ui/WelcomeOnboarding.tsx` — clamp
      with `font-size: clamp(22px, 5.5vw, 30px)`.
- [ ] **GlassPanel readers assume 560–720 px.** ChroniclesIndex panel and
      ChronicleReader panel use `min(560px, 100%)` and `min(720px, 100%)`,
      which is correct, but inner padding (32 px L/R) eats 64 px on a 360 px
      phone — body text gets cramped. Reduce horizontal padding below 480 px.
      Files: `src/ui/ChronicleReader.tsx`, `src/routes/ChroniclesIndex.tsx`.
- [ ] **Dashboard tables overflow horizontally on phones.**
      `src/routes/Dashboard.tsx` — `ChroniclesManager`, `RecentComments`.
      Wrap each row in a card layout under 720 px instead of `<table>`.
- [ ] **ChronicleEditor modal** is `maxWidth: 720, padding: 28` — survives a
      tablet but cramps a phone. Make the 3-column row (slug / date / author)
      stack on narrow widths. Body textarea needs at least `rows={10}` on
      mobile with `font-size: 16px` (smaller triggers iOS zoom-on-focus).
- [ ] **`safe-area-inset-*` not respected anywhere.** iPhone notch / Android
      gesture bar cuts into the HUD. Add `env(safe-area-inset-top/bottom)` to
      `top`/`bottom` positions on fixed UI.
- [ ] **`100vh` traps on mobile Safari.** Several overlays use `100vh` — when
      the URL bar shows/hides, layout snaps. Use `100svh` (small viewport)
      or `100dvh` (dynamic) with a `100vh` fallback.
- [ ] **Touch targets in CommentRow < 32 px** — delete button (11 px font,
      no padding) is unreachable with a thumb. `src/ui/PostInteractions.tsx`.

## must — 3D scene perf on mobile

- [ ] **PostFX + Bloom run full-res on mobile by default.** `src/scene/PostFX.tsx`
      — set `dpr={[1, 1.5]}` on mobile, drop bloom intensity, or disable
      postprocessing entirely below a certain GPU tier (detect via WebGL
      `RENDERER` string or just `window.matchMedia('(pointer:coarse)')`).
- [ ] **Particle counts on `Fireflies` / `ButterflyTrail` / `FlowerField`
      are unbounded.** Audit each file under `src/scene/` and gate counts on
      device class.
- [ ] **`gl: { antialias: true }` + `dpr: window.devicePixelRatio`** on
      mobile devices with DPR 3 = 9× pixel cost. Cap DPR at 2.

## should

- [ ] **ScrollProgress + PinnedScrollHint overlap content on landscape phones.**
      Hide PinnedScrollHint below `min-height: 600px`.
- [ ] **`Sanctuary` and `Whispers` overlays use `max-height: calc(100vh - 120px)`.**
      With mobile safe areas, content can clip behind the gesture bar.
- [ ] **Font sizing** — most UI uses fixed `px`. Switch the reader body
      (`fontSize: 15`) to `clamp(14px, 1.5vw + 0.5rem, 17px)` so it scales
      with viewport without breaking the design system.
- [ ] **Image / hero gradients are CSS strings, not actual images.** No
      bandwidth concern, but if you later add real `hero` images, use
      `srcset` for responsive variants.

## nice

- [ ] **Keyboard nav audit.** Tab order through HUD → glass panel → comments
      isn't currently tested. Add focus-visible styles and skip-links.
- [ ] **Reduced motion.** No `prefers-reduced-motion` honour anywhere. The
      3D scene + scroll-tied reveals are vestibular triggers — gate the
      smooth scroll provider and the parallax effects.
- [ ] **High-DPI Hud avatar** — it's 26 × 26 with no `srcset`. Provider photos
      from Google are usually larger; pick the appropriate size param.
- [ ] **`vmin` / `cqi` audit.** Container queries would let the GlassPanel
      adapt to its parent, not the viewport, which would simplify several
      "wraps oddly on mid sizes" cases.

## verification checklist (per breakpoint)

- [ ] Home page: 3D scene renders, HUD readable, scroll-tied reveals fire
- [ ] `/chronicles`: list scrolls inside panel, no double-scroll
- [ ] `/chronicles/:slug`: reader scrolls, comments form usable, like button reachable
- [ ] `/sanctuary` and `/whispers`: panels respect safe areas
- [ ] `/dashboard`: editor modal usable, table not horizontally scrolled
- [ ] Welcome onboarding modal appears centered, text not clipped
- [ ] All overlays close via Esc AND via outside-tap
