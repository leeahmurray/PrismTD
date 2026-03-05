# Release Checklist

Use this for `staging -> main` release PRs.

## Pre-Release

1. Confirm `staging` is green in GitHub Actions (`CI / build`).
2. Test the latest `staging` deployment on `staging.prismtd.gg`.
3. Verify core gameplay flow:
   - Start wave, speed toggle, pause, tower placement, upgrade/sell.
   - Victory/defeat screens and restart flow.
   - Background music and key SFX play as expected.
4. Confirm no console errors in browser dev tools.
5. Verify any required Vercel env var changes are set in `Production`.

## Release

1. Open PR from `staging` into `main`.
2. Complete PR template and call out user-visible changes.
3. Wait for `CI / build` to pass.
4. Merge PR to `main`.
5. Confirm new production deploy succeeds in Vercel.

## Post-Release

1. Smoke test production at `prismtd.gg` and `www.prismtd.gg`.
2. Check key pages/assets load and audio works.
3. Roll back by redeploying previous successful deployment in Vercel if needed.
