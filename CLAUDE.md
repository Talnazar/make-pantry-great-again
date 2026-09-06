# CLAUDE.md

Pantry — an offline-first shopping list + pantry tracker PWA. Nuxt 4 / Vue 3, Vuetify 4 (MD3),
Pinia, Firestore, deployed to Firebase Hosting (`pantry-doodoo.web.app`). Fork of an upstream
"Pantry" project; this fork has no authentication.

## Commands

pnpm, Node 22 (`.nvmrc`). All commands run from the repo root.

```sh
pnpm dev              # dev server
pnpm build            # production build
pnpm lint / lint:fix  # ESLint
pnpm format           # Prettier (semi:false, singleQuote, printWidth 100)
pnpm typecheck        # nuxt typecheck (vue-tsc)
pnpm test:unit        # Vitest, single run
pnpm test:watch
pnpm firebase:emulators   # Firestore emulator :8080, UI :4000
```

Run one test file: `pnpm test:unit app/stores/__tests__/pantry.spec.ts`

Hooks: pre-commit runs lint-staged, pre-push runs `pnpm test:unit`. CI (`.github/workflows/ci.yml`)
runs format:check, lint, typecheck, test, build on every push to `main` and every PR.

Local dev against the emulator: copy `.env.example` to `.env` (`NUXT_PUBLIC_USE_FIRESTORE_EMULATOR=true`),
then run `pnpm firebase:emulators` and `pnpm dev` in separate terminals. Without the env var the app
talks to production Firestore — which is the **shared live list**, so prefer the emulator.

## Architecture

### One shared, unauthenticated document

There is no login. Every client reads and writes a single Firestore document, `states/shared`
(`app/composables/useSharedState.ts`). `firestore.rules` is `allow read, write: if true`. Anyone with
the project ID can read or wipe the data — never put anything sensitive there, and treat any change
to the access model as a deliberate decision, not a refactor.

State is dual-persisted on every mutation:

1. `localStorage` under key `states` — the offline path
2. Firestore via `syncSharedState(partial)`, which is `setDoc(..., { merge: true })`

`list.loadState()` opens an `onSnapshot` subscription so all clients stay live-synced. On first run
(document missing) it seeds defaults from `app/assets/categories.json`. Offline, `loadStateFromStore()`
rehydrates from localStorage instead.

Because writes are merges of partial objects, **only send the keys you actually changed** —
`syncSharedState({ pantryItems })`, not the whole state — or you will clobber a concurrent writer.

### Stores (`app/stores/`, Pinia composition API, auto-imported)

| Store      | Responsibility                                                     |
| ---------- | ------------------------------------------------------------------ |
| `list`     | Lists, list items, cart, Firestore load/sync/hydrate, localStorage |
| `item`     | Master item catalog, units and pluralization                       |
| `category` | Categories with colors; default is `uncategorized`                 |
| `pantry`   | Home stock: `haveAtHome`, `needToBuy`, staleness                   |
| `settings` | Currency, time format, default stale-after-days                    |
| `ui`       | loading/saving flags, notifications, page title, nav drawer        |

`list` is the hub: `list.persistToLocalStorage()` is the single localStorage write path and
serializes state from _all_ stores, so every store calls into it after mutating. Cross-store calls
are pervasive and circular (`item` → `list` → `pantry` → `list`); resolve stores inside functions
(`const listStore = useListStore()`), never at module top level. `pantry.ts` carries a TODO about
extracting this into a shared persistence coordinator.

### Domain model (`app/types/state.ts`)

- `Item` — reusable catalog entry. **`id` is the lowercased, trimmed name** (`itemStore.nameToId`).
  Renaming an item therefore changes its id, and the rename paths in `item.upsertItem` /
  `list.updateItem` must rewrite every `ListItem.itemId` and `PantryItem.itemId` reference.
- `ListItem` — an `Item` inside a `List` (`itemId`, `quantity`, `notes`, `addedToCart`).
- `Category` — grouping with `name` and `color`; id is likewise the lowercased name.
- `PantryItem` — home-stock record keyed by `itemId`.
- Views consume `MaterializedList` / `MaterializedListItem`, which join items with list items grouped
  by category (`list.materializedList()`).

### Rendering

SSR is on globally. `routeRules` in `nuxt.config.ts`: `/` is prerendered; `/lists/**`, `/manage/**`
and `/settings` are `ssr: false`. Pages call `await listStore.loadState()` in `onMounted`.

Note `/pantry` is absent from `routeRules`, `sitemap.exclude` and `robots.disallow`, unlike its
siblings — so it SSRs and is indexable. Add it to all three if you touch that area.

## Conventions

- **Composition API only.** `<script setup lang="ts">` in pages/components, `defineStore()` with a
  setup function in stores. No Options API.
- **Auto-imports.** Stores, composables and Vue APIs are auto-imported; do not add explicit imports
  for them. Types from `~/types/state` are imported explicitly with `import type`.
- **Icons:** `@mdi/js` tree-shakable imports (`import { mdiPencil } from '@mdi/js'`), not icon fonts.
- **Client-only code** goes behind `import.meta.client`; browser-only plugins are `*.client.ts`
  (`app/plugins/firebase.client.ts`).
- **Vuetify 4 / MD3 tokens:** `text-display-small`, `text-headline-large`, `text-title-large`,
  `text-body-large` — not `text-h1`…`text-h6`. `variant="text"`, `variant="outlined"`, `size="large"`.
- **Theme:** dark by default, primary `#C6FF00` (lime); the toggle persists to localStorage key `theme`.
- **Tests:** Vitest + happy-dom, files in `__tests__/` next to the source, named `*.spec.ts`. Store
  tests mock `syncSharedState` and the collaborating stores with `vi.hoisted` rather than booting Nuxt.

### i18n

`en` (default, unprefixed) and `he` (RTL) in `i18n/locales/`. Strategy is `prefix_except_default`, so
build links with `useLocalePath()`. Escape `@` in translation values as `{'@'}` (vue-i18n linked
message syntax).

Known gap: notification and validation strings inside the stores are hardcoded English
(e.g. `` `${name} has been added successfully` ``). New user-facing strings should go through i18n;
moving the existing ones is worth doing when you're already in that code.

## Gotchas

- `LIST_DEFAULT` in `list.ts` computes its `id` **once at module load** via `crypto.randomUUID()`,
  and `selectedList` returns that shared constant object as its fallback. Anything that mutates the
  fallback list mutates the module-level singleton.
- `CATEGORY_COLORS` is defined twice — an array in `list.ts` and a `Set` in `category.ts`. Keep them
  in sync or unify them if you touch either.
- `.github/copilot-instructions.md` predates the pantry store and Hebrew locale; it claims four stores
  and English-only. This file is the current one — update both if you change the architecture.
