# Bugs & rough edges

## must

- [ ] **Hidden Firestore chronicles still leak through the reader for non-owners.**
      `src/ui/ChronicleReader.tsx:62-81` — if a Firestore doc has `hidden: true`
      and an MDX file exists for the same slug, the MDX body still renders.
      Decide intent: should hiding a promoted post also hide the underlying MDX,
      or only the Firestore overlay? Current code keeps MDX visible; that's
      probably wrong for "hide" but right for "delete".
- [ ] **Comment timestamp jitters on first paint.** We pass
      `serverTimestamps: 'estimate'` in `usePostInteractions.ts:104-113` so the
      comment appears instantly, but the relative-time label flips a few
      seconds when the real server timestamp arrives. Switch to a fixed
      "just now" label until the snapshot has `hasPendingWrites: false`.
- [ ] **`request.resource.data.createdAt == request.time` is fragile.**
      `firestore.rules` comments + whispers rules — if a future client sends a
      `Timestamp.now()` (e.g. for offline support), it'll be rejected. Loosen
      to `request.resource.data.createdAt is timestamp` with a sanity range
      check, OR keep strict and document it.

## should

- [ ] **MDX-only "Delete" button is disabled with no clear messaging in the
      table.** `src/routes/Dashboard.tsx` chronicles manager — only a tooltip
      explains why. Add a small inline hint row when an MDX-only row is
      hovered, or replace the disabled state with a "delete file from repo"
      instructional modal.
- [ ] **`stripFrontmatter` is unused** since the dual-glob was reverted —
      removed from `src/content/posts.ts` already, but the buildEditorSeed
      placeholder body in `firestoreChronicles.ts:115-119` still tells the
      owner to paste from a file. See [features.md → MDX raw body](features.md).
- [ ] **Username uniqueness check happens only at submit time.** Onboarding
      modal in `src/ui/WelcomeOnboarding.tsx` — add a debounced live check
      against `usernames/{name}` so the user sees red before they hit submit.
- [ ] **`window.confirm` and `window.alert` in the dashboard** for delete /
      error paths. Replace with the same glass-panel modal vocabulary used
      elsewhere so the maintainer view doesn't break aesthetic.
- [ ] **Welcome modal "turn back" signs out but leaves the user on whatever
      they were doing.** If they were mid-like or mid-comment, that action
      silently no-ops. Decide: should "turn back" cancel the in-flight action
      explicitly, or is sign-out enough?

## nice

- [ ] **Comments have no "edit" affordance.** Author can delete but not edit.
      Current `firestore.rules` comments block: `allow update: if false`.
      If we open this, also enforce an `editedAt` field.
- [ ] **No keyboard handler on the WelcomeOnboarding modal** — Esc does
      nothing (deliberate, but should at least trap focus inside the form).
- [ ] **`useFirestoreChronicles` falls silent on error** —
      `src/content/firestoreChronicles.ts:73-79`. Surface to a toast instead
      of `setItems([])`.
