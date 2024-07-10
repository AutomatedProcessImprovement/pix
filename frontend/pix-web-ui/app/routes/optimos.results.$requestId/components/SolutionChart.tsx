import React, { FC } from "react";
import * as Highcharts from "highcharts";
import { HighchartsReact } from "highcharts-react-official";
import type { Solution } from "~/shared/optimos_json_type";
import { Grid } from "@mui/material";
import { formatCurrency, formatHours, formatSeconds } from "~/shared/num_helper";
import { useNavigate } from "@remix-run/react";

interface SolutionChartProps {
  optimalSolutions: Solution[];
  otherSolutions: Solution[];
  initialSolution?: Solution;
  averageCost: number;
  averageTime: number;
}

export const SolutionChart: FC<SolutionChartProps> = ({
  optimalSolutions,
  otherSolutions,
  initialSolution,
  averageCost,
  averageTime,
}) => {
  const navigate = useNavigate();
  const options: Highcharts.Options = {
    chart: {
      type: "scatter",
      events: {},
    },
    title: {
      text: "Solutions",
    },
    tooltip: {
      formatter: function () {
        return `<span style="text-transform: capitalize;text-decoration: underline;">${
          this.point.name
        }</span><br><b>Time:</b> ${formatSeconds(this.x as number)}<br><b>Cost:</b> ${formatCurrency(this.y ?? 0)}`;
      },
    },
    xAxis: {
      title: {
        text: "Time",
      },
      labels: {
        formatter: function () {
          return Math.round(((this.value as number) * 10) / 60 / 60) / 10 + "h";
        },
      },
    },
    yAxis: {
      title: {
        text: "Cost",
      },
      labels: {
        formatter: function () {
          return formatCurrency(this.value as number);
        },
      },
    },
    plotOptions: {
      scatter: {
        marker: {
          symbol: "circle",
        },
        cursor: "pointer",
        point: {
          events: {
            click: function () {
              console.log(this);
              // Navigate to specific execution via anchor link
              navigate(`#solution_${this.index}`);
            },
          },
        },
      },
    },
    series: [
      {
        name: "Other Solutions",
        data: otherSolutions.map((solution, index) => ({
          x: solution.solution_info.mean_process_cycle_time,
          y: solution.solution_info.total_pool_cost,
          id: `execution_${optimalSolutions.length + index}`,
          name: `Solution #${solution.iteration}`,
        })),
        color: "gray",
        type: "scatter",
      },
      {
        name: "Initial Solution",
        data: [
          {
            x: initialSolution?.solution_info.mean_process_cycle_time,
            y: initialSolution?.solution_info.total_pool_cost,
            id: `execution_${0}`,
            name: `${initialSolution?.name.replaceAll("_", " ")} #${initialSolution?.iteration}`,
          },
        ],
        color: "red",
        type: "scatter",
      },
      {
        name: "Optimal Solution",
        data: optimalSolutions.map((solution, index) => ({
          x: solution.solution_info.mean_process_cycle_time,
          y: solution.solution_info.total_pool_cost,
          id: `execution_${index}`,
          name: `Solution #${solution.iteration}`,
        })),
        type: "scatter",
      },
      // {
      //   name: "Average Solution",
      //   data: [
      //     {
      //       x: averageCost,
      //       y: averageTime,
      //     },
      //   ],
      //   type: "scatter",
      // },
    ],
  };

  return (
    <Grid item xs={12}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </Grid>
  );
};
