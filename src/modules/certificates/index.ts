import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { UnifiedSharingEngine } from '../../core/sharing-engine';
import { requireRole } from '../../core/auth';
import { VisibilityScope } from '../../core/types';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

export const certificateModule = new Hono<{ Bindings: Bindings }>();

// 1. Dashboard คลังเกียรติบัตร
certificateModule.get('/dashboard', requireRole(['STUDENT', 'TEACHER', 'SCHOOL_ADMIN']), async (c) => {
  return c.json({
    totalCertificatesIssued: 150,
    categories: ['วิชาการ', 'กีฬา', 'คุณธรรม'],
    recentIssuedYear: '2567'
  });
});

// 2. ออกเกียรติบัตรใหม่และลงทะเบียนในคลังเกียรติบัตรกลาง
certificateModule.post('/', requireRole(['TEACHER', 'SCHOOL_ADMIN']), async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const sharingEngine = new UnifiedSharingEngine(db);

  const body = await c.req.parseBody();
  const title = body['title'] as string;
  const studentName = body['studentName'] as string;
  const visibility = (body['visibility'] as VisibilityScope) || 'PUBLIC'; // เกียรติบัตรส่วนใหญ่เปิดสาธารณะเพื่อตรวจสอบได้

  const certId = crypto.randomUUID();
  const shareId = await sharingEngine.registerShare({
    ownerSchoolId: user.schoolId || 'main-school',
    createdByUserId: user.id,
    moduleType: 'CERTIFICATE',
    resourceId: certId,
    title: `เกียรติบัตร: ${title} (${studentName})`,
    visibility: visibility,
    tags: ['เกียรติบัตร', studentName]
  });

  return c.json({ success: true, certId, shareId });
});

// 3. ค้นหาเกียรติบัตร
certificateModule.get('/search', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const sharingEngine = new UnifiedSharingEngine(db);

  const results = await sharingEngine.searchSharedResources(user, { moduleType: 'CERTIFICATE' });
  return c.json({ results });
});
