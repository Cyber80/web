import { drizzle } from 'drizzle-orm/d1';
import { sharedResources, resourceAccessList } from '../db/schema';
import { eq, or, and } from 'drizzle-orm';
import { AuthUser, RegisterShareInput, ModuleType } from './types';

export class UnifiedSharingEngine {
  constructor(private db: ReturnType<typeof drizzle>) {}

  // 1. ลงทะเบียนข้อมูลเข้าสู่ระบบแชร์กลาง
  async registerShare(input: RegisterShareInput) {
    const shareId = input.id || crypto.randomUUID();

    await this.db.insert(sharedResources).values({
      id: shareId,
      ownerSchoolId: input.ownerSchoolId,
      createdByUserId: input.createdByUserId,
      moduleType: input.moduleType,
      resourceId: input.resourceId,
      title: input.title,
      description: input.description,
      fileR2Key: input.fileR2Key,
      visibility: input.visibility,
      tags: JSON.stringify(input.tags || [])
    }).run();

    if (input.visibility === 'SHARED_NETWORK' && input.targetSchoolIds?.length) {
      const accessEntries = input.targetSchoolIds.map(schoolId => ({
        resourceId: shareId,
        targetSchoolId: schoolId
      }));
      await this.db.insert(resourceAccessList).values(accessEntries).run();
    }

    return shareId;
  }

  // 2. ระบบสืบค้นข้อมูลแชร์กลาง พร้อมระบบกรองสิทธิ์ตามสิทธิ์ User อัตโนมัติ
  async searchSharedResources(user: AuthUser, filter: {
    moduleType?: ModuleType;
    query?: string;
  }) {
    // กฎสิทธิ์การมองเห็น:
    // 1. PUBLIC -> ทุกคนเห็นได้หมด
    // 2. SCHOOL_INTERNAL -> คนในโรงเรียนเดียวกันเท่านั้น
    const conditions = [eq(sharedResources.visibility, 'PUBLIC')];

    if (user.role !== 'GUEST' && user.schoolId) {
      conditions.push(
        and(
          eq(sharedResources.visibility, 'SCHOOL_INTERNAL'),
          eq(sharedResources.ownerSchoolId, user.schoolId)
        )!
      );
    }

    let baseQuery = this.db.select()
      .from(sharedResources)
      .where(or(...conditions));

    return await baseQuery.all();
  }
}
