from pathlib import Path
from datetime import datetime
import shutil

p = Path("lib/db/schema.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy2(
    p,
    Path(str(p) + f".bak_month_lock_{stamp}")
)

if "export const adminMonthLocks" not in s:

    block = r'''

/* ========================================
   관리자 월 마감
======================================== */

export const adminMonthLocks = pgTable(
  "admin_month_locks",
  {
    id: serial("id").primaryKey(),

    month: date("month")
      .notNull()
      .unique(),

    isLocked: boolean("is_locked")
      .notNull()
      .default(false),

    lockedAt: timestamp(
      "locked_at",
      {
        withTimezone: true,
      }
    ),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),
  }
);
'''

    s += block

p.write_text(s, encoding="utf-8")

print("schema adminMonthLocks 추가 완료")
