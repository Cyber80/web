import { Context, Next } from 'hono';
import { AuthUser, UserRole } from './types';

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export const authMiddleware = (JWT_SECRET: string) => {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // ผู้ใช้งานที่ไม่ได้ Login -> ถือเป็น GUEST ดูได้เฉพาะข้อมูลสาธารณะ
      c.set('user', { id: 'guest', email: '', name: 'Guest User', role: 'GUEST' });
      return await next();
    }

    try {
      // ตัวอย่างจำลองการตรวจ JWT Token (สำหรับใช้จริงสามารถเปิดใช้ JWT Verification)
      const token = authHeader.split(' ')[1];
      // สมมติว่าถอด Token ออกมาได้ User payload
      const dummyUser: AuthUser = {
        id: 'usr-001',
        email: 'teacher@school.ac.th',
        name: 'ครูสมชาย ใจดี',
        role: 'TEACHER',
        schoolId: 'sch-001'
      };
      c.set('user', dummyUser);
    } catch (err) {
      c.set('user', { id: 'guest', email: '', name: 'Guest User', role: 'GUEST' });
    }

    await next();
  };
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!allowedRoles.includes(user.role) && !allowedRoles.includes('GUEST')) {
      return c.json({ error: 'Forbidden', message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' }, 403);
    }
    await next();
  };
};
