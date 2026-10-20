import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    employeeCode: text("employee_code"),
    role: text("role", { enum: ["supervisor", "attendant"] })
      .notNull()
      .default("attendant"),
    registrationComplete: integer("registration_complete", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const typologies = sqliteTable(
  "typologies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    seconds: integer("seconds").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [uniqueIndex("typologies_name_unique").on(table.name)],
);

export const activities = sqliteTable(
  "activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    kind: text("kind", { enum: ["protocol", "call"] }).notNull(),
    protocol: text("protocol"),
    outcome: text("outcome", { enum: ["deferred", "analysis", "denied"] }),
    typologyId: integer("typology_id").notNull(),
    typologyName: text("typology_name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    durationSeconds: integer("duration_seconds").notNull(),
    occurredAt: text("occurred_at").notNull(),
    backofficeUrl: text("backoffice_url"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("activities_user_email_idx").on(table.userEmail),
    index("activities_occurred_at_idx").on(table.occurredAt),
    index("activities_kind_idx").on(table.kind),
  ],
);
