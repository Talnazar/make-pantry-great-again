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
```

Run a single test file:

```sh
pnpm test:unit -- -t "useUtils"
```

Husky installs Git hooks through `pnpm install`. Pre-commit runs lint-staged; pre-push runs the unit tests.

## Architecture

Pantry is a single Nuxt 4 + Vue 3 shopping list PWA using Vuetify 4 (MD3), Pinia, Firebase Firestore, and Firebase Hosting. Active application code lives at the repository root under `app/`.

| **Framework** | Nuxt 4 + Vue 3 |
| **UI** | Vuetify 4 (MD3) |
| **State** | Pinia (4 stores) |
| **Testing** | Vitest + happy-dom |
| **Deployment** | Firebase Hosting |
| **Package Manager** | pnpm |
| **Node** | 22 |

### Backend & Offline-First Sync

Firebase initializes the app and provides Firestore. State is dual-persisted:

1. **localStorage** — always available, enables offline use
2. **Firestore** (collection `states`) — shared state synchronized with `onSnapshot()`

All stores write to localStorage after mutations. The list store manages Firestore sync with `setDoc(..., { merge: true })` to avoid overwriting other fields.

### Rendering Strategy

SSR is enabled globally. Route rules in `nuxt.config.ts` fine-tune behavior:

- **Prerendered:** `/`
- **CSR only (`ssr: false`):** `/lists/**`, `/manage/**`, `/settings`

### State Management (Pinia)

Four composition-API stores in `app/stores/`:

| Store      | Purpose                                                    |
| ---------- | ---------------------------------------------------------- |
| `list`     | Shopping lists, list items, cart, and Firestore sync       |
| `item`     | Master item registry with units and categories             |
| `category` | Item categories with colors; default is `uncategorized`    |
| `settings` | Currency preference, including auto-detection via ipapi.co |

UI state, notifications, page title, and nav drawer state are part of the shared list state rather than a separate UI store. Cross-store calls are common — `list.ts` reads from `item`, `category`, and `settings` stores.

### Domain Model (`app/types/state.ts`)

| Type       | Purpose                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| `List`     | Shopping list with `id`, `name`, `icon`, `items: ListItem[]`, `cartPanelOpen` |
| `Item`     | Reusable catalog item with `name`, `unit`, `categoryId`                       |
| `ListItem` | Instance of an Item in a List (`itemId`, `quantity`, `notes`, `addedToCart`)  |
| `Category` | Grouping with `name` and `color`; default is `"uncategorized"`                |

Views use `MaterializedList` / `MaterializedListItem` types that join Items with ListItems grouped by Category for rendering.

### Routing

Nuxt file-based routing is used. Pages use `definePageMeta` for the `default`
layout; this fork has no authentication middleware.

### Layouts

- `default.vue` — the app layout with navigation, list navigation, and the full app bar.

### i18n

English is the only configured locale (default, no prefix). Locale files are in
`i18n/locales/`. The `@` symbol in translation values must be escaped as `{'@'}`
(vue-i18n linked message syntax). HTML in messages requires `strictMessage: false`
(already set in `nuxt.config.ts`).

## Key Conventions

### Composition API Everywhere

Stores use `defineStore()` with composition API (setup function). Pages and components use `<script setup lang="ts">`. No Options API or class-based components.

### Environment Variables

Uses Nuxt runtime config with `NUXT_PUBLIC_*` environment variables. Access via `useRuntimeConfig().public`. Key vars: `appName`, `siteUrl`, `siteEmail`, `siteAndroidAppUrl`, `githubLink`, and `commitHash`.

### Icons

Uses `@mdi/js` (tree-shakable JS imports), not icon fonts. Import individual icons:

```typescript
import { mdiPencil, mdiDelete } from '@mdi/js'
```

### Composables

Shared logic in `app/composables/`:

- `useSharedState` — Firestore shared-state document helpers
- `useUtils` — platform detection (`isAndroid`, `isMobile`, `isInStandaloneMode`), localStorage helpers
- `useIntl` — currency formatting, currency list (150+ ISO 4217 codes)
- `useConstants` — named route constants (`ROUTE_NAMES`), notification event types
- `useSeoDefaults` — SEO meta tags with i18n support

### Client-Only Code

Guard browser-only code with `import.meta.client`. Browser-only plugins are suffixed `.client.ts`, such as `firebase.client.ts`.

### Theme

Dark mode is the default. Primary color is `#C6FF00` (lime). Theme toggle persists to localStorage key `theme` and reads with an `import.meta.client` guard on mount.

### Tests

Vitest with happy-dom. Test files live in `__tests__/` directories alongside source (e.g., `app/composables/__tests__/useUtils.spec.ts`). Naming convention: `*.spec.ts`.

### Firestore Security

The current `firestore.rules` allow anyone to read and write the shared
`states/shared` document because this fork has no authentication. Do not store
sensitive data there, and check the rules before changing the shared-state access model.

### Vuetify 4 Notes

Vuetify 4 uses MD3 design tokens. Key differences from Vuetify 2/3:

- Typography: `text-h1`…`text-h6` are replaced by `text-display-large`, `text-headline-small`, `text-title-large`, etc.
- Buttons: `text` → `variant="text"`, `large` → `size="large"`
- Inputs: `outlined` → `variant="outlined"`
- Colors: `lime--text text--darken-2` → `text-lime-darken-2`
