# Master Build Prompt — "Ethereal Valley"
### An All-3D Bioluminescent Blog & Documentary Site

---

## 0. How to use this document

Paste the entire file into a high-reasoning coding model (Claude Opus, GPT-5, Gemini 2.5 Pro) as the opening message of a fresh session, then ask it to begin **Part 1** of the build. Keep the file checked into the repo as `BLUEPRINT.md` so the model can reload it in later sessions. Every section below is a hard requirement unless explicitly marked *optional*.

**Critical workflow rule:** the build is divided into 12 numbered Parts. The model must complete **one Part at a time**, stop, and wait for the user's review and explicit approval before starting the next Part. This is enforced in Section 13.

---

## 1. The Vision (read this first)

Build a **multi-route blog and documentary site** that *feels* like one continuous 3D world. Under the hood it is a real React application with real URLs, real routes, and shareable links — `/chronicles/some-post` works, browser back/forward works, SEO works, deep-linking works. But every route transition is masked by a **3D camera animation** through a nocturnal bioluminescent valley, so the user never perceives a "page change." They see the camera fly somewhere new and content appear in a glass panel.

The default `/` route is a scroll-driven cinematic journey through three Acts of the valley. Named routes (`/chronicles`, individual posts, `/sanctuary`, `/whispers`) interrupt the scroll, lerp the camera to a specific location in 3D space, and reveal a glassmorphism modal containing real content.

The aesthetic is **"Atmospheric Contrast":**
- **The world** is dark, organic, mystical — deep navy-to-black, cyan and royal-blue emissive glows, soft gold firefly motes.
- **The interface** is sharp, modern, translucent — frosted-glass panels, hairline white borders, minimal sans-serif type.

Think: high-end nature cinematography (Planet Earth at night) meets a futuristic operating system rendered on glass.

---

## 2. Visual Reference — Three Anchor Frames

The default scroll journey has **three acts**, each matching one reference image. Treat these as the look-dev target.

### Frame A — The Celestial Map *(opening / `scroll = 0`)*
- Top-down bird's-eye view of a dense carpet of small blue five-petal flowers with white starburst centers, set on dark green foliage.
- Background is nearly black; flowers glow blue against it.
- Golden firefly specks scattered throughout at varying focal depths.
- Feels like looking at a constellation from above.

### Frame B — The Interactive Threshold *(mid-scroll / `scroll ≈ 0.5`)*
- Eye-level ground view inside a moonlit forest clearing.
- Taller, more individualized blue flowers (daisy-form, yellow centers, pointed petals) standing proud above the carpet.
- Full moon visible through silhouetted conifer trunks.
- Heavy depth-of-field bokeh; dozens of golden fireflies drift in the air.

### Frame C — The Archive Valley *(end / `scroll = 1`)*
- Wide vista from a ridge: snow-capped mountains in the distance, full moon high, stars and thin clouds above.
- A silver glowing river snakes down through the valley.
- Dark conifer forests flank the valley walls.
- The valley floor is carpeted in the same blue flowers, brightest near the river.

The camera spline must hit each of these compositions at the corresponding scroll position.

---

## 3. Technical Stack (locked)

| Layer | Tool | Notes |
|---|---|---|
| Framework | **React 18 + Vite** | TypeScript |
| Routing | **React Router v6** | Real URLs, real navigation, hooked to camera transitions |
| 3D renderer | **React Three Fiber** (`@react-three/fiber`) | Three.js r160+ |
| 3D helpers | **@react-three/drei** | For `<Sky>`, `<Stars>`, `<Html>`, `<Text>`, `<Float>` |
| Post-processing | **@react-three/postprocessing** | Bloom, Vignette, DoF, Chromatic Aberration |
| Scroll-driven animation | **GSAP + ScrollTrigger** | Camera spline progression |
| Smooth scrolling | **Lenis** | Mandatory — eliminates scroll jitter |
| Crisp 3D text | **troika-three-text** (via drei `<Text>`) | MSDF rendering |
| Styling | **Tailwind CSS v4** | For glassmorphism overlay UI |
| State | **Zustand** | Lightweight; share scroll progress + active scene + active route state |
| Content | **MDX** files in `/content/chronicles/` | Blog posts as MDX, parsed and rendered inside glass modals |
| SEO | **react-helmet-async** | Per-route `<title>` and meta tags |

No alternative substitutions without explicit user approval.

---

## 4. Routing Philosophy (critical — read carefully)

This is **not** a single-page experience. It is a real multi-route React application where each route corresponds to a position and state in the 3D world. The 3D camera animation is the **visual transition layer** between routes — not a replacement for routing.

### Route map

| URL | What it shows | 3D state |
|---|---|---|
| `/` | The default scroll-driven journey through Acts I → II → III | Camera follows scroll position 0 → 1 along the spline |
| `/chronicles` | Blog index — list of all posts | Camera at the "Chronicles" hero flower; modal open with post list |
| `/chronicles/:slug` | One blog post | Camera at the corresponding `ChronicleNode` in the valley; modal open with MDX content |
| `/sanctuary` | Login / private journal | Camera at the "Sanctuary" hero flower; modal open with login form |
| `/whispers` | Public guestbook | Camera at the "Whispers" hero flower; modal open with guestbook |
| `/valley` | Direct jump to Act III vista | Camera at `scroll = 1` position; no modal |
| `*` (404) | Lost-in-the-valley screen | Camera drifts slowly through empty space; glass panel with "return home" |

### Behavior rules

1. **Clicking a hero flower** calls `navigate('/chronicles')` (or equivalent). The router updates the URL, the camera rig listens for route changes via `useLocation()` and lerps to the matching position, and the modal fades in once the camera arrives.

2. **Deep-linking** (user pastes `/chronicles/some-post` into a fresh tab) must work. After the loader completes, the camera **snaps** to the target position instantly (no fly-through animation — they didn't scroll there), then the modal opens with a soft fade. A subtle "click anywhere to explore" hint invites the user to start scrolling from that point.

3. **Browser back/forward** must work. `popstate` triggers the same camera-lerp logic as a `navigate()` call.

4. **Closing a modal** calls `navigate(-1)` if there is history, else `navigate('/')`. The camera lerps back to the last scroll-driven position.

5. **SEO**: each route sets its own `<title>` and `<meta description>` via react-helmet-async. Blog posts must be crawlable — render their MDX content into the DOM (inside the modal) even though it's visually hidden until the modal opens; do not gate content behind JS-only rendering.

6. **Scroll position vs route**: scroll only drives the camera when the route is `/` or `/valley`. On any modal-bearing route, Lenis is locked. When the modal closes, Lenis re-enables at the scroll position corresponding to the camera's current location on the spline (compute the inverse — find `t` for the closest point on the curve).

---

## 5. The World Engine (core architecture)

```
<App>
  └── <BrowserRouter>
       └── <HelmetProvider>
            └── <Loader />                       // "Seed of Light" pulse, blocks until assets ready
            └── <SmoothScrollProvider>           // Lenis (auto-locks on modal routes)
                 └── <GlassUI>                   // DOM overlay (HUD, modals, nav) — z-indexed above canvas
                      └── <Routes>               // React Router renders modal content per route
                 └── <Canvas>                    // The entire 3D world
                      └── <Suspense>
                           └── <CameraRig />     // Reads scroll OR route → moves camera
                           └── <Environment />   // Sky, moon, stars, clouds, fog
                           └── <FlowerField />   // 10k InstancedMesh ground flowers (Frame A)
                           └── <HeroFlowers />   // 3 high-poly individual flowers (Frame B)
                           └── <Valley />        // Heightmap terrain + conifer instances + mountains
                           └── <BiolumeRiver />  // Custom shader plane, scrolling noise UV
                           └── <Fireflies />     // THREE.Points, ~150 nodes, Perlin-noise drift
                           └── <ChronicleNodes />// Floating glow spheres along river = blog posts
                           └── <PostFX />        // Bloom + Vignette + DoF + Chromatic Aberration
```

### Camera spline definition

A single `CatmullRomCurve3` interpolating roughly these waypoints (tune visually):

```
t=0.00   pos=[0, 80,   0]    lookAt=[0, 0,   0]     // Frame A: straight down
t=0.35   pos=[0, 25,  20]    lookAt=[0, 1,   0]     // arcing to eye-level
t=0.50   pos=[0,  1.6, 6]    lookAt=[0, 1.2, 0]     // Frame B: hero flowers
t=0.65   pos=[0, 12,  -10]   lookAt=[0, 2, -30]     // rising over the threshold
t=1.00   pos=[0, 30, -120]   lookAt=[0, 5, -300]    // Frame C: valley vista
```

Scroll position (0–1) drives `curve.getPointAt(t)` on the `/` and `/valley` routes. On named routes, the camera ignores scroll and instead targets a route-specific waypoint (defined in a `routeWaypoints` map). Apply GSAP `power2.inOut` easing for both modes. Use `damp3` (drei) with a 0.08 lerp factor — never snap (except on cold deep-link load).

---

## 6. The Three Acts in Detail

### ACT I — The Celestial View

- `<FlowerField>`: 10,000 instances of a low-poly blue flower mesh on a flat dark plane (40×40 units, slight noise displacement). Use `InstancedMesh` with per-instance color jitter (subtle hue variation) and per-instance `emissiveIntensity` driven by a vertex shader so flowers can ripple in waves.
- **Raycaster on mouse move:** flowers within ~3 units of the cursor's projected ground point gain +0.5 emissive boost over 0.4s, then decay. This creates a "ripple following the cursor" effect at top-down view.
- **HUD (glass, top of viewport):** site wordmark on the left, "Scroll to descend ↓" indicator on the right.
- **Audio (optional):** a low ambient pad track fades in on first user interaction.

### ACT II — The Interactive Threshold

- Three `<HeroFlowers>` positioned at `[-3, 0, 0]`, `[0, 0, 0]`, `[3, 0, 0]`. High-poly GLB models, 6× larger than field flowers, with stronger emissive.
- **Labels:** drei `<Text>` (MSDF) hovering 1.5 units above each flower:
  - Left → **Chronicles** → routes to `/chronicles`
  - Center → **Sanctuary** → routes to `/sanctuary`
  - Right → **Whispers** → routes to `/whispers`
- **Hover state:** raycaster detects pointer-over → emissive 1.0 → 2.5 (eased), scale 1.0 → 1.15, glass tooltip appears via drei `<Html occlude>` with a one-line teaser.
- **Click behavior:**
  1. `navigate('/chronicles')` (or matching route).
  2. Lenis scroll locks (handled by `<SmoothScrollProvider>` on route change).
  3. Camera lerps to a tight close-up of the target flower over 1.2s.
  4. Bloom threshold drops briefly, screen flares.
  5. The modal scales up from 0.95 → 1.0 with a fade.
  6. Modal renders the matched React Router `<Route>` element.
  7. Close button calls `navigate(-1)`; reverse animation; Lenis re-enables.

### ACT III — The Archive Valley

- Terrain: heightmap plane (PlaneGeometry, 256×256 segments) deformed by a Perlin-noise displacement shader. Carpet it with a second, sparser `InstancedMesh` of field flowers concentrated along the river.
- Distant mountains: 3–4 large low-poly silhouettes with dark blue-tinted fog at the base.
- Conifers: GLB instanced along the valley walls, ~200 trees.
- **`<BiolumeRiver>`:** a `PlaneGeometry` ribbon following a 2D Catmull-Rom curve on the ground. Custom shader: scrolling Perlin noise UV for flow, Fresnel rim glow. Emissive cyan-white.
- **`<ChronicleNodes>`:** floating glowing spheres along the riverbank, one per MDX post. Newest near the camera, oldest deep in the valley. Hover → MSDF text shows title + date. Click → `navigate('/chronicles/' + slug)`.

---

## 7. The Glassmorphism UI Layer

A DOM overlay sitting on top of the canvas (`position: fixed; pointer-events: none;` on the wrapper; individual panels re-enable `pointer-events: auto`).

**Reusable `<GlassPanel>` component** — base styles:

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
```

**Usages:**
- **HUD bar** (top): site title + scroll hint + persistent route breadcrumb (e.g. "Valley / Chronicles / The First Bloom").
- **Tooltip** (hero flower hover): small, one-liner.
- **Modal** (any named route): centered, max-width 720px, max-height 80vh, internal scroll for long content.
- **Bottom nav** (Act III + `/valley`): jump-to-date scrubber for posts + "Return to canopy" button.

**Polish:** subtle animated "light sweep" gradient drifting across each panel's border every 6s.

---

## 8. Post-Processing Stack (locked values)

```
EffectComposer
  ├── Bloom            { intensity: 1.5, luminanceThreshold: 0.15, luminanceSmoothing: 0.6, mipmapBlur: true }
  ├── DepthOfField     { focusDistance: 0.02, focalLength: 0.05, bokehScale: 3.0 }
  ├── ChromaticAberration { offset: [0.0015, 0.0015] }
  ├── Vignette         { offset: 0.3, darkness: 0.7 }
  └── Noise            { opacity: 0.04 }
```

DoF `focusDistance` is animated by the camera rig — focus pulls forward as the user descends from Act I to Act III.

---

## 9. Performance Budget (non-negotiable)

- **60fps** on a 2020-era mid-range laptop (Intel Iris Xe / M1 Air).
- All field flowers via `InstancedMesh` (single draw call).
- All conifers via `InstancedMesh`.
- Fireflies via `THREE.Points`, not meshes.
- Compress all GLBs with Draco + KTX2 textures.
- Lazy-load Act III heavy geometry once `scroll > 0.4` or on direct-link to a valley route.
- Single `requestAnimationFrame` via R3F's `useFrame`; no per-frame React state writes in hot paths — use `useRef` and direct mutation.
- Mobile: detect viewport < 768; switch FOV to 75 (from 45 on desktop), reduce flower count to 3,000, disable DoF and Chromatic Aberration.

---

## 10. Loading Experience

Until all GLB and KTX2 assets resolve:
- Black full-screen.
- Centered "Seed of Light": a single pulsing blue point, 0.6Hz breathe.
- Once `useProgress().progress === 100`, fade the loader (0.8s) and fade the canvas in. No spinner, no percentage text.
- On a cold deep-link to a named route, after the loader finishes, the camera arrives at the target waypoint instantly and the modal fades in.

---

## 11. Project File Structure

```
/
├── BLUEPRINT.md
├── index.html
├── /public
│   ├── /models
│   └── /textures
├── /content
│   └── /chronicles                 // .mdx blog posts (front-matter: title, date, slug, nodePosition)
├── /src
│   ├── main.tsx
│   ├── App.tsx                     // BrowserRouter + providers
│   ├── /routes
│   │   ├── routes.tsx              // route table + waypoint map
│   │   ├── Home.tsx                // /
│   │   ├── ChroniclesIndex.tsx     // /chronicles
│   │   ├── ChroniclePost.tsx       // /chronicles/:slug
│   │   ├── Sanctuary.tsx           // /sanctuary
│   │   ├── Whispers.tsx            // /whispers
│   │   ├── Valley.tsx              // /valley
│   │   └── NotFound.tsx            // *
│   ├── /scene
│   │   ├── World.tsx
│   │   ├── CameraRig.tsx           // reads useLocation + scroll → drives camera
│   │   ├── Environment.tsx
│   │   ├── FlowerField.tsx
│   │   ├── HeroFlowers.tsx
│   │   ├── Valley.tsx
│   │   ├── BiolumeRiver.tsx
│   │   ├── Fireflies.tsx
│   │   ├── ChronicleNodes.tsx
│   │   └── PostFX.tsx
│   ├── /ui
│   │   ├── GlassPanel.tsx
│   │   ├── Hud.tsx
│   │   ├── Modal.tsx               // route-aware wrapper around <Outlet />
│   │   ├── Tooltip.tsx
│   │   └── ArchiveNav.tsx
│   ├── /shaders
│   ├── /hooks
│   │   ├── useScrollProgress.ts
│   │   ├── useRaycastHover.ts
│   │   └── useRouteCamera.ts       // returns target waypoint for current route
│   ├── /store
│   │   └── appStore.ts             // Zustand: scrollProgress, isLocked, activeRoute
│   └── /styles
│       └── globals.css
└── package.json
```

---

## 12. Build Parts — Strict Sequential Order with Review Gates

The build is divided into **12 Parts**. After completing each Part, the model must **stop, summarize what was built, list any deviations or open questions, and explicitly ask for review**. The model does not begin the next Part until the user replies with approval (e.g. "approved, continue to Part N+1" or "approved with notes: ...").

Each Part below lists its **goal**, **deliverable**, and **acceptance test** the user will run before approving.

---

### **PART 1 — Foundation**
- **Goal:** Vite + React + TypeScript project skeleton with R3F and PostFX wired to a blank dark canvas.
- **Deliverable:** Empty `<Canvas>` rendering a single test cube. PostFX (Bloom only) verified by giving the cube an emissive material — it should visibly glow.
- **Acceptance test:** `npm run dev` opens the site; user sees a glowing cube on black background at 60fps.
- **STOP and request review.**

### **PART 2 — Scroll & Camera Spline**
- **Goal:** Lenis smooth scroll + GSAP ScrollTrigger + `<CameraRig>` flying along the defined `CatmullRomCurve3`.
- **Deliverable:** Scrolling moves the camera through all five waypoints. The test cube stays in place; scroll lets the user circle and rise above it.
- **Acceptance test:** User scrolls page; camera follows the spline smoothly; console logs `scrollProgress` 0 → 1.
- **STOP and request review.**

### **PART 3 — Routing Foundation**
- **Goal:** React Router v6 + react-helmet-async + Zustand store + route → camera waypoint binding.
- **Deliverable:** All 7 routes from Section 4 exist with placeholder text. Visiting `/chronicles` etc. lerps the camera to a hardcoded waypoint and locks Lenis. Browser back/forward works. Direct deep-link to `/chronicles` snaps the camera there on cold load.
- **Acceptance test:** User clicks through routes via address bar and browser back button; camera transitions look correct; deep-link works in a fresh tab.
- **STOP and request review.**

### **PART 4 — Act I: Flower Field & Environment**
- **Goal:** Build the celestial-view world.
- **Deliverable:** `<FlowerField>` with 10k `InstancedMesh` flowers, `<Environment>` (sky, moon, stars), `<Fireflies>` particle system. Cursor-ripple shader effect on the flowers.
- **Acceptance test:** At `scroll = 0`, the site visually matches Frame A. Cursor causes flowers near it to brighten. 60fps maintained.
- **STOP and request review.**

### **PART 5 — Act II: Hero Flowers + MSDF Labels**
- **Goal:** Three interactive hero flowers with crisp 3D text labels.
- **Deliverable:** Three high-poly hero flower GLBs placed in the scene with troika `<Text>` labels ("Chronicles", "Sanctuary", "Whispers"). Raycaster hover increases emissive and scale.
- **Acceptance test:** At `scroll = 0.5`, the site matches Frame B. Hovering a hero flower visibly responds. Clicking does nothing yet (wired in Part 7).
- **STOP and request review.**

### **PART 6 — Glassmorphism UI Primitives**
- **Goal:** Build the DOM overlay layer.
- **Deliverable:** `<GlassPanel>`, `<Hud>`, `<Modal>`, `<Tooltip>` components styled per Section 7. HUD bar appears persistently. Modal accepts an `open` prop and animates in/out.
- **Acceptance test:** Storybook-style demo route renders all four primitives; visually matches glassmorphism spec; backdrop blur works on Chrome, Firefox, Safari.
- **STOP and request review.**

### **PART 7 — Route ↔ Modal ↔ Camera Integration**
- **Goal:** Wire hero flower clicks to actually navigate routes, open modals, and lerp the camera.
- **Deliverable:** Clicking a hero flower calls `navigate('/chronicles')` etc.; the modal opens with placeholder content rendered from the corresponding `<Route>`; the camera arrives at the flower; close button reverses everything.
- **Acceptance test:** Full round-trip works: click flower → URL changes → camera flies → modal opens → close → URL returns → camera flies back → scroll position restored.
- **STOP and request review.**

### **PART 8 — Act III: Valley, River, Mountains, Conifers**
- **Goal:** Build the deep-valley world.
- **Deliverable:** Heightmap terrain, `<BiolumeRiver>` with scrolling shader, 200 instanced conifers, distant mountain silhouettes, sparse flower carpet near the river.
- **Acceptance test:** At `scroll = 1` (or visiting `/valley`), the site matches Frame C. River flows visibly. 60fps maintained.
- **STOP and request review.**

### **PART 9 — Chronicle Nodes + MDX Content Pipeline**
- **Goal:** Real blog posts wired in as 3D objects.
- **Deliverable:** MDX pipeline configured; 3–5 sample posts in `/content/chronicles/`; `<ChronicleNodes>` reads them and places a glowing sphere per post along the river; hovering shows title + date; clicking navigates to `/chronicles/:slug` and opens the post in the modal.
- **Acceptance test:** Sample posts render with correct front-matter; direct-linking to `/chronicles/some-post` works; SEO meta tags visible in page source.
- **STOP and request review.**

### **PART 10 — Mobile Responsive**
- **Goal:** Make it work on phones.
- **Deliverable:** Viewport-width-based FOV switch (75 / 45); flower count reduced to 3k on mobile; DoF + Chromatic Aberration disabled on mobile; touch-friendly hit areas for hero flowers; modal sized appropriately.
- **Acceptance test:** Site is usable and 30fps+ on a mid-range Android in Chrome.
- **STOP and request review.**

### **PART 11 — Loader & Direct-Link Behavior**
- **Goal:** "Seed of Light" loader and proper cold-load behavior for deep links.
- **Deliverable:** Loader shows until assets resolve; on direct-link to a named route, camera snaps (not lerps) to target after loader; modal fades in.
- **Acceptance test:** Hard refresh on `/chronicles/some-post` — user sees seed pulse, then valley, then modal with post. No camera fly-through.
- **STOP and request review.**

### **PART 12 — Polish Pass**
- **Goal:** Final cinematic polish.
- **Deliverable:** Motion blur on fast scrolls; DoF focus-pull animation tied to camera depth; glass-panel light-sweep gradient animation; ambient audio fade-in (optional); 404 route polish.
- **Acceptance test:** Subjective — the site feels like a film, not a website.
- **STOP and request final review.**

---