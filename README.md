# Regolith Rail

A browser sandbox for designing and testing freight dispatch policies on shuttle
rail lines, aimed at Surviving Mars: Relaunched players. Write a policy in Lua,
simulate it over many randomised runs, compare it with the game's apparent
balancing behaviour, and share the result as a link.

Not affiliated with or endorsed by Paradox Interactive or Haemimont Games.

## Development

Requires Node 24 and pnpm.

```bash
pnpm install
pnpm --filter @regolith-rail/app dev
```

| Command | What it does |
| --- | --- |
| `pnpm check` | Lint, type-check and unit tests; run before committing. |
| `pnpm docs:check` | Reference completeness and runnable documentation examples. |
| `pnpm build` | Static site in `packages/app/build/client`. Set `BASE_PATH` to serve under a prefix. |
| `pnpm docs:links` | Checks every internal link in the build. Pass `--base` to match `BASE_PATH`. |
| `pnpm test:e2e` | Builds and runs the Playwright tests against a plain static server. |
| `pnpm test:determinism` | Checks results match the golden hashes in every browser. |

The plan is in [docs/roadmap.md](docs/roadmap.md). CI deploys `main` to GitHub
Pages; [docs/deploy-s3.md](docs/deploy-s3.md) covers S3 and CloudFront.

## License

Apache-2.0. See [LICENSE](LICENSE).
