import type { ReactNode } from "react";
import { formatSeconds, formatHours, formatHourlyRate, formatCurrency, formatPercentage } from "~/shared/num_helper";
import type { EnhancedResource } from "~/shared/optimos_json_type";

export const COLUMN_DEFINITIONS: {
  id: keyof Omit<EnhancedResource, "initial_resource">;
  label: string;
  formatFn: (x: any) => ReactNode;
  lowerIsBetter?: boolean;
  minWidth?: string | number;
}[] = [
  { id: "resource_name", label: "Name", formatFn: (x) => x, minWidth: "10em" },
  { id: "total_worktime", label: "Worktime", formatFn: formatSeconds, lowerIsBetter: false, minWidth: "10em" },
  { id: "available_time", label: "Available Time", formatFn: formatHours, lowerIsBetter: true },
  { id: "cost_per_hour", label: "Hourly Rate", formatFn: formatHourlyRate, lowerIsBetter: true },
  { id: "total_cost", label: "Total Cost", formatFn: formatCurrency, lowerIsBetter: true },
  { id: "utilization", label: "Utilization", formatFn: formatPercentage, lowerIsBetter: false },
  { id: "is_human", label: "Type", formatFn: (x) => (x ? "Human" : "Machine") },
  { id: "max_weekly_cap", label: "Max h/week", formatFn: formatHours, lowerIsBetter: false },
  { id: "max_daily_cap", label: "Max h/day", formatFn: formatHours, lowerIsBetter: false },
  { id: "max_consecutive_cap", label: "Max Hours consecutively", formatFn: formatHours, lowerIsBetter: false },
];
