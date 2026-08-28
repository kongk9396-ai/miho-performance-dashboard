"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  date: string;
  category: string;
  consultations: number;
  surgeries: number;
  rate: number;
};

export default function CategoryTrendChart({
  rows,
}: {
  rows: Row[];
}) {
  const data = rows.map((row) => ({
    ...row,
    label: `${Number(row.date.slice(5, 7))}/${Number(
      row.date.slice(8, 10)
    )}`,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl bg-zinc-50 text-sm text-zinc-400">
        선택한 카테고리의 입력 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <LineChart
          data={data}
          margin={{
            top: 15,
            right: 20,
            left: -10,
            bottom: 0,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />

          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />

          <Tooltip
            formatter={(
              value,
              name
            ) => [
              `${Number(value)}건`,
              name,
            ]}
          />

          <Legend />

          <Line
            type="monotone"
            dataKey="consultations"
            name="상담"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{
              r: 4,
            }}
            activeDot={{
              r: 6,
            }}
          />

          <Line
            type="monotone"
            dataKey="surgeries"
            name="수술"
            stroke="#7c3aed"
            strokeWidth={3}
            dot={{
              r: 4,
            }}
            activeDot={{
              r: 6,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}