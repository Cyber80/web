import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { UnifiedSharingEngine } from '../../core/sharing-engine';
import { requireRole } from '../../core/auth';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

export const scholarshipModule = new Hono<{ Bindings: Bindings }>();

// 1. Dashboard ทุนการศึกษา
scholarshipModule.get('/dashboard', requireRole(['STUDENT', 'TEACHER', 'SCHOOL_ADMIN']), async (c) => {
  return c.json({
    totalScholarships: 12,
    totalFundingAmount: 500000,
    academicYear: '2567',
    term: '1/2567'
  });
});

// 2. ค้นหาทุนการศึกษา
scholarshipModule.get('/search', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const sharingEngine = new UnifiedSharingEngine(db);

  const results = await sharingEngine.searchSharedResources(user, { moduleType: 'SCHOLARSHIP' });
  return c.json({ results });
});
