import {
  NextRequest,
  NextResponse,
} from "next/server";

export const dynamic =
  "force-dynamic";

type PlatformRow = {
  platform: string;
  applications: number;
  reservations: number;
  raw: string;
};

type CallStats = {
  total: number;
  details: Record<string, number>;
  raw: string;
};

type VisitSource = {
  source: string;
  count: number;
};

type IncallStats = {
  total: number;
  newCount: number;
  simpleCount: number;
  changedCount: number;
  canceledCount: number;
};

type WarningRow = {
  line: string;
  reason: string;
};

type ParsedDay = {
  date: string;

  rawText: string;

  platforms: PlatformRow[];

  previousCall: CallStats;
  sevenCall: CallStats;

  visitSources: VisitSource[];

  incall: IncallStats;

  cancellations: string[];

  warnings: WarningRow[];
};

function makeDate(
  year: number,
  month: number,
  day: number
) {
  return `${year}-${String(
    month
  ).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}

function normalizePlatformName(
  line: string
) {
  const name = line
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (
    name.startsWith(
      "바비톡"
    )
  ) {
    return "바비톡";
  }

  if (
    name.startsWith(
      "강남언니"
    ) ||
    name.startsWith(
      "강언"
    )
  ) {
    return "강남언니";
  }

  if (
    name.startsWith(
      "네이버"
    )
  ) {
    return "네이버";
  }

  if (
    name.startsWith(
      "홈페이지"
    )
  ) {
    return "홈페이지";
  }

  if (
    name.startsWith(
      "플친"
    ) ||
    name.startsWith(
      "플러스친구"
    ) ||
    name.startsWith(
      "기타("
    )
  ) {
    return "플러스친구";
  }

  if (
    name.startsWith("cpa")
  ) {
    return "CPA";
  }

  if (
    name.startsWith(
      "메타"
    ) ||
    name.startsWith(
      "meta"
    )
  ) {
    return "메타";
  }

  return null;
}

/*
  텔레그램 형식:
  홈페이지 1/4

  앞 = 예약
  뒤 = 신청
*/
function parsePlatformPairs(
  line: string
) {
  const matches =
    Array.from(
      line.matchAll(
        /(\d+)\s*\/\s*(\d+)/g
      )
    );

  if (
    matches.length === 0
  ) {
    return null;
  }

  let reservations = 0;
  let applications = 0;

  for (const match of matches) {
    reservations += Number(
      match[1]
    );

    applications += Number(
      match[2]
    );
  }

  return {
    applications,
    reservations,
  };
}

function emptyCallStats(): CallStats {
  return {
    total: 0,
    details: {},
    raw: "",
  };
}

/*
  전날콜 예시

  전날콜 총7/부1/국1/확5
  전날콜-총13/취소1/변경1/국제2/부2/확인7

  7콜 예시

  7콜 총2/확2
  7콜-총8/부3/확4/국1
*/
function parseCallLine(
  line: string
): CallStats {
  const result =
    emptyCallStats();

  result.raw = line;

  const body = line
    .replace(
      /^전날콜\s*[-:]?\s*/i,
      ""
    )
    .replace(
      /^7콜\s*[-:]?\s*/i,
      ""
    )
    .trim();

  if (
    /^x$/i.test(body)
  ) {
    return result;
  }

  const tokens = body
    .split("/")
    .map((token) =>
      token.trim()
    )
    .filter(Boolean);

  for (const token of tokens) {
    const match =
      token.match(
        /^([가-힣A-Za-z]+)\s*(\d+)$/
      );

    if (!match) {
      continue;
    }

    let label =
      match[1];

    const value =
      Number(match[2]);

    /*
      같은 뜻은 통일
    */

    if (
      label === "확인"
    ) {
      label = "확";
    }

    if (
      label === "국제"
    ) {
      label = "국";
    }

    if (
      label === "취소"
    ) {
      label = "취";
    }

    if (
      label === "변경"
    ) {
      label = "변";
    }

    if (
      label === "총"
    ) {
      result.total =
        value;
    } else {
      result.details[
        label
      ] =
        (result.details[
          label
        ] ?? 0) +
        value;
    }
  }

  return result;
}

function parseVisitSourceLine(
  line: string
) {
  /*
    인터넷검색-3
    어플4
    환자소개 2
    워크인(간판)2
  */

  let match =
    line.match(
      /^(.+?)\s*[-:]\s*(\d+)\s*$/
    );

  if (!match) {
    match =
      line.match(
        /^(.+?)\s+(\d+)\s*$/
      );
  }

  if (!match) {
    /*
      공백도 하이픈도 없는 경우
      유튜브2
      국제팀3
    */
    match =
      line.match(
        /^(.+?[^\d])(\d+)\s*$/
      );
  }

  if (!match) {
    return null;
  }

  const source =
    match[1]
      .trim()
      .replace(
        /[-:]$/,
        ""
      )
      .trim();

  const count =
    Number(match[2]);

  if (!source) {
    return null;
  }

  return {
    source,
    count,
  };
}

function parseIncallValue(
  line: string,
  labels: string[]
) {
  for (const label of labels) {
    const pattern =
      new RegExp(
        `^${label}\\s*[-:]?\\s*(\\d+)$`,
        "i"
      );

    const match =
      line.match(pattern);

    if (match) {
      return Number(
        match[1]
      );
    }
  }

  return null;
}

function splitIntoDateBlocks(
  text: string
) {
  const lines = text
    .replace(
      /\r\n/g,
      "\n"
    )
    .split("\n");

  const blocks: string[][] =
    [];

  let current:
    | string[]
    | null = null;

  for (const line of lines) {
    if (
      /^\s*\d{1,2}\/\d{1,2}\s*DB\s*보고내역/i.test(
        line
      )
    ) {
      if (current) {
        blocks.push(
          current
        );
      }

      current = [
        line,
      ];

      continue;
    }

    if (current) {
      current.push(
        line
      );
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

function parseOneBlock(
  blockLines: string[],
  year: number
): ParsedDay | null {
  const header =
    blockLines[0]?.trim();

  const dateMatch =
    header?.match(
      /^(\d{1,2})\/(\d{1,2})\s*DB\s*보고내역/i
    );

  if (!dateMatch) {
    return null;
  }

  const month =
    Number(dateMatch[1]);

  const day =
    Number(dateMatch[2]);

  const result: ParsedDay =
    {
      date: makeDate(
        year,
        month,
        day
      ),

      rawText:
        blockLines.join(
          "\n"
        ),

      platforms: [],

      previousCall:
        emptyCallStats(),

      sevenCall:
        emptyCallStats(),

      visitSources:
        [],

      incall: {
        total: 0,
        newCount: 0,
        simpleCount: 0,
        changedCount: 0,
        canceledCount: 0,
      },

      cancellations:
        [],

      warnings: [],
    };

  type Section =
    | "db"
    | "visit"
    | "incall"
    | "cancel"
    | "other";

  let section: Section =
    "db";

  for (
    let index = 1;
    index <
    blockLines.length;
    index++
  ) {
    const line =
      blockLines[index]
        ?.trim();

    if (!line) {
      continue;
    }

    /*
      섹션 전환
    */

    if (
      /^<\s*내원경로\s*>/i.test(
        line
      )
    ) {
      section = "visit";
      continue;
    }

    const incallHeader =
      line.match(
        /^<\s*총인콜\s*(\d+)?\s*>/i
      );

    if (
      incallHeader
    ) {
      section =
        "incall";

      if (
        incallHeader[1]
      ) {
        result.incall.total =
          Number(
            incallHeader[1]
          );
      }

      continue;
    }

    if (
      /^<\s*당취\s*>/i.test(
        line
      )
    ) {
      section =
        "cancel";

      continue;
    }

    if (
      /^전날콜/i.test(
        line
      )
    ) {
      result.previousCall =
        parseCallLine(
          line
        );

      section =
        "other";

      continue;
    }

    if (
      /^7콜/i.test(line)
    ) {
      result.sevenCall =
        parseCallLine(
          line
        );

      section =
        "other";

      continue;
    }

    /*
      DB 보고
    */

    if (
      section === "db"
    ) {
      const platform =
        normalizePlatformName(
          line
        );

      if (!platform) {
        continue;
      }

      const pair =
        parsePlatformPairs(
          line
        );

      if (!pair) {
        result.warnings.push({
          line,
          reason:
            "예약/신청 값이 한 숫자로만 적혀 있어 자동 저장하지 않았습니다.",
        });

        continue;
      }

      const existing =
        result.platforms.find(
          (row) =>
            row.platform ===
            platform
        );

      if (existing) {
        existing.applications +=
          pair.applications;

        existing.reservations +=
          pair.reservations;

        existing.raw +=
          ` | ${line}`;
      } else {
        result.platforms.push({
          platform,
          applications:
            pair.applications,
          reservations:
            pair.reservations,
          raw: line,
        });
      }

      continue;
    }

    /*
      내원경로
    */

    if (
      section ===
      "visit"
    ) {
      const parsed =
        parseVisitSourceLine(
          line
        );

      if (!parsed) {
        continue;
      }

      const existing =
        result.visitSources.find(
          (row) =>
            row.source ===
            parsed.source
        );

      if (existing) {
        existing.count +=
          parsed.count;
      } else {
        result.visitSources.push(
          parsed
        );
      }

      continue;
    }

    /*
      총인콜
    */

    if (
      section ===
      "incall"
    ) {
      const total =
        parseIncallValue(
          line,
          [
            "총",
            "총인콜",
          ]
        );

      if (
        total !== null
      ) {
        result.incall.total =
          total;

        continue;
      }

      const newCount =
        parseIncallValue(
          line,
          ["신규"]
        );

      if (
        newCount !==
        null
      ) {
        result.incall.newCount =
          newCount;

        continue;
      }

      const simple =
        parseIncallValue(
          line,
          ["단순"]
        );

      if (
        simple !== null
      ) {
        result.incall.simpleCount =
          simple;

        continue;
      }

      const changed =
        parseIncallValue(
          line,
          ["변경"]
        );

      if (
        changed !== null
      ) {
        result.incall.changedCount =
          changed;

        continue;
      }

      const canceled =
        parseIncallValue(
          line,
          [
            "취소",
            "당취",
          ]
        );

      if (
        canceled !==
        null
      ) {
        result.incall.canceledCount =
          canceled;

        continue;
      }

      continue;
    }

    /*
      당취
    */

    if (
      section ===
      "cancel"
    ) {
      if (
        /^x$/i.test(
          line
        )
      ) {
        continue;
      }

      if (
        line.startsWith(
          "<"
        )
      ) {
        section =
          "other";

        continue;
      }

      result.cancellations.push(
        line
      );
    }
  }

  return result;
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const text =
      String(
        body.text ?? ""
      ).trim();

    if (!text) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "텔레그램 내용을 붙여넣어주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const year =
      Number(body.year) ||
      new Date().getFullYear();

    const blocks =
      splitIntoDateBlocks(
        text
      );

    const days =
      blocks
        .map((block) =>
          parseOneBlock(
            block,
            year
          )
        )
        .filter(
          (
            value
          ): value is ParsedDay =>
            value !==
            null
        );

    return NextResponse.json({
      ok: true,

      days,

      summary: {
        days:
          days.length,

        platformRows:
          days.reduce(
            (sum, day) =>
              sum +
              day.platforms
                .length,
            0
          ),

        visitSources:
          days.reduce(
            (sum, day) =>
              sum +
              day.visitSources
                .length,
            0
          ),

        cancellations:
          days.reduce(
            (sum, day) =>
              sum +
              day.cancellations
                .length,
            0
          ),

        warnings:
          days.reduce(
            (sum, day) =>
              sum +
              day.warnings
                .length,
            0
          ),
      },
    });
  } catch (error) {
    console.error(
      "Telegram preview error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "텔레그램 보고 분석 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}