import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  date,
  timestamp,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

/* ========================================
   플랫폼 마스터
======================================== */

export const platforms = pgTable(
  "platforms",
  {
    id: serial("id").primaryKey(),

    name: text("name").notNull(),

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    isActive: boolean("is_active")
      .notNull()
      .default(true),

    includeInTotal: boolean("include_in_total")
      .notNull()
      .default(true),

    includeInChannelChart: boolean(
      "include_in_channel_chart"
    )
      .notNull()
      .default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    nameUnique: uniqueIndex(
      "platforms_name_uq"
    ).on(table.name),
  })
);

/* ========================================
   실장 마스터
======================================== */

export const managers = pgTable(
  "managers",
  {
    id: serial("id").primaryKey(),

    name: text("name").notNull(),

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    isActive: boolean("is_active")
      .notNull()
      .default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    nameUnique: uniqueIndex(
      "managers_name_uq"
    ).on(table.name),
  })
);

/* ========================================
   월간 플랫폼 실적
======================================== */

export const monthlyPlatformStats = pgTable(
  "monthly_platform_stats_v2",
  {
    id: serial("id").primaryKey(),

    month: date("month").notNull(),

    platformId: integer("platform_id")
      .notNull()
      .references(() => platforms.id),

    applications: integer("applications")
      .notNull()
      .default(0),

    reservations: integer("reservations")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    monthPlatformUnique: uniqueIndex(
      "monthly_platform_stats_v2_month_platform_uq"
    ).on(
      table.month,
      table.platformId
    ),
  })
);

/* ========================================
   월간 전체 상담 / 수술
======================================== */

export const monthlyConversionStats = pgTable(
  "monthly_conversion_stats",
  {
    id: serial("id").primaryKey(),

    month: date("month").notNull(),

    consultations: integer("consultations")
      .notNull()
      .default(0),

    surgeries: integer("surgeries")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    monthUnique: uniqueIndex(
      "monthly_conversion_month_uq"
    ).on(table.month),
  })
);

/* ========================================
   실장 월간 실적
======================================== */

export const managerPerformance = pgTable(
  "manager_performance_v2",
  {
    id: serial("id").primaryKey(),

    month: date("month").notNull(),

    managerId: integer("manager_id")
      .notNull()
      .references(() => managers.id),

    consultations: integer("consultations")
      .notNull()
      .default(0),

    surgeries: integer("surgeries")
      .notNull()
      .default(0),

    revenue: bigint("revenue", {
      mode: "number",
    })
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    monthManagerUnique: uniqueIndex(
      "manager_performance_v2_month_manager_uq"
    ).on(
      table.month,
      table.managerId
    ),
  })
);

/* ========================================
   일별 플랫폼 실적
======================================== */

export const dailyPlatformStats = pgTable(
  "daily_platform_stats",
  {
    id: serial("id").primaryKey(),

    date: date("date").notNull(),

    platformId: integer("platform_id")
      .notNull()
      .references(() => platforms.id),

    applications: integer("applications")
      .notNull()
      .default(0),

    reservations: integer("reservations")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    datePlatformUnique: uniqueIndex(
      "daily_platform_stats_date_platform_uq"
    ).on(
      table.date,
      table.platformId
    ),
  })
);

/* ========================================
   일별 상담 / 수술
   현재는 확장용.
======================================== */

export const dailyConversionStats = pgTable(
  "daily_conversion_stats",
  {
    id: serial("id").primaryKey(),

    date: date("date").notNull(),

    consultations: integer("consultations")
      .notNull()
      .default(0),

    surgeries: integer("surgeries")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    dateUnique: uniqueIndex(
      "daily_conversion_stats_date_uq"
    ).on(table.date),
  })
);

/* ========================================
   일일 보고 원문
======================================== */

export const dailyReports = pgTable(
  "daily_reports",
  {
    id: serial("id").primaryKey(),

    date: date("date").notNull(),

    rawText: text("raw_text")
      .notNull()
      .default(""),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    dateUnique: uniqueIndex(
      "daily_reports_date_uq"
    ).on(table.date),
  })
);


/* ========================================
   전날콜 / 7콜
======================================== */

export const dailyCallStats = pgTable(
  "daily_call_stats",
  {
    id: serial("id").primaryKey(),

    date: date("date").notNull(),

    previousTotal: integer(
      "previous_total"
    )
      .notNull()
      .default(0),

    previousDetails: jsonb(
      "previous_details"
    )
      .$type<Record<string, number>>()
      .notNull()
      .default({}),

    sevenTotal: integer(
      "seven_total"
    )
      .notNull()
      .default(0),

    sevenDetails: jsonb(
      "seven_details"
    )
      .$type<Record<string, number>>()
      .notNull()
      .default({}),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    dateUnique: uniqueIndex(
      "daily_call_stats_date_uq"
    ).on(table.date),
  })
);


/* ========================================
   내원경로
======================================== */

export const dailyVisitSources = pgTable(
  "daily_visit_sources",
  {
    id: serial("id").primaryKey(),

    date: date("date").notNull(),

    source: text("source")
      .notNull(),

    count: integer("count")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    dateSourceUnique: uniqueIndex(
      "daily_visit_sources_date_source_uq"
    ).on(
      table.date,
      table.source
    ),
  })
);


/* ========================================
   총인콜
======================================== */

export const dailyIncallStats = pgTable(
  "daily_incall_stats",
  {
    id: serial("id").primaryKey(),

    date: date("date").notNull(),

    total: integer("total")
      .notNull()
      .default(0),

    newCount: integer("new_count")
      .notNull()
      .default(0),

    simpleCount: integer(
      "simple_count"
    )
      .notNull()
      .default(0),

    changedCount: integer(
      "changed_count"
    )
      .notNull()
      .default(0),

    canceledCount: integer(
      "canceled_count"
    )
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    dateUnique: uniqueIndex(
      "daily_incall_stats_date_uq"
    ).on(table.date),
  })
);


/* ========================================
   당일취소 상세
======================================== */

export const dailyCancellations = pgTable(
  "daily_cancellations",
  {
    id: serial("id").primaryKey(),

    date: date("date").notNull(),

    patientText: text(
      "patient_text"
    )
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  }
);



