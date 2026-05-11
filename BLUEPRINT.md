# Master Build Prompt — "Ethereal Valley"
### An All-3D Bioluminescent Blog & Documentary Site

---

## 0. How to use this document

Paste the entire file into a high-reasoning coding model (Claude Opus, GPT-5, Gemini 2.5 Pro) as the opening message of a fresh session, then ask it to begin **Part 5** of the build (Parts 1–4 are complete). Keep the file checked into the repo as `BLUEPRINT.md` so the model can reload it in later sessions. Every section below is a hard requirement unless explicitly marked *optional*.

**Critical workflow rule:** the build is divided into 12 numbered Parts. The model must complete **one Part at a time**, stop, and wait for the user's review and explicit approval before starting the next Part. This is enforced in Section 13.

> **Status note:** Parts 1–4 are complete. Foundation, scroll-spline, routing, and the Act I flower field are built and approved. Begin from **Part 5**.

---

## 1. The Vision (read this first)

Build a **scroll-driven cinematic blog site** that feels like one continuous flight through a nocturnal bioluminescent world. The journey is a single uninterrupted camera move: the user begins panning low over a glowing flower field, drifts forward into a dark forest of impossibly tall trees, follows a silver river deeper in, then rises through the canopy and ascends toward a huge full moon that dominates the final frame.

Under the hood it is a real React application with real URLs and real routes — `/chronicles/some-post` works, browser back/forward works, SEO works, deep-linking works. But the **primary UX is the scroll itself**: as the camera flies, blog content reveals progressively as **glassmorphism panels** that fade in, hold, and fade out at scripted scroll ranges. The user does not click into a "page" — the page comes to them as the world unfolds.

The aesthetic is **"Atmospheric Contrast":**
- **The world** is dark, organic, mystical — deep navy-to-black, cyan and royal-blue emissive glows, soft gold firefly motes, silver moonlight.
- **The interface** is sharp, modern, translucent — frosted-glass panels, hairline white borders, minimal sans-serif type, drifting in from the edges of the frame as the camera flies.

Think: high-end nature cinematography (Planet Earth at night) meets a futuristic operating system rendered on glass, scored to the rhythm of scroll.

---

## 2. Visual Reference — Four Anchor Frames

The scroll journey has **four acts**, each matching one reference composition. Treat these as the look-dev target.

### Frame A — The Flower Field *(`scroll ≈ 0.00 – 0.20`)*
- Camera pans low and forward over a dense carpet of bioluminescent blue five-petal flowers with white starburst centers on dark green foliage.
- Background nearly black; flowers glow blue against it.
- Golden firefly specks scattered throughout at varying focal depths.
- Camera starts almost top-down and tilts forward as scroll advances, revealing the horizon line where the field meets the treeline.
- **(Already built in Part 4.)**

### Frame B — The Dark Forest *(`scroll ≈ 0.25 – 0.55`)*
- Camera glides forward at near-ground level into a forest of very tall, narrow conifers — trunks rising far beyond the top of the frame, canopy implied but not visible.
- Shafts of pale moonlight cut down between trunks; volumetric god-rays pick up firefly motes.
- Forest floor is dark earth with occasional patches of the bioluminescent flowers nestled at the bases of trees.
- Atmospheric fog thickens with depth; visibility is shallow, intimate, almost claustrophobic.
- Color palette deepens to nearly black with cyan accents on flower glow and silver-white on the light shafts.

### Frame C — The Silver River *(`scroll ≈ 0.55 – 0.80`)*
- Camera now travels alongside (and slightly above) a glowing silver river that snakes through the forest floor.
- The river is the main light source in the frame — emissive cyan-white with a soft fresnel rim, scrolling caustic-like noise on its surface.
- Tall trees flank both banks; their trunks catch the river's underlight on the inside-facing edges.
- Camera follows the river's bend, drifting forward and slowly rising.
- Fireflies hover thicker over the water.

### Frame D — The Moonrise *(`scroll ≈ 0.80 – 1.00`)*
- Camera rises through gaps in the canopy and tilts up; trees fall away below.
- A huge full moon dominates the upper third of the frame, silver-white with a soft bloom halo.
- Thin clouds drift across the moon; stars are visible around it.
- The final composition is the moon centered, treetops silhouetted at the bottom, river just barely visible far below as a faint glowing thread.
- This is the resting frame — the journey's destination.

The camera spline must hit each of these compositions at the corresponding scroll position. Transitions between acts are continuous — no cuts, no jumps.

---

## 3. Technical Stack (locked)

| Layer | Tool | Notes |
|---|---|---|
| Framework | **React 18 + Vite** | TypeScript |
| Routing | **React Router v6** | Real URLs, real navigation, used for deep-linking posts |
| 3D renderer | **React Three Fiber** (`@react-three/fiber`) | Three.js r160+ |
| 3D helpers | **@react-three/drei** | For `<Sky>`, `<Stars>`, `<Html>`, `<Text>`, `<Float>` |
| Post-processing | **@react-three/postprocessing** | Bloom, Vignette, DoF, Chromatic Aberration, God-Rays |
| Scroll-driven animation | **GSAP + ScrollTrigger** | Camera spline + glass-panel reveal timeline |
| Smooth scrolling | **Lenis** | Mandatory — eliminates scroll jitter |
| Crisp 3D text | **troika-three-text** (via drei `<Text>`) | MSDF rendering |
| Styling | **Tailwind CSS v4** | For glassmorphism overlay UI |
| State | **Zustand** | scrollProgress, activeAct, revealedPanels |
| Content | **MDX** files in `/content/chronicles/` | Blog posts as MDX, parsed and rendered inside scroll-revealed panels |
| SEO | **react-helmet-async** | Per-route `<title>` and meta tags |

No alternative substitutions without explicit user approval.

---

## 4. Routing Philosophy (revised — read carefully)

The primary experience is the **single scroll journey on `/`**. Routes exist for deep-linking, SEO, and direct access to specific content, but they are secondary to the scroll.

### Route map

| URL | What it shows | Behavior |
|---|---|---|
| `/` | The full scroll journey (Acts I → IV) with all glass panels revealing in sequence | Default landing experience |
| `/chronicles` | Same scroll journey, but scroll position is preloaded to the Chronicles reveal range and the Chronicles index panel is pinned open | Camera snaps to the corresponding scroll position on cold load |
| `/chronicles/:slug` | Same scroll journey, scroll preloaded to that post's reveal range; that post's full-content panel is pinned open | Camera snaps; panel pinned |
| `/sanctuary` | Scroll preloaded to Sanctuary reveal range; login panel pinned | Camera snaps |
| `/whispers` | Scroll preloaded to Whispers reveal range; guestbook panel pinned | Camera snaps |
| `*` (404) | Camera held at moon (`scroll = 1`); glass panel with "lost in the canopy / return home" | — |

### Behavior rules

1. **Default route `/`:** scroll fully drives the camera and the reveal timeline. Glass panels appear, hold, and dismiss according to scroll position. The user is never "interrupted" — there are no modal interrupts in the default flow.

2. **Named routes (e.g. `/chronicles/post-name`):** treated as **deep-link bookmarks** into the scroll journey. On cold load, after the loader resolves, the camera snaps (no fly-through) to the scroll position that corresponds to that piece of content, the matching glass panel opens **pinned** (does not auto-dismiss on scroll), and a subtle "scroll to continue exploring" hint appears. The user can scroll away; doing so unpins the panel and resumes normal reveal behavior.

3. **Browser back/forward:** triggers the same snap-to-scroll-position logic. No animated lerp on history navigation — it should feel like teleporting to a chapter.

4. **Closing a pinned panel** calls `navigate('/')` and unpins. Scroll behavior resumes normally from the current position.

5. **SEO:** each named route sets its own `<title>` and `<meta description>` via react-helmet-async. Blog post MDX content must be rendered into the DOM (inside its panel, even when not yet revealed by scroll) so crawlers can index it; use `visibility: hidden` + `pointer-events: none` rather than `display: none` so the content is present in the DOM tree.

6. **Sharing a link** to `/chronicles/some-post` must reliably land any visitor on that post's panel, regardless of which device or scroll-restoration behavior their browser uses.

---

## 5. The World Engine (core architecture)

```
<App>
  └── <BrowserRouter>
       └── <HelmetProvider>
            └── <Loader />                       // "Seed of Light" pulse, blocks until assets ready
            └── <SmoothScrollProvider>           // Lenis
                 └── <RevealLayer>               // DOM overlay — glass panels driven by scroll
                      └── <Hud />                // Persistent top bar (wordmark + scroll progress)
                      └── <RevealPanels />       // All glass content panels, position: fixed, opacity driven by GSAP
                 └── <Canvas>                    // The entire 3D world
                      └── <Suspense>
                           └── <CameraRig />     // Reads scroll (and route deep-link target) → moves camera along spline
                           └── <Environment />   // Sky, moon, stars, clouds, volumetric fog
                           └── <FlowerField />   // 10k InstancedMesh ground flowers (Act I) — built
                           └── <DarkForest />    // Tall instanced conifers, god-ray light shafts (Act II)
                           └── <BiolumeRiver />  // Custom shader plane following 3D Catmull-Rom curve (Act III)
                           └── <Moon />          // Large textured sphere + bloom halo + drifting cloud planes (Act IV)
                           └── <Fireflies />     // THREE.Points, ~150 nodes, Perlin-noise drift (all acts)
                           └── <PostFX />        // Bloom + Vignette + DoF + Chromatic Aberration + God-Rays
```

### Camera spline definition (revised)

A single `CatmullRomCurve3` interpolating these waypoints. Tune visually against the four reference frames.

```
t=0.00   pos=[ 0, 12,  20 ]   lookAt=[ 0, 0,   0 ]      // Frame A: low pan over field, tilted ~50° down
t=0.20   pos=[ 0,  6,   0 ]   lookAt=[ 0, 3, -25 ]      // tilting forward, horizon revealed, treeline ahead
t=0.35   pos=[ 0,  3, -25 ]   lookAt=[ 0, 4, -55 ]      // entering forest, near ground level
t=0.50   pos=[ 0,  3, -60 ]   lookAt=[ 0, 5, -90 ]      // Frame B: deep in dark forest
t=0.65   pos=[ 4,  5, -95 ]   lookAt=[-2, 4, -125 ]     // beside the river, slight bank
t=0.78   pos=[ 0,  8, -130 ]  lookAt=[ 0, 8, -160 ]     // Frame C: river vista, camera rising
t=0.90   pos=[ 0,  20, -160 ] lookAt=[ 0, 30, -200 ]    // breaking canopy, tilting upward
t=1.00   pos=[ 0,  35, -180 ] lookAt=[ 0, 80, -260 ]    // Frame D: moon centered, treetops below
```

Scroll position (0–1) drives `curve.getPointAt(t)` and `curve.getTangentAt(t)` for both position and lookAt. Use GSAP `power1.inOut` easing for scroll smoothing. Apply `damp3` (drei) with a 0.08 lerp factor in `useFrame` so micro-jitter is absorbed.

On named-route cold load, compute the target `t` from a `routeScrollTargets` map, scroll the page programmatically to that position, and snap the camera with no lerp.

---

## 6. The Four Acts in Detail

### ACT I — The Flower Field *(built in Part 4 — for reference only)*
- `<FlowerField>`: 10,000 instances of a low-poly blue flower on a dark plane (40×40 units, slight noise displacement).
- Cursor-ripple effect via raycaster.
- Already complete; do not rebuild.

### ACT II — The Dark Forest *(new — Part 6)*

- **Trees:** `<DarkForest>` is an `InstancedMesh` of ~300 tall conifer trunks. Use a single GLB (a tall, narrow conifer, ~25 units high, low-poly with vertical trunk striations). Instances are scattered with Poisson-disk sampling along the camera's flight corridor between `z = -25` and `z = -130`, denser near the path, sparser at the edges. Per-instance Y-scale jitter (±15%) and Z-rotation jitter (full 360°) prevent visible repetition.
- **Ground:** the same dark plane from Act I extends; ground texture darkens (lerp via shader based on `z` distance) to muddy earth tones inside the forest. Sparse flower patches placed manually at the bases of ~30 trees.
- **God-rays:** use `@react-three/postprocessing` `<GodRays>` effect anchored to an invisible high-altitude point-light far above the forest, slightly off-axis, so beams cut diagonally between trunks. Strength fades in from `scroll = 0.25` to `0.40`, holds, fades out at `0.55`.
- **Volumetric fog:** scene fog (`<fog>`) with cyan-tinted dark color (`#0a1428`), `near = 10`, `far = 80`. This naturally hides the forest's far edge and adds atmosphere.
- **Audio (optional):** wind-through-trees layer crossfaded in as Act II becomes active.

### ACT III — The Silver River *(new — Part 7)*

- **River geometry:** a `PlaneGeometry` ribbon (~3 units wide, ~70 units long, 1×60 segments) bent along a 3D Catmull-Rom curve on the forest floor (`y ≈ 0.05` to sit just above ground). The curve roughly mirrors the camera's path between `z = -90` and `z = -160` with gentle S-bends.
- **River shader:** custom `ShaderMaterial`:
  - Scrolling Perlin noise UV (time-driven) for flowing caustic-like surface texture.
  - Fresnel rim glow at grazing angles, emissive cyan-white core.
  - Subtle vertical wobble via vertex shader noise (very low amplitude) for water-surface feel.
- **Riverbank lighting:** add 4–5 narrow point-lights along the river's curve, low intensity, cyan, range ~6 units. These light up the inside-facing edges of nearby tree trunks. Use `RectAreaLight` if performance allows; else `PointLight` with shadow disabled.
- **Bridge moment:** at `scroll ≈ 0.70`, the camera passes directly over a wider section of the river — bloom briefly intensifies (animated via the reveal timeline) to sell the moment.

### ACT IV — The Moonrise *(new — Part 8)*

- **Moon:** a `SphereGeometry` (radius 12, 64 segments) positioned at `[0, 80, -260]` with a moon-surface texture (KTX2-compressed grayscale photo of the moon, public-domain NASA imagery acceptable). Use `MeshBasicMaterial` (no lighting needed; it's its own light source visually) tinted very slightly cool.
- **Halo:** a second slightly larger transparent sphere or a billboarded sprite with a radial gradient alpha provides the bloom halo.
- **Clouds:** 3–5 large transparent quads with wispy cloud textures (alpha-cutout, soft edges) drifting slowly left-to-right across the moon plane. Z-offset them so some pass in front, some behind.
- **Stars:** drei `<Stars>` component, dense, faintly twinkling.
- **Trees below:** the camera now sees the dark silhouette of the canopy at the bottom of the frame. The existing `<DarkForest>` instances extend far enough into `-z` to appear as silhouettes from the rising camera angle — no new geometry needed if instancing distribution is correct.
- **Bloom boost:** post-FX Bloom intensity ramps from `1.5` (default) to `2.2` between `scroll = 0.85` and `1.0` to make the moon dominate.

---

## 7. The Glassmorphism Reveal Layer *(this is the big new system — Part 5)*

This is the **DOM overlay system** that progressively reveals content as the user scrolls. It is the heart of the new UX.

### Concept

A set of glass panels lives in a `<RevealLayer>` component, all `position: fixed`, layered above the canvas. Each panel has a `revealRange` — a `[start, peak, end]` tuple in scroll-progress space (0–1). The panel's `opacity` and `transform` are driven by the current scroll value:

- Before `start`: hidden (`opacity: 0`, translated slightly off its anchor point).
- `start → peak`: fades in and slides into place (eased).
- `peak → end - 0.05`: fully visible, holding.
- `end - 0.05 → end`: fades out and slides off in the opposite direction.
- After `end`: hidden again.

A single GSAP timeline driven by ScrollTrigger handles all panels; each panel is one `.fromTo()` tween scrubbed by scroll. No React state writes per frame — manipulate refs directly.

### Panel schedule (the storyboard)

| Panel | Anchor on screen | Reveal range (scroll) | Content |
|---|---|---|---|
| **Intro / Wordmark** | Center | `[0.00, 0.05, 0.15]` | Site title "Ethereal Valley" + tagline + "scroll to descend ↓" |
| **About teaser** | Bottom-left | `[0.12, 0.18, 0.28]` | Short paragraph: what this place is |
| **Chronicles index** | Right side | `[0.25, 0.32, 0.50]` | List of 5 most recent post titles + dates, each a link to `/chronicles/:slug` |
| **Featured post excerpt** | Left side | `[0.42, 0.50, 0.62]` | Featured post hero image (rendered inside glass) + first 2 paragraphs + "Read full →" |
| **Sanctuary panel** | Bottom-right | `[0.58, 0.65, 0.75]` | Tagline + "Enter Sanctuary" button → `/sanctuary` |
| **Whispers panel** | Bottom-center | `[0.72, 0.78, 0.88]` | Guestbook teaser + recent 3 whispers + "Leave a whisper" button → `/whispers` |
| **Closing / Moon** | Center, low | `[0.88, 0.94, 1.00]` | Closing line ("the valley remembers everything") + footer links + RSS |

These ranges are guidelines — tune by feel against the camera spline so each panel peaks while the camera is settled in the matching scene, not mid-transition.

### Pinned mode (deep-link routes)

When a named route loads, the matching panel enters **pinned mode**:
- Its opacity is locked at `1`.
- Its reveal range is disabled until the user scrolls beyond the range by more than 5% in either direction (then it unpins and resumes normal scroll-driven behavior).
- A small "✕" appears in the top-right of the panel; clicking it calls `navigate('/')` and unpins.

### Reusable `<GlassPanel>` styling

```css
background: rgba(255, 255, 255, 0.04);
backdrop-filter: blur(16px) saturate(140%);
-webkit-backdrop-filter: blur(16px) saturate(140%);
border: 1px solid rgba(255, 255, 255, 0.10);
border-radius: 1rem;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
color: rgba(255, 255, 255, 0.92);
font-family: 'Inter', system-ui, sans-serif;
will-change: opacity, transform;
```

**Polish:** a subtle animated "light sweep" gradient drifts across each panel's border every 6s while it is visible.

### Persistent HUD

- Top-left: site wordmark (always visible).
- Top-right: vertical scroll-progress indicator — a thin glass capsule showing current scroll % as a glowing fill. Tapping it scrubs scroll to that position (optional QoL).
- These are *not* part of the reveal timeline.

---

## 8. Post-Processing Stack (revised values)

```
EffectComposer
  ├── Bloom            { intensity: 1.5 → 2.2 (scroll-driven), luminanceThreshold: 0.15, luminanceSmoothing: 0.6, mipmapBlur: true }
  ├── GodRays          { density: 0.96, decay: 0.93, weight: 0.4, exposure: 0.3 } — Act II only, scroll-gated
  ├── DepthOfField     { focusDistance: 0.02 → 0.05 (scroll-driven), focalLength: 0.05, bokehScale: 3.0 }
  ├── ChromaticAberration { offset: [0.0015, 0.0015] }
  ├── Vignette         { offset: 0.3, darkness: 0.7 }
  └── Noise            { opacity: 0.04 }
```

DoF `focusDistance` is animated by the reveal timeline — focus pulls forward as the user descends from Act I to Act IV.

---

## 9. Performance Budget (non-negotiable)

- **60fps** on a 2020-era mid-range laptop (Intel Iris Xe / M1 Air).
- All field flowers via `InstancedMesh` (single draw call).
- All forest trees via `InstancedMesh` (single draw call).
- Fireflies via `THREE.Points`, not meshes.
- Compress all GLBs with Draco + KTX2 textures.
- Lazy-load Act II forest geometry once `scroll > 0.15`.
- Lazy-load Act III river shader + lights once `scroll > 0.40`.
- Lazy-load Act IV moon textures once `scroll > 0.70`.
- Single `requestAnimationFrame` via R3F's `useFrame`; no per-frame React state writes — use `useRef` and direct mutation.
- GSAP scroll timeline writes directly to panel-ref `style` properties, never through React state.
- Mobile: detect viewport < 768; FOV 75 (vs 45 desktop); flower count 3,000; tree count 100; disable DoF, Chromatic Aberration, and GodRays.

---

## 10. Loading Experience

Until all GLB and KTX2 assets resolve:
- Black full-screen.
- Centered "Seed of Light": a single pulsing blue point, 0.6Hz breathe.
- Once `useProgress().progress === 100`, fade the loader (0.8s) and fade the canvas in. No spinner, no percentage text.
- On a cold deep-link to a named route, after the loader finishes, the page programmatically scrolls to the route's target scroll position, the camera snaps there with no animated transition, and the matching panel fades in pinned.

---

## 11. Project File Structure

```
/
├── BLUEPRINT.md
├── index.html
├── /public
│   ├── /models                     // tree.glb, hero-flower.glb (legacy from earlier draft, may be unused)
│   └── /textures                   // moon.ktx2, cloud.ktx2, bark.ktx2
├── /content
│   └── /chronicles                 // .mdx blog posts (front-matter: title, date, slug, excerpt, hero)
├── /src
│   ├── main.tsx
│   ├── App.tsx                     // BrowserRouter + providers
│   ├── /routes
│   │   ├── routes.tsx              // route table + scrollTarget map
│   │   ├── Home.tsx                // /
│   │   ├── ChroniclesIndex.tsx     // /chronicles
│   │   ├── ChroniclePost.tsx       // /chronicles/:slug
│   │   ├── Sanctuary.tsx           // /sanctuary
│   │   ├── Whispers.tsx            // /whispers
│   │   └── NotFound.tsx            // *
│   ├── /scene
│   │   ├── World.tsx
│   │   ├── CameraRig.tsx           // reads scroll + route → drives camera
│   │   ├── Environment.tsx
│   │   ├── FlowerField.tsx         // built
│   │   ├── DarkForest.tsx          // NEW
│   │   ├── BiolumeRiver.tsx        // NEW
│   │   ├── Moon.tsx                // NEW
│   │   ├── Fireflies.tsx
│   │   └── PostFX.tsx
│   ├── /ui
│   │   ├── GlassPanel.tsx
│   │   ├── Hud.tsx
│   │   ├── RevealLayer.tsx         // NEW — orchestrates all panel reveals
│   │   ├── panels/
│   │   │   ├── IntroPanel.tsx
│   │   │   ├── AboutPanel.tsx
│   │   │   ├── ChroniclesPanel.tsx
│   │   │   ├── FeaturedPostPanel.tsx
│   │   │   ├── SanctuaryPanel.tsx
│   │   │   ├── WhispersPanel.tsx
│   │   │   └── ClosingPanel.tsx
│   │   └── ScrollProgress.tsx
│   ├── /shaders
│   │   ├── river.frag
│   │   └── river.vert
│   ├── /hooks
│   │   ├── useScrollProgress.ts
│   │   ├── useRevealTimeline.ts    // NEW — builds the master GSAP timeline
│   │   └── useRouteScrollTarget.ts // NEW — maps route → scroll position
│   ├── /store
│   │   └── appStore.ts             // Zustand: scrollProgress, pinnedPanelId, activeAct
│   └── /styles
│       └── globals.css
└── package.json
```

---

## 12. Build Parts — Strict Sequential Order with Review Gates

The build is divided into **12 Parts**. After completing each Part, the model must **stop, summarize what was built, list any deviations or open questions, and explicitly ask for review**. The model does not begin the next Part until the user replies with approval (e.g. "approved, continue to Part N+1" or "approved with notes: ...").

> **Parts 1–4 are complete.** They built: project foundation + PostFX (Part 1), Lenis + GSAP + camera spline scaffolding (Part 2), React Router + Zustand + waypoint binding (Part 3), and the Act I flower field with cursor-ripple (Part 4). **Resume from Part 5.**
>
> Note: the original Part 3 was built against the old multi-modal routing model. Part 5 below includes a small refactor step to bring routing into line with the new deep-link-into-scroll model from Section 4.

---

### **PART 5 — Glassmorphism Reveal Layer & Routing Refactor**
- **Goal:** Build the entire DOM overlay system — `<GlassPanel>`, `<Hud>`, `<ScrollProgress>`, all seven content panels, and the `<RevealLayer>` that orchestrates them via a single scroll-scrubbed GSAP timeline. Refactor routing to the deep-link-into-scroll model.
- **Deliverable:**
  - `<GlassPanel>` base component matching Section 7 styling, including the 6s light-sweep border animation.
  - All seven panels from the Section 7 schedule, built with placeholder copy (real MDX content wires in at Part 9).
  - `useRevealTimeline` hook that registers each panel ref and animates opacity + transform across its `[start, peak, end]` range, scrubbed by Lenis scroll progress.
  - Persistent `<Hud>` (top-left wordmark) and `<ScrollProgress>` (top-right indicator).
  - Routing refactor: a `routeScrollTargets` map; named routes set scroll position on cold load and pin the matching panel; close button on pinned panels calls `navigate('/')` and unpins.
- **Acceptance test:** With Part 4's flower field still rendering, scrolling from top to bottom fades the seven placeholder panels in and out at the correct ranges. Visiting `/chronicles` in a fresh tab lands the user at scroll ≈ 0.32 with the Chronicles panel pinned open. Browser back/forward jumps between scroll positions. 60fps maintained.
- **STOP and request review.**

### **PART 6 — Act II: The Dark Forest**
- **Goal:** Build the tall-tree forest with god-rays and volumetric fog.
- **Deliverable:** `<DarkForest>` with ~300 instanced conifers distributed along the camera corridor (Poisson-disk), per-instance scale/rotation jitter, GodRays post-effect gated to scroll `0.25–0.55`, scene fog tuned for the forest depth, sparse flower patches at ~30 tree bases, ground shader darkening with depth. The camera spline is updated to the new waypoints from Section 5 so the user actually flies into the forest after the field.
- **Acceptance test:** At scroll ≈ 0.40, the site visually matches Frame B. God-rays visibly cut between trunks. Fog hides the back edge. Per-frame perf stays at 60fps on the target laptop.
- **STOP and request review.**

### **PART 7 — Act III: The Silver River**
- **Goal:** Build the bioluminescent river through the forest.
- **Deliverable:** `<BiolumeRiver>` ribbon following a 3D Catmull-Rom curve on the forest floor, custom shader with scrolling Perlin-noise UV + fresnel rim glow + subtle vertex wobble, 4–5 riverbank point-lights lighting inside-facing tree trunks, bloom-boost moment scripted at scroll ≈ 0.70 as the camera crosses a widened section.
- **Acceptance test:** At scroll ≈ 0.65–0.75, the site visually matches Frame C. The river surface visibly flows. Nearby trees catch its underlight. 60fps maintained.
- **STOP and request review.**

### **PART 8 — Act IV: The Moonrise**
- **Goal:** Build the canopy-break and moon-dominated final scene.
- **Deliverable:** `<Moon>` with KTX2 lunar texture, halo billboard, 3–5 drifting cloud quads, drei `<Stars>`, camera spline updated so it rises through the canopy and tilts upward, scroll-driven Bloom-intensity ramp from 1.5 → 2.2 across `0.85 → 1.0`.
- **Acceptance test:** At scroll = 1.0, the site visually matches Frame D. The moon dominates the upper third; tree silhouettes hold the bottom; the river is just a faint thread far below. The transition from forest-interior to moon-rise feels continuous, not jump-cut. 60fps maintained.
- **STOP and request review.**

### **PART 9 — MDX Content Pipeline + Panel Wiring**
- **Goal:** Replace placeholder panel copy with real MDX-driven content.
- **Deliverable:** MDX pipeline configured (`@mdx-js/rollup` or equivalent), 5 sample posts in `/content/chronicles/` with front-matter (title, date, slug, excerpt, hero image). The Chronicles index panel reads the post list, the Featured Post panel renders the newest post's excerpt + hero, and `/chronicles/:slug` routes render the full MDX content inside a pinned panel. SEO meta tags (title + description + OG image) wired via react-helmet-async per post.
- **Acceptance test:** Sample posts visible in the Chronicles index panel; clicking one navigates to `/chronicles/:slug` and pins its full-content panel; "view source" of that URL shows correct meta tags and the post body in the DOM.
- **STOP and request review.**

### **PART 10 — Mobile Responsive**
- **Goal:** Make the journey work on phones.
- **Deliverable:** Viewport-width-based FOV switch (75 / 45); flower count → 3k, tree count → 100, fireflies halved on mobile; DoF + Chromatic Aberration + GodRays disabled on mobile; panel max-widths and font scales tuned for narrow viewports; touch-scroll feel verified with Lenis touch config.
- **Acceptance test:** Site is usable and ≥30fps on a mid-range Android in Chrome; all panels are readable; the four acts still visually read correctly at 9:16.
- **STOP and request review.**

### **PART 11 — Loader & Deep-Link Cold Load**
- **Goal:** "Seed of Light" loader and clean cold-load behavior for deep links.
- **Deliverable:** Loader shows until assets resolve; loader fades out over 0.8s; on direct-link to a named route (e.g. `/chronicles/some-post`), after loader resolves the page programmatically scrolls to the route's target scroll position, the camera snaps (no lerp), and the matching panel fades in pinned. Subtle "scroll to continue exploring" hint appears below the pinned panel.
- **Acceptance test:** Hard refresh on `/chronicles/some-post` shows seed pulse, then forest/river scene, then pinned post panel — no camera fly-through, no flash of the intro panel. Refresh on `/` lands at top with intro panel revealed.
- **STOP and request review.**

### **PART 12 — Polish Pass**
- **Goal:** Final cinematic polish.
- **Deliverable:** Motion blur on fast scrolls; DoF focus-pull animation tied to camera depth; glass-panel light-sweep gradient verified across all panels; ambient audio bed with per-act crossfades (optional but recommended — field-ambience → forest-wind → river-water → moon-quiet); 404 route polish (camera held at moon, lost-in-the-canopy panel).
- **Acceptance test:** Subjective — the site feels like a film, not a website. Scrolling top to bottom is a continuous emotional arc, not a sequence of effects.
- **STOP and request final review.**

---

## 13. Workflow Enforcement

After completing each Part, the model **must**:
1. Produce a short summary of what was built.
2. List any deviations from this blueprint, with reasoning.
3. List any open questions or decisions deferred to the user.
4. Explicitly write: **"Part N complete. Awaiting review before starting Part N+1."**
5. Not write any code for Part N+1 until the user replies with approval.

If the user replies with notes or corrections, the model addresses them within the current Part before proceeding.