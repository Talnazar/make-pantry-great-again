# Dead code audit

**Repo:** make-pantry-great-again · **Branch:** `main` · **Head:** `716faf7` · **Date:** 2026-09-06
**Scope swept:** `app/`, `i18n/`, `public/`, `nuxt.config.ts`, `package.json`

Every export, asset, style rule, translation key and dependency in the app was traced to a caller.
This lists what has none, sorted by how confidently it can go — because "unreferenced" and "safe to
delete" are not the same claim.

|                 |                        |
| --------------- | ---------------------- |
| Source lines    | 5,176                  |
| Dead symbols    | 20                     |
| Dead i18n keys  | 30 of 140 (×2 locales) |
| Dead files      | 7                      |
| Lines removable | ~250                   |

## How this was read

Each exported name was grepped across `app/`, `i18n/` and `nuxt.config.ts`, then the hits were split
three ways: called from a page or another store, called only from inside its own module, or called
only from a test. A symbol counts as dead only when all three come back empty.

Two things make this sweep trustworthy for this codebase in particular. No translation key is
assembled dynamically — every `t()` call passes a string literal — so an unreferenced key really is
unreachable. And Nuxt auto-imports mean a composable can be used without an import statement, so the
search matched bare identifiers rather than import lines.

---

## 1. Confirmed dead — delete

No caller anywhere: not in a page, not in a sibling store, not in a test. Removing these cannot
change runtime behaviour.

### Whole files

**`app/composables/useConstants.ts`** (31 lines)
All three exports are orphans. `ROUTE_NAMES` is unused because routes are addressed by path through
`useLocalePath()`, and `NOTIFICATION` is unused because notification types come from the
`NotificationType` union in `types/state.ts` instead. `useConstants()` itself is never called.

### Composable wrappers

Three composables expose a factory that bundles their named exports into an object. Because Nuxt
auto-imports the named exports directly, every consumer skips the factory — so the wrapper is dead
while its contents may not be.

| Symbol                                                                       | Location                            | Why it's dead                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useUtils()`                                                                 | `app/composables/useUtils.ts:47`    | Never called. Of the six functions it wraps, only `isMobile()` has a real consumer — `appState` uses it twice to force the nav drawer shut on small screens.                                                                                                                |
| `getPlatformName()`, `isInStandaloneMode()`, `isAndroid()`, `isDarkModeOn()` | `app/composables/useUtils.ts:10–31` | PWA install-prompt helpers with nothing left to prompt. `isInStandaloneMode()` survives only because `getPlatformName()` calls it, and nothing calls that.                                                                                                                  |
| `getBooleanFromLocalStorage()`                                               | `app/composables/useUtils.ts:33`    | Called only by its own spec. The one place that would want it — the theme toggle at `settings.vue:15` — reads and writes `localStorage` directly. Kill the helper and its test together, or wire the toggle through it; leaving both is what makes the coverage misleading. |
| `useIntl()`                                                                  | `app/composables/useIntl.ts:153`    | Never called, though everything it wraps is live: `DEFAULT_CURRENCY`, `CURRENCY_LIST` and `getDefaultCurrency()` are all imported by name. Delete the factory, keep the file.                                                                                               |

### Store members

| Symbol                               | Location                          | Why it's dead                                                                                                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currencySymbol`, `formatCurrency()` | `app/stores/settings.ts:8`, `:19` | Price formatting for a pricing feature this fork does not have. The matching `list.listTotal` and `common.placeholderPrice` translation keys are dead for the same reason.                                                                                                      |
| `appData`                            | `app/stores/settings.ts:38`       | Computes a trimmed site URL and app name that nothing consumes — `useSeoDefaults()` hardcodes its own `SITE_URL` constant instead. Deleting it also strips the last use of the `AppData` type at `types/state.ts:85`.                                                           |
| `resetSettings()`                    | `app/stores/settings.ts:106`      | The settings half of a reset flow that was never finished; its counterpart `appState.resetState()` is dead too.                                                                                                                                                                 |
| `setLoading()`, `loading`            | `app/stores/ui.ts:22`, `:6`       | The flag is never set true and never read by a view. Its only trace is `appState.ts:43`, which serializes a permanently-false boolean into localStorage on every mutation. `saving`, by contrast, is live — don't confuse the two.                                              |
| `itemListsCount()`                   | `app/stores/item.ts:70`           | Counts how many lists contain an item, presumably to warn before deleting one. Nothing asks. Worth noting the inner `reduce` returns `0` rather than `value` on a miss, so it only ever returns 1 when the _last_ item in a list matches — a bug that has never been reachable. |
| `saveState()`                        | `app/stores/appState.ts:58`       | Already carries a TODO saying so. It writes the entire state as one document, which is precisely the whole-object write the merge-based sync model warns against — keeping it around is an invitation to clobber a concurrent writer.                                           |
| `resetState()`                       | `app/stores/appState.ts:241`      | Also TODO-marked. See the caveat below.                                                                                                                                                                                                                                         |

> [!WARNING]
> **Caveat on `resetState()`** — it holds the only call to `unsubscribeSnapshot()`, so on paper it is
> the app's sole teardown path for the Firestore `onSnapshot` listener. In practice nothing calls it,
> so that listener already runs for the life of the page. Deleting the function changes nothing at
> runtime — just don't delete it believing a cleanup path survives elsewhere. If a "reset everything"
> affordance is on the roadmap, keep this one and drop the TODO instead.

### Assets, styles and dependencies

| Item                                                          | Location                           | Why it's dead                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logo.png`                                                    | `app/assets/images/` (4.2 KB)      | Unreferenced. The two sibling SVGs are both live — `empty-list.svg` in the list page, `not-found.svg` in `error.vue`.                                                                                                                                                                                                              |
| `msapplication-icon-144x144.png`                              | `public/img/icons/` (5.8 KB)       | A Windows tile icon with no `browserconfig.xml` and no `msapplication-TileImage` meta tag to claim it.                                                                                                                                                                                                                             |
| `favicon-16x16.png`, `favicon-32x32.png`, `favicon-96x96.png` | `public/img/icons/` (2.1 KB total) | No `<link rel="icon">` points at any of them — `nuxt.config.ts` declares only the Apple touch icon and the Safari mask icon. This may be a missing link tag rather than three dead files; decide which before deleting. `public/favicon.ico` is also unreferenced but genuinely live, since browsers request that path unprompted. |
| `.page-title`, `.cursor-pointer`, `.hover-opacity`            | `app/assets/styles/global.scss`    | Three of the five utility classes have no user. `.w-full` and `.break-word` stay.                                                                                                                                                                                                                                                  |
| `@vue/test-utils`                                             | `package.json` devDependencies     | Never imported. Every spec drives stores and composables directly rather than mounting a component, which is the documented testing approach — so this is a dependency the project deliberately does not use.                                                                                                                      |

---

## 2. Dead translation keys — delete or wire up

`en.json` and `he.json` are in exact key parity, so every entry below is duplicated across both
files. They split cleanly into two groups that deserve opposite treatment.

### Translated strings the stores never reach for — **wire up**

Fifteen `notification.*` keys are the translated form of the notification text the stores currently
emit as hardcoded English. The translations already exist in both locales; only the wiring is
missing. This is the i18n gap `CLAUDE.md` already calls out — deleting these keys would close it in
the wrong direction.

```
notification.currencySet          notification.cartEmptied
notification.listItemDeleted      notification.cannotDeleteOnlyList
notification.listDeleted          notification.itemDeleted
notification.categoryDeleted      notification.listSaved
notification.categoryAdded        notification.categoryUpdated
notification.itemAdded            notification.addedToCart
notification.removedFromCart      notification.listPopulated
errors.nameTooLong50Store
```

### Strings for features this fork removed — **delete**

These describe an authenticated, price-tracking, separately-distributed app. This fork has no login,
no prices, and no store listing, so nothing will ever ask for them.

```
common.login                      notification.accountDeleted
list.listTotal                    list.cartTotal
list.totalPriceHint               common.placeholderPrice
common.get                        app.getTheOfficialApp
app.refreshMessage                app.pageTitleTemplate
nav.sendFeedback                  nav.refresh
nav.settings                      nav.version
notFound.urlNotFound
```

---

## 3. Live, but over-exposed — leave alone

These have callers inside their own store but none outside it, so they are public API with no public
consumer. Narrowing a store's surface is a real improvement, but a small one, and here it carries a
cost that outweighs it.

| Symbol                                                          | Location                                           | Actual caller                                                                                                                                                                                |
| --------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectedListIsValid`, `ItemIdIsInCart()`, `materializedList()` | `app/stores/list.ts`                               | Internal helpers. `materializedList()` is the shared engine behind `listMaterializedItems` and `cartMaterializedItems`, which are the two the views bind to.                                 |
| `itemByName()`, `toTitleCase()`                                 | `app/stores/item.ts`                               | Back `hasItem()` and the default-item seeding respectively.                                                                                                                                  |
| `setPageTitle()`                                                | `app/stores/ui.ts:35`                              | Called by `setTitle()`, which is the one views use.                                                                                                                                          |
| `loadStateFromStore()`, `setDefaultItems()`                     | `app/stores/appState.ts`                           | Both called from `loadState()` — the offline rehydration branch and the first-run seeding branch.                                                                                            |
| `listById()`, `pantryItemById()`                                | `app/stores/list.ts:51`, `app/stores/pantry.ts:27` | Used internally _and_ asserted against heavily by `pantry.spec.ts` and `list.spec.ts`. Unexporting these two breaks the test suite — the clearest reason to leave this whole group as it is. |

---

## 4. Stale, but not dead code — decide

Neither of these is unreachable code. Both are inherited configuration that still does something —
which is exactly why they matter more than the rest of this document.

**`public/.well-known/assetlinks.json`**
A live Digital Asset Links statement delegating `delegate_permission/common.handle_all_urls` on your
domain to Android package `com.pantry.twa`, under two signing-certificate fingerprints inherited from
upstream. In plain terms: it tells Android that an app you do not control is entitled to open
`pantry-doodoo.web.app` links. Unless you intend to ship that TWA, remove it — this is the one
finding here with a security dimension.

**`.github/workflows/deploy.yml`** — _removed 2026-09-06_
Upstream's Cloudflare Pages pipeline. It pointed at secrets this repo has never held, ran under
`working-directory: ./web` (no such directory), rebuilt a `better-sqlite3` dependency the project
does not have, and duplicated a job the two Firebase Hosting workflows already do. Deleted, with the
README note that referenced it rewritten to describe the Firebase workflows instead.

---

## Suggested order

Split rather than batched, so a bisect lands on something legible if anything does break.

1. **Remove `assetlinks.json` on its own.** It is the only change with a security rationale and
   should not be buried in a cleanup commit.
2. **Delete the confirmed-dead symbols and `useConstants.ts`**, plus the `AppData` type and the
   `loading` field that fall out with them. Drop `getBooleanFromLocalStorage()` and its spec
   together.
3. **Sweep the assets, the three CSS utilities and `@vue/test-utils`.** Settle the favicon question
   first — add the `<link rel="icon">` tags or delete the three PNGs, but don't leave it ambiguous a
   second time.
4. **Handle i18n last, in two moves:** delete the fifteen auth/pricing/nav keys from both locales,
   then wire the fifteen `notification.*` keys into the stores that currently hardcode English. The
   second move is a feature fix, not a cleanup.

Gate each one on `pnpm lint`, `pnpm typecheck` and `pnpm test:unit`. Typecheck is the load-bearing
check here: unexporting a store member that something still reads surfaces as a type error long
before it surfaces as a runtime one.

---

**Scope note** — this sweep covers unreferenced code only. It does not look for duplicated logic,
unreachable branches inside live functions, or components rendered but never interacted with. The
`itemListsCount()` reduce bug was found incidentally while confirming the function had no callers,
not by any systematic search for defects.
