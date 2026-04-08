# Avalanche Builder Hub

<div align="center">
  <img src="public/logo-white.png?raw=true">
</div>

The source for [build.avax.network](https://build.avax.network) — docs, academy courses, integrations directory, and developer console for Avalanche.

## Getting Started

```bash
yarn install
yarn build:remote   # download remote MDX files (APIs, RPC reference)
yarn dev            # start local dev server
```

## Contributing

- **Quick fix:** Click "Edit on GitHub" on any page, make the change, and open a PR.
- **New content:** Fork or clone the repo, create a branch, and open a PR against `master`.
- Docs live in [`content/docs/`](content/docs), academy courses in [`content/academy/`](content/academy), and images in [`public/images/`](public/images).
- Vercel deploys a preview on every PR.

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by git hooks and CI.

```
type(scope): description
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

## Issues

Found something wrong or missing? [Open an issue](https://github.com/ava-labs/builders-hub/issues/new/choose).
