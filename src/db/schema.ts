import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 🏫 1. Core: โรงเรียน (Schools / Tenants)
export const schools = sqliteTable('schools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  address: text('address'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

// 👤 2. Core: ผู้ใช้งาน (Users)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id),
  googleId: text('google_id').unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'GUEST'] }).notNull().default('GUEST'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

// 🌐 3. Unified Data Sharing Engine Table (ตารางแชร์ข้อมูลกลาง)
export const sharedResources = sqliteTable('shared_resources', {
  id: text('id').primaryKey(), // UUID v4
  ownerSchoolId: text('owner_school_id').notNull().references(() => schools.id),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
  
  // ชนิดของโมดูลเจ้าของข้อมูล
  moduleType: text('module_type', { 
    enum: ['CERTIFICATE', 'ORDER', 'DOCUMENT', 'SCHOLARSHIP'] 
  }).notNull(),
  
  resourceId: text('resource_id').notNull(), // ID ของข้อมูลในโมดูลนั้นๆ
  title: text('title').notNull(),
  description: text('description'),
  fileR2Key: text('file_r2_key'), // Key สำหรับดึงไฟล์จาก R2 Bucket
  
  // ระดับการแชร์ข้อมูล
  visibility: text('visibility', { 
    enum: [
      'PRIVATE',          // ดูได้เฉพาะผู้สร้าง
      'SCHOOL_INTERNAL',  // ดูได้เฉพาะคนในโรงเรียนเดียวกัน
      'SHARED_NETWORK',   // แชร์ให้โรงเรียนพันธมิตรที่ระบุไว้
      'PUBLIC'            // สาธารณะ ทุกคนดูได้
    ] 
  }).notNull().default('SCHOOL_INTERNAL'),
  
  tags: text('tags'), // JSON array string e.g. ["ปี2567", "คำสั่งแต่งตั้ง"]
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

// 🔗 4. Network Sharing Permission (การสิทธิ์แชร์เฉพาะโรงเรียน)
export const resourceAccessList = sqliteTable('resource_access_list', {
  resourceId: text('resource_id').notNull().references(() => sharedResources.id),
  targetSchoolId: text('target_school_id').notNull().references(() => schools.id),
  grantedAt: text('granted_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  pk: primaryKey({ columns: [table.resourceId, table.targetSchoolId] }),
}));
