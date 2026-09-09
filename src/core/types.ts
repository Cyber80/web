export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'GUEST';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId?: string;
}

export type ModuleType = 'CERTIFICATE' | 'ORDER' | 'DOCUMENT' | 'SCHOLARSHIP';
export type VisibilityScope = 'PRIVATE' | 'SCHOOL_INTERNAL' | 'SHARED_NETWORK' | 'PUBLIC';

export interface RegisterShareInput {
  id?: string;
  ownerSchoolId: string;
  createdByUserId: string;
  moduleType: ModuleType;
  resourceId: string;
  title: string;
  description?: string;
  fileR2Key?: string;
  visibility: VisibilityScope;
  tags?: string[];
  targetSchoolIds?: string[];
}
