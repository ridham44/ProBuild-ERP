# Frontend Rules (Next.js)

Applies in addition to the root CLAUDE.md.

## Structure

```
src/
  app/                 # Routes only: page.tsx, layout.tsx, loading.tsx, error.tsx
  features/<feature>/  # components/, hooks/, api/ (query hooks), schemas.ts
  components/ui/       # shadcn/ui components — generated, edit minimally
  components/common/   # Shared app components
  lib/                 # api client setup, utils, env
```

Group code by feature, not by file type. A feature folder should be deletable as one unit.

## Data fetching

- Server Components for initial page data and SEO-relevant content.
- TanStack Query for client-side fetching, mutations, polling, and optimistic updates.
- All API calls go through the generated client in `packages/api-client`. Never call `fetch` with hand-written URLs.
- Wrap each endpoint in a query hook inside `features/<feature>/api/` (e.g. `useOrders`, `useCreateOrder`).
- Query keys come from a single factory per feature: `orderKeys.list(filters)`, `orderKeys.detail(id)`.
- After mutations, invalidate the specific keys affected — not everything.

## Components

- Default to Server Components. Add `"use client"` only when needed (state, effects, browser APIs, event handlers) and keep those components small.
- Use shadcn/ui primitives before building custom ones.
- Every data-driven view handles loading, empty, and error states.
- Accessibility: semantic HTML, labels on all inputs, keyboard navigable, visible focus.

## Forms

- React Hook Form + `zodResolver` using the shared Zod schema from `packages/shared` when one exists.
- Show server validation errors on the matching fields.
- Disable submit while pending; prevent double submits.

## Styling

- Tailwind utilities only. No inline `style` except for truly dynamic values.
- Use `cn()` for conditional classes. Use design tokens from the Tailwind config, not raw hex colors.
- Mobile-first responsive layouts.

## Auth

- Session is an httpOnly cookie managed by the API. The frontend never reads or stores tokens.
- Protect routes in middleware; still rely on the API for real authorization.
- Hide UI the user can't use, but never treat hidden UI as security.

## Performance

- `next/image` for images, `next/font` for fonts.
- Dynamic import (`next/dynamic`) for heavy components (charts, editors, maps).
- No large libraries for small tasks (e.g. no lodash for one function, no moment.js).
