import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { UnifiedSharingEngine } from '../../core/sharing-engine';
import { requireRole } from '../../core/auth';
import { VisibilityScope } from '../../core/types';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

export const documentModule = new Hono<{ Bindings: Bindings }>();

// 1. Dashboard คลังเอกสาร
documentModule.get('/dashboard', requireRole(['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), async (c) => {
  return c.json({
    totalDocuments: 89,
    categories: ['แผนการสอน', 'เอกสารหลักสูตร', 'รายงานการประชุม', 'คู่มือครู'],
    recentUploads: 5
  });
});

// 2. อัปโหลดเอกสารใหม่เข้าคลังเอกสาร
documentModule.post('/', requireRole(['TEACHER', 'SCHOOL_ADMIN']), async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const sharingEngine = new UnifiedSharingEngine(db);

  const body = await c.req.parseBody();
  const title = body['title'] as string;
  const description = body['description'] as string || '';
  const visibility = (body['visibility'] as VisibilityScope) || 'SCHOOL_INTERNAL';
  const file = body['file'] as File;

  let r2Key: string | undefined = undefined;

  // จัดเก็บไฟล์ใน R2 Storage Under `documents/` folder
  if (file && c.env.BUCKET) {
    r2Key = `documents/${Date.now()}-${file.name}`;
    await c.env.BUCKET.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });
  }

  const docId = crypto.randomUUID();
  const shareId = await sharingEngine.registerShare({
    ownerSchoolId: user.schoolId || 'main-school',
    createdByUserId: user.id,
    moduleType: 'DOCUMENT',
    resourceId: docId,
    title: title,
    description: description,
    fileR2Key: r2Key,
    visibility: visibility,
    tags: ['คลังเอกสาร', 'เอกสารวิชาการ']
  });

  return c.json({ success: true, docId, shareId, r2Key });
});

// 3. ค้นหาเอกสารมืออาชีพผ่านระบบแชร์กลาง
documentModule.get('/search', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const sharingEngine = new UnifiedSharingEngine(db);

  const results = await sharingEngine.searchSharedResources(user, { moduleType: 'DOCUMENT' });
  return c.json({ results });
});
