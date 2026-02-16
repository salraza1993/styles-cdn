# UI-FX Styles CDN

Simple CSS CDN delivery using GitHub + jsDelivr (no npm package required).

## CDN URLs

### Latest (dynamic)

```html
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/uifx.min.css"
/>
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/uifx.css"
/>
```

### Versioned (recommended for production)

Replace `v1.0.0` with your release tag:

```html
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@v1.0.0/dist/uifx.min.css"
/>
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@v1.0.0/dist/uifx.css"
/>
```

## Individual files

You can also import files one by one:

```html
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/buttons.css"
/>
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/form-elements.css"
/>
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/cards.css"
/>
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/utils.css"
/>
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@latest/dist/reset.css"
/>
```

Minified individual file example:

```html
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@v1.0.0/dist/buttons.min.css"
/>
```

Versioned individual file example:

```html
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/gh/salraza1993/styles-cdn@v1.0.0/dist/buttons.css"
/>
```

## Build process

Install and build:

```bash
npm install
npm run build
```

This generates:

- `dist/uifx.css`
- `dist/uifx.min.css`
- individual `dist/*.css` files (flattened from `src/**`)
- minified copies for all outputs: `dist/*.min.css`
- aliases: `dist/form-elements.css` and `dist/utils.css`

## Versioning + release (CLI)

Use one command to build, version, tag, and push:

```bash
npm run release:patch
```

Or:

```bash
npm run release:minor
npm run release:major
```

Each command will:

1. Build `dist/`
2. Commit `dist` + `package.json`
3. Create a git tag like `v1.0.1`
4. Push commit + tags to GitHub

## Notes

- Use `@latest` for dynamic updates.
- Use `@vX.Y.Z` for stable production caching and safe rollbacks.
- jsDelivr may cache aggressively; versioned tags are the cleanest production strategy.
