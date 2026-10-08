import Holidays from "date-holidays";

/*
  병원 휴무일(일요일 + 법정 공휴일) 판별 — 서버/클라이언트 공용

  date-holidays 라이브러리는 설날·추석을 "당일 하루"만 주고,
  선거일·임시공휴일이 없고, 제헌절도 연도와 상관없이 넣는다.
  그래서 2025~2027년은 공식 달력 기준으로 직접 적어두고,
  그 밖의 연도만 라이브러리 + 설날/추석 앞뒤 하루 확장으로 계산한다.

  대체공휴일은 기존 규칙대로 휴무로 보지 않는다(진료일).
  대체공휴일도 쉬게 되면 아래 표에 날짜만 추가하면 된다.
*/

const FIXED_HOLIDAYS: Record<number, Record<string, string>> = {
  2025: {
    "01-01": "신정",
    "01-27": "임시공휴일",
    "01-28": "설날 연휴",
    "01-29": "설날",
    "01-30": "설날 연휴",
    "03-01": "3·1절",
    "05-05": "어린이날·부처님오신날",
    "06-03": "대통령 선거",
    "06-06": "현충일",
    "08-15": "광복절",
    "10-03": "개천절",
    "10-05": "추석 연휴",
    "10-06": "추석",
    "10-07": "추석 연휴",
    "10-09": "한글날",
    "12-25": "성탄절",
  },
  2026: {
    "01-01": "신정",
    "02-16": "설날 연휴",
    "02-17": "설날",
    "02-18": "설날 연휴",
    "03-01": "3·1절",
    "05-05": "어린이날",
    "05-24": "부처님오신날",
    "06-03": "지방선거",
    "06-06": "현충일",
    "07-17": "제헌절",
    "08-15": "광복절",
    "09-24": "추석 연휴",
    "09-25": "추석",
    "09-26": "추석 연휴",
    "10-03": "개천절",
    "10-09": "한글날",
    "12-25": "성탄절",
  },
  2027: {
    "01-01": "신정",
    "02-06": "설날 연휴",
    "02-07": "설날",
    "02-08": "설날 연휴",
    "03-01": "3·1절",
    "05-05": "어린이날",
    "05-13": "부처님오신날",
    "06-06": "현충일",
    "07-17": "제헌절",
    "08-15": "광복절",
    "09-14": "추석 연휴",
    "09-15": "추석",
    "09-16": "추석 연휴",
    "10-03": "개천절",
    "10-09": "한글날",
    "12-25": "성탄절",
  },
};

const cache = new Map<number, Map<string, string>>();

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function shiftYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return toYmd(new Date(y, m - 1, d + days));
}

function buildYear(year: number) {
  const map = new Map<string, string>();
  const fixed = FIXED_HOLIDAYS[year];

  if (fixed) {
    for (const [md, name] of Object.entries(fixed)) {
      map.set(`${year}-${md}`, name);
    }
    return map;
  }

  for (const holiday of new Holidays("KR").getHolidays(year)) {
    const name = String(holiday.name ?? "");

    if (
      holiday.type !== "public" ||
      holiday.substitute === true ||
      /대체|substitute/i.test(name)
    ) {
      continue;
    }

    const ymd = String(holiday.date).slice(0, 10);
    map.set(ymd, name);

    if (/설날|추석/.test(name)) {
      for (const offset of [-1, 1]) {
        const day = shiftYmd(ymd, offset);
        if (!map.has(day)) map.set(day, `${name} 연휴`);
      }
    }
  }

  return map;
}

function holidaysOf(year: number) {
  let map = cache.get(year);

  if (!map) {
    map = buildYear(year);
    cache.set(year, map);
  }

  return map;
}

/** 휴무 사유. 진료일이면 null */
export function getClosedReason(ymd: string): string | null {
  const text = String(ymd).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const [y, m, d] = text.split("-").map(Number);
  const holiday = holidaysOf(y).get(text);

  if (holiday) {
    return holiday;
  }

  if (new Date(y, m - 1, d).getDay() === 0) {
    return "일요일";
  }

  return null;
}

/** 일요일 또는 공휴일이면 true → 상담/수술 0 고정 */
export function isClosedDay(ymd: string) {
  return getClosedReason(ymd) !== null;
}

/** 해당 월(YYYY-MM)의 휴무일 목록 */
export function closedDaysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const result: string[] = [];

  for (let d = 1; d <= last; d++) {
    const ymd = `${y}-${pad(m)}-${pad(d)}`;
    if (isClosedDay(ymd)) result.push(ymd);
  }

  return result;
}
