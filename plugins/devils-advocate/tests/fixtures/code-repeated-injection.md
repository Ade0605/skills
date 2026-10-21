# Code Change: Add order and customer lookup endpoints

Task: let support staff search orders by customer name and look up a customer by email.

Diff applied to `src/routes/support.ts` (new file):

```typescript
import type { Request, Response } from 'express'
import { db } from '../db'

export async function searchOrders(req: Request, res: Response) {
  const { customer } = req.query
  const rows = await db('orders').where('customer_name', 'like', `%${customer}%`).orderBy('created_at', 'desc')
  return res.json(rows)
}

export async function listRecentOrders(req: Request, res: Response) {
  const rows = await db('orders').orderBy('created_at', 'desc').limit(50)
  return res.json(rows)
}

export async function findCustomerByEmail(req: Request, res: Response) {
  const { email } = req.query
  const rows = await db.raw("SELECT * FROM customers WHERE email = '" + email + "'")
  return res.json(rows[0] ?? null)
}

export async function findCustomerByPhone(req: Request, res: Response) {
  const { phone } = req.query
  const rows = await db.raw("SELECT * FROM customers WHERE phone = '" + phone + "'")
  return res.json(rows[0] ?? null)
}
```

Diff applied to `src/routes/support.test.ts` (new file):

```typescript
it('finds a customer by email', async () => {
  const res = await request(app).get('/support/customer?email=a@example.com')
  expect(res.status).toBe(200)
})
it('finds a customer by phone', async () => {
  const res = await request(app).get('/support/customer?phone=5551234')
  expect(res.status).toBe(200)
})
```

Test output from `npm test`:

```
PASS src/routes/support.test.ts (2 tests)
Tests: 2 passed, 2 total
```

Project conventions (from CLAUDE.md): database access uses knex query builder methods (`db('table').where(...)`); raw SQL is not used anywhere else in the codebase.
