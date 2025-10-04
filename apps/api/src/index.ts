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
  userEmail: string;
  userRole: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://*.pages.dev', 'https://lexai.pages.dev'],
  credentials: true,
  allowHeaders: ['Content-Type', 'CF-Access-JWT-Assertion'],
  exposeHeaders: ['CF-Access-JWT-Assertion'],
}));

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.get('/api/v1', (c) => {
  return c.json({ message: 'LexAI API v1' });
});

// Auth routes
import { authRoutes } from './routes/auth';
app.route('/api/v1/auth', authRoutes);

// Dashboard routes (protected)
import { dashboardRoutes } from './routes/dashboard';
app.route('/api/v1/dashboard', dashboardRoutes);

// Client routes (protected)
import { clientRoutes } from './routes/clients';
app.route('/api/v1/clients', clientRoutes);

// Debt routes (protected)
import { debtRoutes } from './routes/debts';
app.route('/api/v1/debts', debtRoutes);

// Debtor routes (protected)
import { debtorRoutes } from './routes/debtors';
app.route('/api/v1/debtors', debtorRoutes);

// Integration routes (protected)
import { integrationRoutes } from './routes/integrations';
app.route('/api/v1/integrations', integrationRoutes);

// Notification routes (protected)
import { notificationRoutes } from './routes/notifications';
app.route('/api/v1/notifications', notificationRoutes);

// Portal routes (public - no auth required)
import { portalRoutes } from './routes/portal';
app.route('/api/v1/portal', portalRoutes);

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
