# Features — partials and gaps

## must

- [ ] **MDX raw body not editable from dashboard.** When the owner clicks
      Edit on an MDX-only chronicle, the body textarea seeds with a
      placeholder telling them to paste from `content/chronicles/{slug}.mdx`.
      Fix paths (pick one):
      - Write a small Vite plugin that emits a virtual module containing
        every `.mdx` file's raw text (bypasses the MDX rollup plugin).
      - Build-time Node script that writes `src/content/_rawBodies.json`
        from `content/chronicles/*.mdx`.
      - Drop MDX entirely, migrate all posts into Firestore. **Lossy** —
        any MDX-only React components would be gone.
      Files: `src/content/firestoreChronicles.ts:115-119`,
      `src/content/posts.ts`.

## should

- [ ] **Promoted chronicles need a "view diff vs. MDX" affordance.** Once a
      Firestore copy diverges from the underlying MDX file, the maintainer
      can't tell what changed without reading both. Add a side-by-side or
      revert-to-file option in `ChronicleEditor`.
- [ ] **Pinned post limit.** Right now any number of chronicles can be
      pinned. Decide: enforce max 1–3 pinned, sort pinned by date desc, or
      let owner reorder pinned manually with a `pinOrder` int field.
- [ ] **Hero field is overloaded.** Existing MDX uses
      `hero: linear-gradient(...)`. Dashboard label says "Hero image URL"
      but accepts any string. Either:
      (a) Rename label to "Hero (CSS gradient or image URL)", auto-detect
          and render accordingly, or
      (b) Split into two fields.
- [ ] **Comment author photo doesn't update.** The `photoURL` stored in the
      comment doc is whatever the user had when posting. If they later change
      their Google avatar, old comments still show the old one. Acceptable
      tradeoff (immutable history), but worth documenting.
- [ ] **User profile is currently view-only.** No way to change username,
      add a bio, change photo. Add a `/profile` route with a small form,
      and matching `users/{uid}` update rule.
- [ ] **Sanctuary panel is static text.** `src/ui/panels/SanctuaryPanel.tsx`
      has no Firestore-backed content. Decide whether Sanctuary should
      become user-generated (saved bookmarks?) or stay decorative.

## nice

- [ ] **Drafts.** Currently `hidden: true` is the only way to stage a post.
      A real `status: 'draft' | 'scheduled' | 'published'` field with a
      `publishAt` timestamp would enable scheduled publishing via a Cloud
      Function.
- [ ] **Tags.** No taxonomy on chronicles. Add a `tags: string[]` field on
      `FirestoreChronicle`, a tag chip in the editor, and `/chronicles?tag=`
      filtered routes.
- [ ] **Search.** `useChronicleList` returns everything anyway — wire a
      simple client-side fuzzy search (`fuse.js` is small) over titles and
      excerpts on the chronicles index.
- [ ] **RSS feed.** Generate `feed.xml` from the merged list (MDX + Firestore).
- [ ] **Reactions beyond like.** A small set of emoji reactions per comment
      (heart, mist, firefly) keyed by uid in a subcollection.
- [ ] **Notifications.** When a comment is posted on a chronicle, notify the
      author (e-mail via Firebase Trigger Email extension, or in-app).
- [ ] **`useAuth().signInGithub` works** but the avatar / email may be
      unverified — owner check correctly requires `emailVerified`, but
      regular auth UX should remind GitHub users to verify their primary
      email if it's missing.
- [ ] **Mobile haptics on like.** `navigator.vibrate?.(8)` on heart-tap is a
      lovely small detail.
- [ ] **Reading time estimate** in the chronicle header (`<word count>/200 wpm`).

## explicit non-goals (for now)

- ❌ Multi-user collaboration on a chronicle (not requested, out of scope).
- ❌ A full role system. Single-owner check by email is the right size.
- ❌ Markdown WYSIWYG editor. Plain textarea + preview pane is cheaper and
      preserves the writer's intent.
