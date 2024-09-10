import { Container, Grid, Typography } from "@mui/material";
import { formatCurrency, formatSeconds, formatPercentage } from "~/shared/num_helper";
import { JSONSolution } from "~/shared/optimos_json_type";
import { DiffInfo } from "./ResourcesTable/ResourcesTableCell";
import { useInitialSolution } from "./InitialSolutionContext";

export const BatchingOverview = ({ solution }: { solution: JSONSolution }) => {
  const initialSolution = useInitialSolution();
  return (
    <Grid container>
      <Grid item xs={5}>
        <Typography
          sx={{
            fontWeight: "bold",
          }}
          align={"left"}
        >
          Waiting time due to batching
        </Typography>
        <Typography
          sx={{
            fontWeight: "bold",
          }}
          align={"left"}
        >
          Batching Changes
        </Typography>
      </Grid>
      <Grid item xs={7}>
        <Typography align={"left"}>
          {formatSeconds(solution.globalInfo.totalCost)}
          {/* {finalMetrics &&
          (finalMetrics.ave_cost > info.total_pool_cost ? (
            <i style={{ color: "green", fontSize: "0.8em" }}> (≤ avg.)</i>
          ) : (
            <i style={{ color: "red", fontSize: "0.8em" }}> ({">"} avg.)</i>
          ))} */}{" "}
          <DiffInfo
            a={initialSolution?.globalInfo.totalCost}
            b={solution.globalInfo.totalCost}
            formatFn={formatSeconds}
            lowerIsBetter={true}
            suffix="initial solution"
            onlyShowDiff
            margin={0.0}
          />
        </Typography>
      </Grid>
    </Grid>
  );
};
