import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { lookupCompanyByICO, validateICO } from '../services/ares';

export const integrationRoutes = new Hono();

// All routes require authentication
integrationRoutes.use('*', requireAuth);

// GET /api/v1/integrations/ares/:ico - Look up company by IČO
integrationRoutes.get('/ares/:ico', async (c) => {
  const ico = c.req.param('ico');

  try {
    // Validate IČO format and checksum
    if (!validateICO(ico)) {
      return c.json(
        { error: { code: 'INVALID_ICO', message: 'Invalid IČO format or checksum' } },
        400
      );
    }

    // Lookup company in ARES
    const companyData = await lookupCompanyByICO(ico);

    if (!companyData) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Company not found in ARES registry' } },
        404
      );
    }

    // Check if company is active
    if (!companyData.is_active) {
      return c.json(
        {
          data: companyData,
          warning: {
            code: 'INACTIVE_COMPANY',
            message: 'Company is not active in registry',
          },
        },
        200
      );
    }

    return c.json({ data: companyData });
  } catch (error) {
    console.error('ARES lookup error:', error);
    return c.json(
      {
        error: {
          code: 'ARES_ERROR',
          message: error instanceof Error ? error.message : 'Failed to lookup company',
        },
      },
      500
    );
  }
});
