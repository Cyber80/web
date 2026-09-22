import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { drizzle } from 'drizzle-orm/d1';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AuthUser } from './types';

type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
};

export const authRouter = new Hono<{ Bindings: Bindings }>();

// 1. Google OAuth Callback Endpoint
authRouter.post('/google/callback', async (c) => {
  const { idToken } = await c.req.json<{ idToken: string }>();

  if (!idToken) {
    return c.json({ error: 'BadRequest', message: 'Missing Google ID Token' }, 400);
  }

  try {
    // 1.1 Verify Google ID Token (Google OAuth Token Info endpoint)
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!googleRes.ok) {
      return c.json({ error: 'Unauthorized', message: 'Invalid Google Token' }, 401);
    }

    const payload = await googleRes.json() as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };

    const db = drizzle(c.env.DB);

    // 1.2 สืบค้นผู้ใช้งานเดิม หรือสร้างผู้ใช้งานใหม่ใน D1 Database
    let existingUser = await db.select().from(users).where(eq(users.googleId, payload.sub)).get();

    if (!existingUser) {
      const userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        role: 'TEACHER', // Default role ให้สำหรับตัวอย่าง
        schoolId: 'sch-001' // Default school
      }).run();

      existingUser = {
        id: userId,
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        role: 'TEACHER',
        schoolId: 'sch-001',
        createdAt: new Date().toISOString()
      };
    }

    // 1.3 ออก JWT Signed Token
    const jwtPayload: AuthUser = {
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      role: existingUser.role as any,
      schoolId: existingUser.schoolId || undefined
    };

    const token = await sign(jwtPayload, c.env.JWT_SECRET || 'fallback-secret-key');

    return c.json({
      success: true,
      token,
      user: jwtPayload
    });

  } catch (error: any) {
    return c.json({ error: 'InternalServerError', message: error.message }, 500);
  }
});

// 2. Profile endpoint ดึงข้อมูลผู้ใช้งานปัจจุบัน
authRouter.get('/me', async (c) => {
  const user = c.get('user');
  return c.json({ user });
});
