# Build Guide

This file defines how to build and change this codebase. It intentionally does **not** define product
goals, user flows, or feature requirements. Add those only in a separate `# Goals` or `# Context`
section when they are supplied. Do not invent missing product behaviour.

## Decision rules

1. Treat the user's current request and existing local patterns as the source of truth.
2. Inspect the nearest route, remote function, server service, schema, and UI primitive before editing.
3. Extend established patterns; do not introduce an abstraction, dependency, global state store, or
   design system unless the change actually needs one.
4. Keep changes narrow. Do not reformat, rename, or repair unrelated code while implementing a feature.
5. Ask for direction only when a choice changes product behaviour, data ownership, security, or public API.

## Technology stack

| Area                  | Standard                                                                     |
| --------------------- | ---------------------------------------------------------------------------- |
| Runtime and packages  | Bun; commit `bun.lock`                                                       |
| Application           | SvelteKit with Svelte 5, TypeScript, Vite, and `@sveltejs/adapter-auto`      |
| Svelte model          | Runes mode; async and remote functions are enabled                           |
| Styling               | Tailwind CSS v4, `tw-animate-css`, Inter Variable, and CSS semantic tokens   |
| Components            | shadcn-svelte, Nova style, Bits UI, stored as source in `src/ui/components/` |
| Icons                 | `@lucide/svelte`                                                             |
| Theme                 | `mode-watcher` with the root `<ModeWatcher />`                               |
| Database              | Turso/libSQL via `@libsql/client`, Drizzle ORM, and Drizzle Kit              |
| Authentication        | Better Auth email/password with the Drizzle adapter and SvelteKit cookies    |
| Validation            | Valibot at remote-function boundaries                                        |
| Formatting and checks | Prettier with Svelte and Tailwind plugins; `svelte-check`                    |

Do not replace these technologies, alter the adapter, or add parallel solutions without an explicit
request. Prefer installed packages over new dependencies.

## Commands and validation

Use Bun for all package and script commands.

```sh
bun install                 # install dependencies
bun run dev                 # run the local Vite server
bun run check               # sync SvelteKit types and type-check with svelte-check
bun run check:watch         # watch type-checking
bun run lint                # check Prettier formatting
bun run format              # write Prettier formatting
bun run build               # make a production build
bun run preview             # preview that build
```

Run `bun run check` and `bun run lint` for normal source changes. Also run `bun run build` after
route, configuration, database, authentication, or production-facing changes. Do not use
`bun run format` on unrelated files. If validation already fails before the change, report that
separately rather than silently correcting it.

There is no test runner or coverage target yet. If tests are introduced, use `*.test.ts`, place them
next to the module or under `tests/`, and add an explicit package script.

## Repository map and module boundaries

```text
src/
  app/                    remote-function modules and browser-facing domain facades
    <domain>/
      command.remote.ts   mutations and form handlers
      query.remote.ts     reads
      validation.ts       Valibot schemas
      index.ts            small public facade
  lib/                    shared assets, utilities, and framework-bound services
  routes/                 SvelteKit pages, endpoints, and route-level server guards
    dashboard/            authenticated dashboard shell and nested app routes
  server/                 server-only auth, database, and external integrations
    db/                   Drizzle client, schemas, and generated auth schema
  ui/                     app shell components, theme widgets, primitives, and utilities
    components/           checked-in shadcn-svelte/ Bits UI primitives
    hooks/                reusable Svelte hook modules
  env.ts                  declared environment variables
  hooks.server.ts         request-session setup
static/                   public static assets
```

Use aliases, never deep relative imports:

- `#app/*` → `src/app/*`
- `#lib/*` → `src/lib/*`
- `#server/*` → `src/server/*`
- `#ui/*` → `src/ui/*`

Keep Better Auth configuration, database setup, private environment variables, and provider SDKs
under `src/server/`. Browser-facing Svelte files must not import `#server/*` or private environment
modules. Remote functions are server-side boundaries and may use `#server/db` directly for small,
single-domain operations; extract a `src/server/<domain>/` service when logic is shared, complex,
or wraps an external provider. Routes and components should call a domain facade rather than
duplicating remote-function behaviour. Keep route-only loads and access guards in `+page.server.ts`
or `+layout.server.ts`.

## Feature implementation pattern

For a new domain, build in this order:

1. Define or extend tables in `src/server/db/` and re-export them from `src/server/db/schema.ts`.
2. Put shared business logic, provider calls, and complex database workflows in
   `src/server/<domain>/`; simple remote functions may access `#server/db` directly.
3. Add Valibot input schemas in `src/app/<domain>/validation.ts`.
4. Expose reads through `query.remote.ts` and mutations/forms through `command.remote.ts`.
5. Export a small, named facade from `src/app/<domain>/index.ts`.
6. Use that facade in routes and components; keep pages focused on UI and composition.

Use `query` for reads, `command` for non-form mutations, and `form` for validated form
submissions. Use `query.live(async function* () { ... })` only when a screen genuinely needs live
data; yield complete, valid snapshots and use a deliberate refresh/invalidation strategy—never a
tight polling loop. Obtain the request with `getRequestEvent()` only within a
request/remote-function context. Validate at the boundary before service code runs. Preserve form
field names expected by the remote form helpers; use an internal field such as `_password` when a
submitted name must differ.

Expected user-facing failures should return a small safe result, for example `{ error: '...' }`.
Re-throw unexpected errors. Never catch and convert SvelteKit `redirect(...)` control flow into a
generic error response.

## Authentication, authorization, and data safety

`src/hooks.server.ts` resolves the Better Auth session and adds `user` and `session` to
`event.locals`. `src/server/auth.ts` is the single Better Auth configuration. Keep direct auth API
calls behind `src/lib/auth.ts` or a server-side domain service. Preserve existing layout guards:
the auth layout redirects signed-in users, and protected layouts redirect anonymous users.

Every new server-side page, query, command, action, and mutation handling user data must establish
the authenticated identity from `event.locals` or `getRequestEvent()`. Scope every read and write
to that identity. Never accept a user ID, owner ID, role, or authorization status from the browser
as proof of access. Keep secrets and private environment variables server-only, and do not log
passwords, session values, tokens, or complete database URLs.

## Database and environment workflow

```sh
bun run db:push            # directly synchronize the configured Turso database
bun run db:generate        # create Drizzle migrations
bun run db:migrate         # apply generated migrations to the configured database
bun run db:studio          # inspect the configured database with Drizzle Studio
```

These commands act on the Turso database selected by `DATABASE_URL`; inspect the configured target
before running a schema-mutating command. Prefer `db:generate` and `db:migrate` for durable,
reviewable schema changes. Use `db:push` only when direct synchronization is the intended workflow.

Copy `.env.example` to `.env`. Required values are `DATABASE_URL`, `DATABASE_AUTH_TOKEN`,
`ORIGIN`, and `BETTER_AUTH_SECRET`; never commit real values. The runtime database client uses
the Turso URL plus `DATABASE_AUTH_TOKEN` and fails fast when either is absent; Drizzle Kit requires
`DATABASE_URL`. Add application tables to `src/server/db/schema.ts`, which Drizzle Kit uses as
its schema entry point. Do not hand-edit `src/server/db/auth.schema.ts`; run
`bun run auth:schema` only when an intentional Better Auth schema change requires regeneration.

## Svelte, TypeScript, and routes

Use Svelte 5 APIs: `$props`, `$state`, `$derived`, `$effect`, `$bindable`, and
`{@render ...}`. Do not introduce legacy component patterns. Follow SvelteKit naming:
`+page.svelte` for UI, `+page.server.ts`/`+layout.server.ts` for server loads and guards, and
generated `./$types` for load types. Prefer explicit TypeScript types when an inferred shape is not
obvious.

For client navigation and paths, use SvelteKit APIs: `resolve` from `$app/paths` for typed route
URLs, `goto` from `$app/navigation` for programmatic navigation, and `page` from `$app/state`
for reactive route state. Do not hand-build internal URLs or introduce the legacy `$app/stores`
API. For parameter-driven data, derive the current parameter and the corresponding query with
`$derived`; keep the loading, success, empty, and error states visible in the route.

### Required Svelte script organization

For every Svelte `<script lang="ts">` block, including module-context blocks when applicable,
organize imports and code in this exact order:

1. Services
2. Types
3. Utils
4. Components
5. Icons
6. Script

Use only the needed sections, with exactly one blank line between sections. Use the section labels
exactly as shown. All imports stay above `// Script`; if a block has executable code, it must have
a `// Script` section. Variables, constants, runes, derived values, effects, functions, and event
handlers belong below it. If an import does not fit a category, preserve the required order and
follow the closest local convention.

```svelte
<script lang="ts">
	// Services
	import { Auth } from '#app/auth';

	// Types
	import type { Snippet } from 'svelte';

	// Utils
	import { cn } from '#ui/utils';

	// Components
	import { Button } from '#ui/components/button';

	// Icons
	import { Lock, Mail } from '@lucide/svelte';

	// Script
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
</script>
```

Prettier is authoritative: tabs, single quotes, no trailing commas, and a 100-character print
width. Match established naming: `PascalCase` for components and classes, `camelCase` for
values/functions, uppercase remote-function constants such as `SIGN_IN`, and validators such as
`V_SignIn`. Preserve explicit `.js` suffixes where nearby internal imports use them; TypeScript
rewrites those imports for the emitted module format. Do not normalize unrelated legacy spelling or
formatting in a focused change.

## UI system

`src/routes/layout.css` is the only global stylesheet. It owns fonts, light/dark semantic tokens,
radius tokens, and Tailwind theme mapping. Reuse semantic utilities such as `bg-background`,
`text-muted-foreground`, `border-border`, and `text-destructive`; do not introduce raw palette
colours or duplicate global styles.

Use the existing shadcn-svelte primitives in `src/ui/components/` before creating equivalents. Keep
component barrel exports in sync when adding a primitive. Use `cn` from `#ui/utils` for conditional
or merged classes. Prefer a component's existing variants before overriding colours, spacing, or
typography with `class`. Use `@lucide/svelte` icons, accessible labels, and visible form errors.

For compound primitives (for example sidebar, sheet, tooltip, card, and empty state), import the
barrel as a namespace and compose its exported parts: `import * as Sidebar from
'#ui/components/sidebar/index.js'`. Use a named import for single primitives such as `Button` and
`Input`. Preserve snippet-based child APIs when a primitive exposes them. The dashboard shell owns
`Sidebar.Provider`, `AppSidebar`, and the main content region; nested dashboard routes should
render their content inside that shell rather than creating another navigation layout.

Theme support is already wired at the root with `<ModeWatcher />`. Use the existing theme controls
and `toggleMode` from `mode-watcher`; do not add a second theme provider or duplicate dark-mode
state. Use `Empty` primitives for empty data states and keep a distinct loading, empty, error, and
success state for asynchronous UI.

Use `flex` or `grid` with `gap-*`, not `space-x-*` or `space-y-*`. Use `size-*` when width and
height are equal. For an icon inside a shadcn button, use its supported `data-icon` attribute rather
than a sizing class when the primitive already handles icon sizing.

## Completion checklist

Before handing off a change:

- Confirm the implementation stays within the request and respects module boundaries.
- Check new reads and mutations for authentication, authorization scope, and Valibot validation.
- Check layouts for semantic Tailwind tokens, responsiveness, loading/empty/error states, labels,
  and keyboard access.
- Run the appropriate validation commands and report their results accurately.
- Keep the diff limited to intentional files; never include `.env`, Turso credentials, generated
  changes, or lockfile changes unless they are explicitly required.

---

## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: drizzle, ai-tools, experimental

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
