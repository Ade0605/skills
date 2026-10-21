# Re-critique: Plan — Upgrade runtime from Node 18 to Node 20

This is a re-critique after fixes.

## Previous critique (Check #3, excerpt)

```
Target: plans/node-20-upgrade.md
  Completeness:
    req-coverage ..... FAIL [blocker] — The requirement is "every environment runs Node 20", but Task 1's Dockerfile still uses `FROM node:18-alpine` (plan line 14).
                       Fix: Change the base image to node:20-alpine.
Result: 21/22 PASS — 1 failing (1 blocker, 0 minor)
```

## Changes made since the previous critique

- plans/node-20-upgrade.md:14 — Dockerfile base image node:18-alpine → node:20-alpine

## Revised plan (plans/node-20-upgrade.md)

Requirement: every environment (local, CI, production) runs Node 20. Node 18 is end-of-life.

### Task 1: Production image

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "dist/server.js"]
```

Verify: `docker build -t app . && docker run --rm app node --version` prints `v20.x`.

### Task 2: CI

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm test
```

Verify: the CI run log shows `node --version` = v20.x.

### Task 3: Local development

- Set `"engines": { "node": ">=20" }` in `package.json`.
- Add `.nvmrc` containing `20`.

Verify: `npm install` on Node 18 prints an engines warning; `nvm use` selects 20.

### Rollback

Revert the commit; the three changes are independent config edits with no data migration.
