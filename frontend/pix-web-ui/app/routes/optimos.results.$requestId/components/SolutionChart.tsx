import type { FC } from "react";
import React, { useContext } from "react";
import * as Highcharts from "highcharts";
import { HighchartsReact } from "highcharts-react-official";
import { Grid } from "@mui/material";
import { formatCurrency, formatHours, formatSeconds } from "~/shared/num_helper";
import { useNavigate } from "@remix-run/react";
import { InitialSolutionContext } from "./InitialSolutionContext";
import type { JSONSolution } from "~/shared/optimos_json_type";

interface SolutionChartProps {
  optimalSolutions: JSONSolution[];
  otherSolutions: JSONSolution[];
  averageCost: number;
  averageTime: number;
}

export const SolutionChart: FC<SolutionChartProps> = ({
  optimalSolutions,
  otherSolutions,
  averageCost,
  averageTime,
}) => {
  const initialSolution = useContext(InitialSolutionContext);
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
              if (this.color === "red") return navigate("#initial-solution-acc");
              if (this.color === "gray") return navigate("#non-optimal-solutions");
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
          x: solution.globalInfo.averageTime,
          y: solution.globalInfo.averageCost,
          id: `execution_${optimalSolutions.length + index}`,
          name: `Solution #${solution.solutionNo}`,
        })),
        color: "gray",
        type: "scatter",
      },
      {
        name: "Initial Solution",
        data: [
          {
            x: initialSolution?.globalInfo.averageTime,
            y: initialSolution?.globalInfo.averageCost,
            id: `execution_${0}`,
            name: `Solution #${initialSolution?.solutionNo}`,
          },
        ],
        color: "red",
        type: "scatter",
      },
      {
        name: "Optimal Solution",
        data: optimalSolutions.map((solution, index) => ({
          x: solution.globalInfo.averageTime,
          y: solution.globalInfo.averageCost,
          id: `execution_${index}`,
          name: `Solution #${solution.solutionNo}`,
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
