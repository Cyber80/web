import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { UnifiedSharingEngine } from '../../core/sharing-engine';
import { requireRole } from '../../core/auth';
import { VisibilityScope } from '../../core/types';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

export const orderModule = new Hono<{ Bindings: Bindings }>();

// 1. Dashboard สถิติคำสั่งและประกาศ
orderModule.get('/dashboard', requireRole(['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), async (c) => {
  return c.json({
    totalOrders: 24,
    pendingSignatures: 2,
    categories: ['คำสั่งย้าย', 'ประกาศหยุดเรียน', 'คำสั่งแต่งตั้ง']
  });
});

// 2. อัปโหลดคำสั่งใหม่พร้อมแชร์ข้อมูลเข้า Sharing Engine
orderModule.post('/', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const sharingEngine = new UnifiedSharingEngine(db);

  const body = await c.req.parseBody();
  const title = body['title'] as string;
  const visibility = (body['visibility'] as VisibilityScope) || 'SCHOOL_INTERNAL';
  const file = body['file'] as File;

  let r2Key: string | undefined = undefined;

  // บันทึกไฟล์ลง R2 Bucket (ถ้ามี)
  if (file && c.env.BUCKET) {
    r2Key = `orders/${Date.now()}-${file.name}`;
    await c.env.BUCKET.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });
  }

  const orderId = crypto.randomUUID();
  const shareId = await sharingEngine.registerShare({
    ownerSchoolId: user.schoolId || 'main-school',
    createdByUserId: user.id,
    moduleType: 'ORDER',
    resourceId: orderId,
    title: title,
    fileR2Key: r2Key,
    visibility: visibility,
    tags: ['คลังคำสั่ง', 'ประกาศ']
  });

  return c.json({ success: true, orderId, shareId, r2Key });
});

// 3. ค้นหาคลังคำสั่งมืออาชีพ
orderModule.get('/search', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const sharingEngine = new UnifiedSharingEngine(db);

  const results = await sharingEngine.searchSharedResources(user, { moduleType: 'ORDER' });
  return c.json({ results });
});
