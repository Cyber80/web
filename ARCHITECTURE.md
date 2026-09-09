# 🏫 School Core System - Architecture & Developer Guide

## System Overview
This project is a multi-tenant modular monolith designed to run on Cloudflare Workers with Cloudflare D1 (SQLite database) and Cloudflare R2 (file storage).

## Tech Stack
- **Framework:** Hono.js
- **Database:** Cloudflare D1 with Drizzle ORM
- **Storage:** Cloudflare R2 Bucket
- **Authentication:** Google OAuth + JWT (RBAC: GUEST, STUDENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)

## Directory Layout
```text
.
├── .gemini/rules               # AI Agent constraints & rules
├── .github/workflows/deploy.yml # GitHub Actions CI/CD to Cloudflare
├── wrangler.toml               # Cloudflare Workers configuration
├── drizzle.config.ts           # Drizzle D1 migration settings
├── src/
│   ├── db/schema.ts            # D1 Database Schema
│   ├── core/
│   │   ├── types.ts            # Shared TypeScript Interfaces
│   │   ├── auth.ts             # Auth Middleware & Role Guards
│   │   └── sharing-engine.ts   # Unified Data Sharing Engine
│   ├── modules/
│   │   ├── orders/             # คลังคำสั่ง & ประกาศ
│   │   ├── certificates/       # คลังเกียรติบัตร
│   │   └── scholarships/       # ทุนการศึกษา
│   └── index.ts                # Main App & Router Gateway
```

## Data Sharing Mechanism
All modules register public or internal resources into `sharedResources` table via `UnifiedSharingEngine`. Access control enforces:
1. `PUBLIC`: Accessible by all users including Guests.
2. `SCHOOL_INTERNAL`: Accessible only by authenticated users belonging to the same `schoolId`.
3. `SHARED_NETWORK`: Accessible by explicitly authorized school partners.
