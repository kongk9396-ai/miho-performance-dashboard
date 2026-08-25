import DashboardClient from "@/components/DashboardClient";

import {
  getAvailableMonths,
  getDashboardData,
} from "@/lib/db/queries";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

export default async function Home({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const availableMonths =
    await getAvailableMonths();

  /*
    URL에 month가 있고
    실제 DB에 존재하는 월이면 그 월 사용.

    없으면 DB의 가장 최신 월을
    자동 기본값으로 사용.
  */
  const selectedMonth =
    params.month &&
    availableMonths.includes(
      params.month
    )
      ? params.month
      : availableMonths[0] ??
        "2026-07-01";

  const data =
    await getDashboardData(
      selectedMonth
    );

  return (
    <DashboardClient
      data={data}
      availableMonths={
        availableMonths
      }
    />
  );
}