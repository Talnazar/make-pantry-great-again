# Copilot Instructions for Pantry

## Build, Test, and Lint

All commands run from the repository root. The package manager is **pnpm** and the project uses Node **22** (see `.nvmrc`).

```sh
pnpm install          # Install dependencies
pnpm dev              # Dev server with hot-reload
pnpm build            # Production build (Nuxt)
pnpm generate         # Static site generation
pnpm preview          # Preview the production build
pnpm lint             # Lint everything with ESLint
pnpm lint:fix         # Lint and auto-fix what it can
pnpm format           # Format all files with Prettier
pnpm format:check     # Check formatting without writing changes
pnpm typecheck        # Type-check with Nuxt
pnpm test:unit        # Run all unit tests (Vitest)
pnpm test:watch       # Run tests in watch mode
pnpm firebase:emulators  # Firestore emulator on :8080, Emulator UI on :4000
```

Run a single test file, or filter by test name:

```sh
pnpm test:unit app/stores/__tests__/pantry.spec.ts
pnpm test:unit -- -t "useUtils"
```

Husky installs Git hooks through `pnpm install`. Pre-commit runs lint-staged; pre-push runs the unit tests. CI (`.github/workflows/ci.yml`) runs format:check, lint, typecheck, tests, and build on every push to `main` and every pull request.

### Local Firestore emulator

Copy `.env.example` to `.env` to point the app at a local emulator instead of the shared Firebase project, then run `pnpm firebase:emulators` and `pnpm dev` in separate terminals. Without `NUXT_PUBLIC_USE_FIRESTORE_EMULATOR=true`, the dev server reads and writes the **live shared list** — prefer the emulator.

## Architecture

Pantry is a single Nuxt 4 + Vue 3 shopping list and pantry-tracking PWA using Vuetify 4 (MD3), Pinia, Firebase Firestore, and Firebase Hosting. Active application code lives at the repository root under `app/`.

| Concern         | Choice             |
| --------------- | ------------------ |
| Framework       | Nuxt 4 + Vue 3     |
| UI              | Vuetify 4 (MD3)    |
| State           | Pinia (6 stores)   |
| i18n            | English + Hebrew   |
| Testing         | Vitest + happy-dom |
| Deployment      | Firebase Hosting   |
| Package Manager | pnpm               |
| Node            | 22                 |

### Backend & Offline-First Sync

There is no authentication. Every client reads and writes **one** Firestore document, `states/shared` (see `app/composables/useSharedState.ts`). State is dual-persisted:

1. **localStorage** (key `states`) — always available, enables offline use
2. **Firestore** — the shared document, kept live via `onSnapshot()`

`list.loadState()` opens the snapshot subscription and, if the document does not exist yet, seeds defaults from `app/assets/categories.json`. Offline, `loadStateFromStore()` rehydrates from localStorage instead.

Firestore writes go through `syncSharedState(partial)`, which is `setDoc(..., { merge: true })`. **Send only the keys you actually changed** — `syncSharedState({ pantryItems })`, not the whole state — so concurrent writers are not clobbered.

### Rendering Strategy

SSR is enabled globally. Route rules in `nuxt.config.ts` fine-tune behavior:

- **Prerendered:** `/`
- **CSR only (`ssr: false`):** `/lists/**`, `/manage/**`, `/settings`

`/pantry` is currently absent from `routeRules`, `sitemap.exclude`, and `robots.disallow`, unlike its siblings, so it renders on the server and is indexable. Add it to all three if you work in that area.

### State Management (Pinia)

Six composition-API stores in `app/stores/`, all auto-imported:

| Store      | Purpose                                                        |
| ---------- | -------------------------------------------------------------- |
| `list`     | Shopping lists, list items, cart, Firestore load/sync, saving  |
| `item`     | Master item registry with units and categories                 |
| `category` | Item categories with colors; default is `uncategorized`        |
| `pantry`   | Home stock: `haveAtHome`, `needToBuy`, staleness tracking      |
| `settings` | Currency (auto-detected via ipapi.co), time format, stale days |
| `ui`       | Loading/saving flags, notifications, page title, nav drawer    |

`list` is the hub. `list.persistToLocalStorage()` is the single localStorage write path and serializes state from _all_ stores, so every store calls into it after mutating. Cross-store calls are pervasive and circular (`item` → `list` → `pantry` → `list`), so always resolve stores inside functions (`const listStore = useListStore()`), never at module top level. `pantry.ts` carries a TODO about extracting persistence into a shared coordinator.

### Domain Model (`app/types/state.ts`)

| Type         | Purpose                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| `List`       | Shopping list with `id`, `name`, `icon`, `items: ListItem[]`, `cartPanelOpen` |
| `Item`       | Reusable catalog item with `name`, `unit`, `categoryId`                       |
| `ListItem`   | Instance of an Item in a List (`itemId`, `quantity`, `notes`, `addedToCart`)  |
| `Category`   | Grouping with `name` and `color`; default is `"uncategorized"`                |
| `PantryItem` | Home-stock record keyed by `itemId`, with `updatedAt` and `staleAfterDays`    |

Item and category **ids are the lowercased, trimmed name** (`itemStore.nameToId`). Renaming therefore changes the id, so the rename paths in `item.upsertItem` and `list.updateItem` must rewrite every `ListItem.itemId` and `PantryItem.itemId` that referenced it.

Views use `MaterializedList` / `MaterializedListItem` types that join Items with ListItems grouped by Category for rendering; the pantry page uses `MaterializedPantryItem` from `app/stores/pantry.ts`.

### Routing

Nuxt file-based routing is used. Pages use `definePageMeta` for the `default` layout; this fork has no authentication middleware. Pages are `index.vue`, `pantry.vue`, `settings.vue`, `lists/index.vue`, `lists/[listId].vue`, and `manage/{lists,items,categories}.vue`. Named route constants live in `useConstants` (`ROUTE_NAMES`).

### Layouts

- `default.vue` — the app layout with navigation, list navigation, and the full app bar.

## Key Conventions

### Composition API Everywhere

Stores use `defineStore()` with composition API (setup function). Pages and components use `<script setup lang="ts">`. No Options API or class-based components.

### Auto-Imports

Stores, composables, and Vue APIs are auto-imported — do not add explicit imports for them. Types from `~/types/state` are imported explicitly with `import type`.

### Environment Variables

Uses Nuxt runtime config with `NUXT_PUBLIC_*` environment variables, accessed via `useRuntimeConfig().public`. The configured keys are `appName`, `siteUrl`, `useFirestoreEmulator`, `firestoreEmulatorHost`, and `firestoreEmulatorPort`. The Firebase web config itself is hardcoded in `app/plugins/firebase.client.ts`.

### Icons

Uses `@mdi/js` (tree-shakable JS imports), not icon fonts. Import individual icons:

```typescript
import { mdiPencil, mdiDelete } from '@mdi/js'
```

### Composables

Shared logic in `app/composables/`:

- `useSharedState` — Firestore shared-state document helpers (`sharedStateDoc`, `syncSharedState`)
- `useUtils` — platform detection (`isAndroid`, `isMobile`, `isInStandaloneMode`), localStorage helpers
- `useIntl` — currency formatting, `getDefaultCurrency()` via ipapi.co, currency list (150+ ISO 4217 codes)
- `useConstants` — named route constants (`ROUTE_NAMES`), notification event types
- `useSeoDefaults` — SEO meta tags with i18n support

### i18n

Two locales in `i18n/locales/`: `en` (default, no prefix) and `he` (Hebrew, RTL). Strategy is `prefix_except_default`, so build links with `useLocalePath()` rather than hardcoding paths. RTL is wired through Vuetify's `locale.rtl` and the `dir` attribute in `app.vue`.

The `@` symbol in translation values must be escaped as `{'@'}` (vue-i18n linked message syntax). HTML in messages requires `strictMessage: false` (already set in `nuxt.config.ts`).

Known gap: notification and validation strings inside the stores are still hardcoded English (e.g. `` `${name} has been added successfully` ``). New user-facing strings should go through i18n.

### Client-Only Code

Guard browser-only code with `import.meta.client`. Browser-only plugins are suffixed `.client.ts`, such as `firebase.client.ts`.

### Theme

Dark mode is the default. Primary color is `#C6FF00` (lime). Theme toggle persists to localStorage key `theme` and reads with an `import.meta.client` guard on mount.

### Tests

Vitest with happy-dom. Test files live in `__tests__/` directories alongside source (e.g., `app/composables/__tests__/useUtils.spec.ts`). Naming convention: `*.spec.ts`. Store tests mock `syncSharedState` and the collaborating stores with `vi.hoisted` rather than booting Nuxt.

### Firestore Security

The current `firestore.rules` allow anyone to read and write the shared `states/shared` document because this fork has no authentication. Do not store sensitive data there, and treat any change to the shared-state access model as a deliberate decision rather than a refactor.

### Vuetify 4 Notes

Vuetify 4 uses MD3 design tokens. Key differences from Vuetify 2/3:

- Typography: `text-h1`…`text-h6` are replaced by `text-display-large`, `text-headline-small`, `text-title-large`, etc.
- Buttons: `text` → `variant="text"`, `large` → `size="large"`
- Inputs: `outlined` → `variant="outlined"`
- Colors: `lime--text text--darken-2` → `text-lime-darken-2`

## Known Rough Edges

- `LIST_DEFAULT` in `list.ts` computes its `id` once at module load via `crypto.randomUUID()`, and `selectedList` returns that shared constant object as its fallback.
- `CATEGORY_COLORS` is defined twice — an array in `list.ts` and a `Set` in `category.ts`.
- `CLAUDE.md` at the repository root covers the same ground for Claude Code. Update both when the architecture changes.
