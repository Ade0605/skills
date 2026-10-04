---
name: integrate-social-sdk
description: Use when adding the Social SDK to an application: choose a backend, connect or select authorized accounts, publish mock-first, render independent outcomes, wire verified webhooks, or test an integration.
---

# Integrate the Social SDK

Use this workflow when an application needs social account connections, publishing, delivery status, or provider webhooks.

## Workflow

1. Start with `mockBackend()` and `MemoryIdempotencyStore` from `@opencoredev/social-sdk/testing`. Build the publish request and render every per-target `DeliveryOutcome` state before configuring a live backend.
2. Keep tenant and principal authorization in the application. Pass `{ authorization: { tenantId, principalId } }` to client operations and select only account refs returned for that authenticated tenant.
3. For account connections, call `ConnectionManager.begin` with an exact HTTPS redirect allowlist entry. Redirect to the real provider authorization URL. On the provider callback, preserve the raw callback URL and returned state, then call `discover`. Present the persisted discovered accounts for explicit selection and call `select` with the authenticated session. Use a configured OAuth provider factory for the token exchange.
4. Persist connection attempts, grants, credentials, idempotency claims, and webhook inbox records in durable storage before production. The in-memory stores are for tests and local demos.
5. Verify webhook signatures against raw request bytes, decode the normalized event, resolve provider account IDs to application tenants, and call `acceptWebhook`. Return an acknowledgement after the app-owned inbox accepts or quarantines the event; process pending events asynchronously and deduplicate by the returned key.
6. Test success, partial failure, processing/unknown outcomes, unauthorized account selection, callback replay, duplicate webhooks, and unmapped-account quarantine. Never put provider secrets in browser code, examples, or test fixtures.

See the recipes in `references/` for executable TypeScript recipes:

- `mock-server.ts` — mock-first client and authorized publish.
- `connection-callback.ts` — injected provider, discovery, and account selection.
- `render-outcomes.ts` — exhaustive outcome rendering.
- `webhook-handler.ts` — verify, decode, accept, and quarantine.
- `integration.test.ts` — deterministic mixed-outcome coverage.

## Completion criteria

An integration is ready for review when it uses a real provider callback implementation, enforces tenant membership before dispatch, persists the required state durably, renders independent outcomes, acknowledges webhooks only after inbox acceptance, and has tests for replay, duplicates, partial results, and quarantine.
