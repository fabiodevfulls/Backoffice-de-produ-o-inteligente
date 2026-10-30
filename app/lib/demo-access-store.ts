import type { DemoAccessRecord } from "./demo-access";

type DemoAccessDatabase = Pick<D1Database, "batch" | "prepare">;

export async function replaceDemoAccess(db: DemoAccessDatabase, record: DemoAccessRecord) {
  await db.batch([
    db.prepare("UPDATE demo_access SET revoked_at = ? WHERE revoked_at IS NULL").bind(record.createdAt),
    db.prepare("UPDATE users SET active = 0 WHERE is_demo = 1"),
    db.prepare(`INSERT INTO users
      (email, name, employee_code, role, registration_complete, password_hash, password_salt, active, created_at, is_demo)
      VALUES (?, 'Acesso de demonstração', 'DEMO', 'attendant', 1, NULL, NULL, 1, ?, 1)`)
      .bind(record.email, record.createdAt),
    db.prepare(`INSERT INTO demo_access
      (id, user_email, token_hash, created_by, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(record.id, record.email, record.tokenHash, record.createdBy, record.createdAt, record.expiresAt),
  ]);
}

export async function findDemoAccess(db: DemoAccessDatabase, tokenHash: string, checkedAt: string) {
  return db.prepare(`SELECT user_email AS email, expires_at AS expiresAt FROM demo_access
    WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`)
    .bind(tokenHash, checkedAt)
    .first<{ email: string; expiresAt: string }>();
}
