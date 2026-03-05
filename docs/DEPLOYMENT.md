# Deployment Workflow

## Branch Roles

- `main`: Production. Merges here deploy to `prismtd.gg`.
- `staging`: Staging. Merges here deploy to `staging.prismtd.gg`.
- `feature/*`: Development work. Each branch gets a Vercel preview URL.

## Daily Flow

1. Branch from `staging`: `feature/<short-name>`.
2. Push branch and open a PR into `staging`.
3. Wait for CI (`npm ci` + `npm run build`) and test the Vercel preview.
4. Merge to `staging` for staging validation.
5. Open PR `staging -> main` when ready for release.
6. Merge to `main` to deploy production.

## One-Time GitHub Setup

1. Create `staging` branch and push it.
2. Protect `main` and `staging`:
   - Require pull request before merging.
   - Require status checks to pass.
   - Select the `CI / build` check.
3. Disable force-pushes on both protected branches.

## One-Time Vercel Setup

1. Keep production branch set to `main`.
2. Add `staging.prismtd.gg` domain to the project.
3. In project settings, assign the `staging` branch to `staging.prismtd.gg`.
4. Keep `prismtd.gg` and `www.prismtd.gg` on production (`main`).

## Environment Variables

- Put dev keys in `Development`.
- Put staging keys in `Preview` (or branch-specific for `staging` if needed).
- Put live keys in `Production`.
- Use only `VITE_*` variables for frontend access.
