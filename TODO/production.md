# Production readiness

## must — deploy gating

- [ ] **Pick a host.** No Vercel/Netlify/Firebase Hosting config exists yet.
      Recommend Firebase Hosting (already in the stack) or Vercel (zero-config
      for Vite). Once chosen, `firebase init hosting` or `vercel link`.
- [ ] **Set `VITE_FIREBASE_*` env vars in the host's dashboard.** Currently
      only in `.env.local`. Without this, prod auth/Firestore are broken.
- [ ] **Add prod domain to Authorized domains.** Firebase Console →
      Authentication → Settings → Authorized domains. Add the production URL
      (e.g. `etherealblog.vercel.app`). Google sign-in fails with
      `auth/unauthorized-domain` otherwise.
- [ ] **Confirm `npm run build` succeeds clean.** Last check passed but
      flagged a 2 MB JS chunk warning — split before launch.
- [ ] **Verify `firestore.rules` + `firestore.indexes.json` are deployed.**
      Run `firebase deploy --only firestore` from CI on push to main.

## must — security

- [ ] **Rotate the Firebase web API key** that leaked into chat. It's
      designed to be public, but rotating closes that vector.
      Google Cloud Console → APIs & Services → Credentials → regenerate.
- [ ] **Enable App Check.** Google's reCAPTCHA Enterprise or App Attest
      gates Firestore + Auth at the SDK layer. Without it, any script with
      your config can read/write within your rules — App Check binds clients
      to the real site. https://firebase.google.com/docs/app-check
- [ ] **Rate-limit comments and whispers.** Current rules cap body length but
      not frequency. A signed-in user can post unlimited comments per second.
      Either:
      (a) Cloud Function trigger that throttles per-uid using a counter doc, or
      (b) A `usersPrivate/{uid}` doc with `lastCommentAt`, checked in rules.
      Same for `whispers`.
- [ ] **Profanity / spam scan on comments.** Current rules let through any
      string ≤ 2000 chars. At minimum, a basic regex blocklist client-side
      and a Cloud Function moderation hook server-side.
- [ ] **The Firestore `usernames/{name}` collection is enumerable.**
      `allow read: if true` lets anyone scrape the user list. If that's not
      desired, restrict to `request.auth != null` or remove the read rule
      and have the client trust the write-error message instead.

## should — observability

- [ ] **No error tracking.** Wire Sentry (or LogRocket) so silent failures
      in `usePostStats`, the dashboard fetch, and the 3D scene don't vanish.
      Several catch blocks currently `return null` or `setLoading(false)`
      without telemetry.
- [ ] **No analytics.** Decide on Plausible / Umami / GA4. Track at least:
      pageviews, sign-in conversion, comment posts, chronicle reads.
- [ ] **`auth/AuthProvider.tsx` swallows sign-in errors into local state.**
      Surface them to Sentry too.

## should — performance

- [ ] **2 MB main bundle.** `vite build` warned. Easy wins:
      - Dynamic-import `Dashboard` route — it's owner-only and pulls in
        `react-markdown`, `remark-gfm`, the editor form, etc.
      - Dynamic-import `react-three-fiber` scene for low-end devices.
      - Code-split MDX bodies — each `.mdx` is compiled into the main chunk
        right now. `import.meta.glob` with `eager: false` would split them.
- [ ] **Service worker / offline.** PWA-ifying gives offline reading + faster
      repeat visits. `vite-plugin-pwa` is one config block.
- [ ] **Pre-render the static routes.** `/chronicles` and `/chronicles/:slug`
      could be SSG via vite-ssg or astro — would massively improve SEO and
      first-paint. Auth/comments can hydrate on top.

## should — SEO

- [ ] **Sitemap.** Generate `sitemap.xml` at build time from `posts` +
      Firestore chronicles. (Firestore docs at build time need a fetch step.)
- [ ] **robots.txt.** Currently absent. Allow indexing of public pages,
      disallow `/dashboard`.
- [ ] **OpenGraph images.** Chronicles use `og:title` + `og:description` but
      no `og:image`. Generate per-post images (a Cloud Function with
      `@vercel/og` or similar).
- [ ] **Canonical URLs.** `<link rel="canonical">` is missing on all routes.
- [ ] **JSON-LD `Article` schema** on chronicle pages for rich results.

## nice

- [ ] **Backups.** Firestore has a managed export — schedule daily exports
      to a GCS bucket. https://firebase.google.com/docs/firestore/manage-data/export-import
- [ ] **CI.** GitHub Actions workflow: tsc, `firebase deploy --only firestore`
      on main, optional preview deploys per PR.
- [ ] **Lighthouse budget gates** in CI: refuse to merge if LCP > 2.5 s or
      CLS > 0.1 on mobile.
- [ ] **A11y audit** with axe or Lighthouse — focus order, contrast on
      glass panels (white on translucent backgrounds is borderline), aria-labels
      on icon-only buttons.
