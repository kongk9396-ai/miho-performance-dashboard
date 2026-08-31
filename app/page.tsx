import DashboardClient from "@/components/DashboardClient";

import {
  getAvailableMonths,
  getDashboardData,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

export default async function Home({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const availableMonths =
    await getAvailableMonths();

  const requestedMonth =
    typeof params.month === "string"
      ? params.month.slice(0, 7)
      : null;

  const selectedMonth =
    requestedMonth &&
    availableMonths.includes(requestedMonth)
      ? requestedMonth
      : availableMonths[0] ??
        "2026-07";

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
