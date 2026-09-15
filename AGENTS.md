# Repository Guidelines

## Project Structure & Module Organization

Concard is an Expo/React Native mobile app using TypeScript and Expo Router.

- `app/` contains file-based routes: `(auth)/` for onboarding, `(tabs)/` for main screens, and `dev/` for card and foil previews.
- `src/card/` contains card components, style definitions, and `foil/` rendering layers.
- `src/auth/` manages session and profile state; `src/lib/` contains Supabase configuration, database types, and username utilities.
- `src/ui/` holds shared controls; `src/theme/` holds palette and layout tokens.
- `assets/` contains app icons and bundled fonts.

The separate `concard` web repository owns the shared Supabase schema and migrations. Coordinate schema changes there.

## Build, Test, and Development Commands

Run commands from `concard-app/` (the Git repository root):

- `npm ci` installs dependencies from `package-lock.json`.
- `npm start` starts the Expo development server for Expo Go.
- `npm run android` / `npm run ios` starts Expo targeting that platform; use a supported host and device or simulator.
- `npm run typecheck` checks strict TypeScript without emitting files.
- `npm run lint` runs ESLint and Prettier checks.
- `npm run format` formats the repository with Prettier; review the resulting diff.

No dedicated production-build or automated-test script is configured.

## Coding Style & Naming Conventions

Use TypeScript and functional React components. Follow Prettier: tabs, single quotes, no trailing commas, and a 100-column print width. ESLint uses Expo's flat configuration.

Use PascalCase for component files (`CardShell.tsx`), camelCase for functions and variables, and descriptive lowercase utility filenames (`card-style.ts`). Follow Expo Router conventions such as `_layout.tsx`. Keep shared visual values in theme or card-style modules, and preserve compatibility with the web app's shared card definitions.

## Testing Guidelines

No test framework or coverage threshold is configured. Run typecheck and lint before submitting changes. Verify affected flows in Expo Go; check card rendering, tilt, and flip on both iOS and Android using `/dev/cards`, `/dev/foil-lab`, and `/dev/foil-sampler`. Record platforms tested and any unavailable checks. Preserve Expo Go compatibility when changing rendering dependencies.

## Commit & Pull Request Guidelines

History uses short, imperative subjects such as `Add auth and the forced onboarding flow`; follow that style. Keep commits focused. PRs should explain behavior changes, link relevant issues, list validation performed, and include screenshots or recordings for visual changes.

## Configuration

Copy `.env.example` to `.env` and configure Supabase public settings. Never place service-role keys or secrets in `EXPO_PUBLIC_*` variables. Keep local `.env` files out of commits; the current ignore rules only cover `.env*.local`.
