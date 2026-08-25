import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { db } from "../lib/db";
import { platforms } from "../lib/db/schema";

const defaultPlatforms = [
  {
    name: "바비톡",
    sortOrder: 1,
    includeInTotal: true,
    includeInChannelChart: true,
  },
  {
    name: "강남언니",
    sortOrder: 2,
    includeInTotal: true,
    includeInChannelChart: true,
  },
  {
    name: "네이버",
    sortOrder: 3,
    includeInTotal: true,
    includeInChannelChart: true,
  },
  {
    name: "플러스친구",
    sortOrder: 4,
    includeInTotal: true,
    includeInChannelChart: true,
  },
  {
    name: "홈페이지",
    sortOrder: 5,
    includeInTotal: true,
    includeInChannelChart: true,
  },

  // 전체 KPI에는 포함하지만
  // 마케팅 채널 그래프에서는 제외
  {
    name: "인콜",
    sortOrder: 6,
    includeInTotal: true,
    includeInChannelChart: false,
  },

  {
    name: "CPA",
    sortOrder: 7,
    includeInTotal: true,
    includeInChannelChart: true,
  },
];

async function main() {
  for (const platform of defaultPlatforms) {
    await db
      .insert(platforms)
      .values(platform)
      .onConflictDoUpdate({
        target: platforms.name,

        set: {
          sortOrder: platform.sortOrder,

          includeInTotal:
            platform.includeInTotal,

          includeInChannelChart:
            platform.includeInChannelChart,

          updatedAt: new Date(),
        },
      });
  }

  console.log("✅ 플랫폼 기본 데이터 생성 완료");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});