import { Hono } from 'hono';

export const debtRoutes = new Hono();

// GET /api/v1/debts
debtRoutes.get('/', async (c) => {
  return c.json({ message: 'List debts - to be implemented' });
});

// POST /api/v1/debts
debtRoutes.post('/', async (c) => {
  return c.json({ message: 'Create debt - to be implemented' });
});

// GET /api/v1/debts/:id
debtRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  return c.json({ message: `Get debt ${id} - to be implemented` });
});

// POST /api/v1/debts/bulk-upload
debtRoutes.post('/bulk-upload', async (c) => {
  return c.json({ message: 'Bulk upload debts - to be implemented' });
});

// GET /api/v1/debts/bulk-template
debtRoutes.get('/bulk-template', async (c) => {
  return c.json({ message: 'Download bulk template - to be implemented' });
});
