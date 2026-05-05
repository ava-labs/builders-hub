# Encrypted ERC Circuit Artifacts

This directory holds compiled Circom artifacts (`.wasm` witness generators and `.zkey` proving keys) required for client-side zero-knowledge proof generation.

## Required layout

```
public/eerc/circuits/
├── registration/
│   ├── registration.wasm
│   └── registration.zkey
├── mint/
│   ├── mint.wasm
│   └── mint.zkey
├── transfer/
│   ├── transfer.wasm
│   └── transfer.zkey
├── withdraw/
│   ├── withdraw.wasm
│   └── withdraw.zkey
└── burn/
    ├── burn.wasm
    └── burn.zkey
```

## Populating the artifacts

Artifacts are NOT committed to the repo (multi-MB each). Run:

```sh
pnpm eerc:fetch-circuits
```

This downloads the latest released artifacts from the [ava-labs/EncryptedERC](https://github.com/ava-labs/EncryptedERC) repo (`circom/build/`) into this directory.

## Why not bundled?

- `.zkey` files for the `transfer` and `mint` circuits are generated from a Powers-of-Tau ceremony at ptau 15 and are several MB each. Committing them bloats the repo.
- They're static assets served by Next.js from `public/` — they don't count toward the serverless function size limit on Vercel.
- Long-cache headers are set via `next.config.mjs` so the browser caches them aggressively.

## Circuit sizes (approximate)

| Circuit | PTau | wasm size | zkey size |
|---|---|---|---|
| registration | 11 | ~200 KB | ~2 MB |
| mint | 15 | ~800 KB | ~32 MB |
| transfer | 15 | ~900 KB | ~36 MB |
| withdraw | 14 | ~400 KB | ~16 MB |
| burn | 15 | ~800 KB | ~28 MB |

Total: ~115 MB. All loaded lazily per-tool — users only pay the cost of the circuit they invoke.
