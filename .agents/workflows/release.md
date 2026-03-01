---
description: Prepare and publish a safe release.
---

## 0. Pre-check

- `npm run test:core`
- `npm audit` (no critical issues)
- `git status` clean

## 1. Versioning

- Read current version from `package.json`.
- Choose patch/minor/major.

## 2. Changelog

- Update `CHANGELOG.md` from `git log`.
- Include new/changed/fixed sections.

## 3. Build gate

- `npm run build` must pass.

## 4. Documentation freshness gate

- Run `npm run docs:sync`.
- Ensure release notes, plan status, and analysis claims are date-accurate.
- Run `npm run docs:check` (must pass).

## 5. Tag and push

```bash
git add [release-files]
git commit -m "release: v[X.Y.Z]"
git tag -a v[X.Y.Z] -m "Release v[X.Y.Z]"
```

- Verify scope first: `git diff --name-only`.
- Push and tag push only after confirming release scope.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.




