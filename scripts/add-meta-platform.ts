import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { db } from "../lib/db";
import { platforms } from "../lib/db/schema";

async function main() {
  await db
    .insert(platforms)
    .values({
      name: "메타",
      sortOrder: 8,
      isActive: true,
      includeInTotal: true,
      includeInChannelChart: true,
    })
    .onConflictDoUpdate({
      target: platforms.name,

      set: {
        isActive: true,
        includeInTotal: true,
        includeInChannelChart: true,
        updatedAt: new Date(),
      },
    });

  console.log("✅ 메타 플랫폼 추가 완료");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});