import type { ReactNode } from "react";
import {
  formatSeconds,
  formatHours,
  formatHourlyRate,
  formatCurrency,
  formatPercentage,
  formatMilliseconds,
} from "~/shared/num_helper";
import type { JSONResourceInfo } from "~/shared/optimos_json_type";

export const COLUMN_DEFINITIONS: {
  id: keyof JSONResourceInfo;
  label: string;
  formatFn: (x: any) => ReactNode;
  lowerIsBetter?: boolean;
  minWidth?: string | number;
}[] = [
  { id: "name", label: "Name", formatFn: (x) => x, minWidth: "10em" },
  { id: "workedTime", label: "Worktime", formatFn: formatSeconds, lowerIsBetter: false, minWidth: "10em" },
  { id: "availableTime", label: "Available Time", formatFn: formatSeconds, lowerIsBetter: true },
  { id: "hourlyRate", label: "Hourly Rate", formatFn: formatHourlyRate, lowerIsBetter: true },
  { id: "totalCost", label: "Cost/week", formatFn: formatCurrency, lowerIsBetter: true },
  { id: "utilization", label: "Utilization", formatFn: formatPercentage, lowerIsBetter: false },
  {
    id: "totalBatchingWaitingTime",
    label: "Batching Waiting Time",
    formatFn: formatSeconds,
    lowerIsBetter: true,
  },
  { id: "isHuman", label: "Type", formatFn: (x) => (x ? "Human" : "Machine") },
  { id: "maxWeeklyCapacity", label: "Max h/week", formatFn: formatHours, lowerIsBetter: false },
  { id: "maxDailyCapacity", label: "Max h/day", formatFn: formatHours, lowerIsBetter: false },
  { id: "maxConsecutiveCapacity", label: "Max Hours consecutively", formatFn: formatHours, lowerIsBetter: false },
];
