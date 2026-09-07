# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Code Quality & Tooling

This project uses **pnpm** and Node **22** (see `.nvmrc`). Run `pnpm install` once and
the Git hooks below are set up automatically.

### Available scripts

| Command                   | What it does                                       |
| ------------------------- | -------------------------------------------------- |
| `pnpm firebase:emulators` | Start the local Firestore emulator and Emulator UI |
| `pnpm lint`               | Lint everything with ESLint                        |
| `pnpm lint:fix`           | Lint and auto-fix what it can                      |
| `pnpm format`             | Format all files with Prettier                     |
| `pnpm format:check`       | Check formatting without writing changes           |
| `pnpm typecheck`          | Type-check the project with `nuxt typecheck`       |
| `pnpm test:unit`          | Run the unit tests once (Vitest)                   |
| `pnpm test:watch`         | Run the unit tests in watch mode                   |

### Local Firestore emulator

Local development can use a separate Firestore emulator instead of the shared
Firebase project. Copy `.env.example` to `.env` once, then run these commands
in separate terminals:

```bash
pnpm firebase:emulators
pnpm dev
```

The app connects to Firestore at `127.0.0.1:8080`, and the Emulator UI is
available at `http://127.0.0.1:4000`. Emulator data is temporary unless you
start Firebase with an import/export directory. The local switch defaults to
off when the environment variable is absent, so production continues to use
Cloud Firestore.

### Git hooks (Husky + lint-staged)

- **pre-commit** — runs `lint-staged`, which auto-formats and lints only the files
  you staged. Fast, and keeps every commit tidy.
- **pre-push** — runs the unit tests so broken code never leaves your machine.

Hooks install automatically via the `prepare` script on `pnpm install`. To bypass a
hook in a pinch (use sparingly), add `--no-verify` to your `git commit`/`git push`.

### Continuous Integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:
it checks formatting, lints, type-checks, runs the tests, and builds the app.

Deploys go to Firebase Hosting: `.github/workflows/firebase-hosting-merge.yml`
publishes the live site on every push to `main`, and
`.github/workflows/firebase-hosting-pull-request.yml` builds a preview channel for
each pull request.
