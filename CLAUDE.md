# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev            # Start dev server (localhost:5173)
pnpm build          # Production build to dist/
pnpm preview        # Serve the production build
pnpm check          # svelte-check + tsc type checking
pnpm lint           # oxlint
pnpm lint:fix       # oxlint with auto-fix
pnpm format         # oxfmt (TS/JS/JSON/CSS — oxfmt does not format .svelte files yet)
pnpm format:check   # oxfmt check only
```

Requires Node 24 (`engines`). There are no tests.

## Architecture

Single-page **Svelte 5** app (Vite, no SvelteKit) written with **runes only** — no stores, no legacy syntax.

- `src/main.ts` — mounts `App` and kicks off `auth.init()`
- `src/App.svelte` — the only page: `Header`, empty `<main>`, and the login `Modal`
- `src/lib/auth.svelte.ts` — `Auth` class with `$state` fields, exported as the `auth` singleton
- `src/lib/components/` — `Header`, `Modal` (native `<dialog>`, `bind:open`), `LoginForm`
- `src/app.css` — global CSS variables (light/dark via `prefers-color-scheme`); components use scoped `<style>` blocks

### Authentication

Same flow as `agnes97-portfolio`, against the prismify API at `https://prismify.macovi.space`:

- `POST /auth/login` `{ email, password }` → `{ accessToken }` (401 `{ message }` on bad credentials)
- `GET /auth/me` with `Authorization: Bearer <token>` → user (`id`, `email`, `name`, `avatar?`, …)
- JWT is stored in `localStorage` under `accessToken` (7-day expiry); an invalid token logs the user out
- Status: `initializing` → `loading` → `authenticated` | `unauthenticated`

### Style

oxfmt: single quotes, semicolons, ES5 trailing commas. Validate `.svelte` files with `npx @sveltejs/mcp svelte-autofixer <file>`.

### Git

Keep `master` a straight line, with no merge commits: rebase a feature branch onto `master` (`git rebase master`) and then fast-forward it in (`git merge --ff-only <branch>`); never `git merge --no-ff` or a merge commit from a pull. The repo is set to `merge.ff only` and `pull.rebase true` locally, so a merge that can't fast-forward fails instead of creating one.
