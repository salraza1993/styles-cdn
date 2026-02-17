# UI-FX Build & CDN Release Process

This file is the operational guide for building, versioning, and publishing `styles-cdn` to jsDelivr.

## 1) Local build

```bash
npm install
npm run build
```

Build output is generated in `dist/`:

- `uifx.css`
- `uifx.min.css`
- individual component/util CSS files
- `.min.css` copies

### Selective `dist` generation (important)

This repo uses `build.config.json` to control which individual files are emitted.

Current default:

- Includes top-level source groups: `base`, `colors`, `components`, `utils`
- Excludes internal files starting with `_` (for example `_mixins.scss` → `_mixins.css` is not published)
- Always generates main bundles (`uifx.css`, `uifx.min.css`) and `utils.css`

Config file:

```json
{
   "individualOutput": {
      "mode": "selective",
      "includeTopLevelDirs": ["base", "colors", "components", "utils"],
      "includeFiles": [],
      "excludeNamePrefixes": ["_"]
   }
}
```

To publish everything (old behavior), set:

```json
{
   "individualOutput": {
      "mode": "all"
   }
}
```

## 2) Versioned release flow (recommended)

Use one of these commands:

```bash
npm run release:patch
npm run release:minor
npm run release:major
```

Each release command does all of the following:

1. Builds `dist/`
2. Updates package version
3. Creates git tag (`vX.Y.Z`)
4. Pushes commit and tags
5. Purges jsDelivr cache for:
   - `@latest`
   - `@X.Y.Z`
   - `@vX.Y.Z`

## 3) CDN URL strategy

### Latest (always moving)

```text
https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/uifx.css
https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/uifx.min.css
```

### Versioned (stable, production-safe)

```text
https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@vX.Y.Z/dist/uifx.css
https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@vX.Y.Z/dist/uifx.min.css
```

Recommendation:

- Use `@latest` for development/sandbox.
- Use `@vX.Y.Z` for production.

## 4) Manual cache purge (after normal push)

If you push changes without a version bump/tag and need CDN refresh:

```bash
npm run purge:cdn
```

This purges all CSS files in `dist/` for `latest`, current version, and `v`-tag format.

## 5) GitHub Action behavior

Workflow: `.github/workflows/release.yml`

On every pushed version tag (`v*`), CI will:

1. Install dependencies
2. Build CSS
3. Verify `dist`
4. Run CDN purge

## 6) Quick troubleshooting

If CDN content looks old:

1. Confirm local build changed `dist/uifx.css`.
2. Confirm commit and tag are pushed.
3. Test versioned URL first (`@vX.Y.Z`).
4. Run `npm run purge:cdn`.
5. Hard refresh browser (disable cache in dev tools when testing).

## 7) Fast verification commands

Check local token:

```bash
grep -n -- '--primary-50:' dist/uifx.css | head -n 1
```

Check CDN latest token:

```bash
curl -sL 'https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/uifx.css' | grep -n -- '--primary-50:' | head -n 1
```

Check specific version token:

```bash
curl -sL 'https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@vX.Y.Z/dist/uifx.css' | grep -n -- '--primary-50:' | head -n 1
```
