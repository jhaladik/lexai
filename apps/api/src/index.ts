import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Types
type Bindings = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  SMTP2GO_API_KEY: string;
  OPENAI_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  JWT_SECRET: string;
};

type Variables = {
  userId: string;
  tenantId: string;
  userRole: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://*.pages.dev', 'https://*.lexai.app'],
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes (will be added incrementally)
app.get('/api/v1', (c) => {
  return c.json({ message: 'LexAI API v1' });
});

// Auth routes
import { authRoutes } from './routes/auth';
app.route('/api/v1/auth', authRoutes);

// Client routes
import { clientRoutes } from './routes/clients';
app.route('/api/v1/clients', clientRoutes);

// Debt routes
import { debtRoutes } from './routes/debts';
app.route('/api/v1/debts', debtRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  }, 500);
});

// Cron handler
export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    switch (event.cron) {
      case '0 6 * * *':
        console.log('Running: Send payment reminders');
        // TODO: Implement
        break;
      case '0 7 * * *':
        console.log('Running: Process auto charges');
        // TODO: Implement
        break;
      case '0 8 * * *':
        console.log('Running: Check overdue installments');
        // TODO: Implement
        break;
      case '0 9 * * *':
        console.log('Running: Trigger accelerations');
        // TODO: Implement
        break;
      case '0 10 * * *':
        console.log('Running: Check deadlines');
        // TODO: Implement
        break;
    }
  },
};
