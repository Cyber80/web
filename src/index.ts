import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './core/auth';
import { authRouter } from './core/google-auth';
import { orderModule } from './modules/orders';
import { certificateModule } from './modules/certificates';
import { scholarshipModule } from './modules/scholarships';
import { documentModule } from './modules/documents';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Security Middlewares
app.use('*', cors());
app.use('*', (c, next) => authMiddleware(c.env?.JWT_SECRET || 'fallback-secret-key')(c, next));

// Healthcheck
app.get('/', (c) => c.json({ 
  status: 'ok', 
  service: 'School Core API System', 
  timestamp: new Date().toISOString() 
}));

// Auth Route
app.route('/api/v1/auth', authRouter);

// 🚀 Mount Sub-modules ไร้รอยต่อ
app.route('/api/v1/orders', orderModule);
app.route('/api/v1/certificates', certificateModule);
app.route('/api/v1/scholarships', scholarshipModule);
app.route('/api/v1/documents', documentModule);

export default app;
