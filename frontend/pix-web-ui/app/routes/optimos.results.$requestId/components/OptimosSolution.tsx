import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  ButtonGroup,
  Grid,
  Paper,
  Typography,
} from "@mui/material";
import type { FC } from "react";
import { useEffect, useRef, useState, memo, useContext } from "react";
import { WeekView } from "~/components/optimos/WeekView";
import { formatCurrency, formatSeconds, formatPercentage } from "~/shared/num_helper";
import type { ConsParams, JSONSolution } from "~/shared/optimos_json_type";
import { CloudDownload as CloudDownloadIcon, ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { ResourcesTable } from "./ResourcesTable/ResourcesTable";
import { DiffInfo } from "./ResourcesTable/ResourcesTableCell";
import { InitialSolutionContext } from "./InitialSolutionContext";
import { BatchingOverview } from "./BatchingOverview";
import { ModificationOverview } from "./ModificationOverview";

interface OptimosSolutionProps {
  solution: JSONSolution;
  finalMetrics?: any;
  constraints: ConsParams;
}

export const OptimosSolution: FC<OptimosSolutionProps> = memo(({ finalMetrics, solution, constraints }) => {
  const initialSolution = useContext(InitialSolutionContext);

  const [expanded, setExpanded] = useState<string | false>("overview");

  const link2DownloadRef = useRef<HTMLAnchorElement>(null);
  const link3DownloadRef = useRef<HTMLAnchorElement>(null);

  const [fileDownloadSimParams, setFileDownloadSimParams] = useState("");
  const [fileDownloadConsParams, setFileDownloadConsParams] = useState("");

  const onDownloadEntrySimParams = (entry: any) => {
    const blob = new Blob([JSON.stringify(entry)], {
      type: "application/json",
    });

    const entry_parameters_file = new File([blob], "name", {
      type: "application/json",
    });
    const fileDownloadUrl = URL.createObjectURL(entry_parameters_file);
    setFileDownloadSimParams(fileDownloadUrl);
  };

  const onDownloadEntryConsParams = (entry: any) => {
    const blob = new Blob([JSON.stringify(entry)], {
      type: "application/json",
    });

    const entry_parameters_file = new File([blob], "name", {
      type: "application/json",
    });
    const fileDownloadUrl = URL.createObjectURL(entry_parameters_file);
    setFileDownloadConsParams(fileDownloadUrl);
  };

  useEffect(() => {
    if (fileDownloadSimParams !== "" && fileDownloadSimParams !== undefined) {
      link2DownloadRef.current?.click();
      URL.revokeObjectURL(fileDownloadSimParams);
    }
  }, [fileDownloadSimParams]);

  useEffect(() => {
    if (fileDownloadConsParams !== "" && fileDownloadConsParams !== undefined) {
      link3DownloadRef.current?.click();
      URL.revokeObjectURL(fileDownloadConsParams);
    }
  }, [fileDownloadConsParams]);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Paper elevation={5} sx={{ m: 3, p: 3, minHeight: "10vw" }}>
      <Grid container alignItems={"center"} justifyContent={"center"} height={"4em"}>
        <Grid item xs={8}>
          <Typography variant="h6" align="left" textTransform={"capitalize"}>
            {solution.isBaseSolution ? "Initial Solution" : `Solution #${solution.solutionNo}`}
          </Typography>
        </Grid>
        <Grid item xs={4}>
          <a
            style={{
              display: "none",
            }}
            download={"constraints.json"}
            href={fileDownloadConsParams}
            ref={link3DownloadRef}
          >
            Download json
          </a>
          <a
            style={{
              display: "none",
            }}
            download={"simparams.json"}
            href={fileDownloadSimParams}
            ref={link2DownloadRef}
          >
            Download json
          </a>
          <Grid item xs={12}>
            <ButtonGroup variant="outlined" aria-label="Download parameters">
              <Button
                onClick={(_e) => {
                  onDownloadEntrySimParams(solution.timetable);
                }}
                startIcon={<CloudDownloadIcon />}
              >
                Parameters
              </Button>
              <Button
                onClick={(_e) => {
                  onDownloadEntryConsParams(constraints);
                }}
                startIcon={<CloudDownloadIcon />}
              >
                Constraints
              </Button>
            </ButtonGroup>
          </Grid>
        </Grid>
      </Grid>
      <Accordion
        defaultExpanded
        sx={{
          paddingTop: 1,
        }}
        expanded={expanded === "overview"}
        onChange={handleChange("overview")}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" align="left">
            Details
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container>
            <Grid item xs={5}>
              <Typography
                sx={{
                  fontWeight: "bold",
                }}
                align={"left"}
              >
                Mean cost (per case)
              </Typography>
              <Typography
                sx={{
                  fontWeight: "bold",
                }}
                align={"left"}
              >
                Mean time (per case)
              </Typography>
              <Typography
                sx={{
                  fontWeight: "bold",
                }}
                align={"left"}
              >
                Mean waiting time (per case)
              </Typography>
              <Typography
                sx={{
                  fontWeight: "bold",
                }}
                align={"left"}
              >
                Mean resource utilization
              </Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography align={"left"}>
                {formatCurrency(solution.globalInfo.totalCost)}
                {/* {finalMetrics &&
                  (finalMetrics.ave_cost > info.total_pool_cost ? (
                    <i style={{ color: "green", fontSize: "0.8em" }}> (≤ avg.)</i>
                  ) : (
                    <i style={{ color: "red", fontSize: "0.8em" }}> ({">"} avg.)</i>
                  ))} */}{" "}
                <DiffInfo
                  a={initialSolution?.globalInfo.totalCost}
                  b={solution.globalInfo.totalCost}
                  formatFn={formatCurrency}
                  lowerIsBetter={true}
                  suffix="initial solution"
                  onlyShowDiff
                  margin={0.0}
                />
              </Typography>
              <Typography align={"left"}>
                {formatSeconds(solution.globalInfo.averageTime)}{" "}
                <DiffInfo
                  a={initialSolution?.globalInfo.averageTime}
                  b={solution.globalInfo.averageTime}
                  formatFn={formatSeconds}
                  lowerIsBetter={true}
                  suffix="initial solution"
                  onlyShowDiff
                  margin={0.0}
                ></DiffInfo>
              </Typography>
              <Typography align={"left"}>
                {formatSeconds(solution.globalInfo.averageWaitingTime)}{" "}
                <DiffInfo
                  a={initialSolution?.globalInfo.averageWaitingTime}
                  b={solution.globalInfo.averageWaitingTime}
                  formatFn={formatSeconds}
                  lowerIsBetter={true}
                  suffix="initial solution"
                  onlyShowDiff
                  margin={0.0}
                ></DiffInfo>
              </Typography>
              <Typography align={"left"}>
                {formatPercentage(solution.globalInfo.averageResourceUtilization)}{" "}
                <DiffInfo
                  a={initialSolution?.globalInfo.averageResourceUtilization}
                  b={solution.globalInfo.averageResourceUtilization}
                  formatFn={formatPercentage}
                  lowerIsBetter={false}
                  suffix="initial solution"
                  onlyShowDiff
                  margin={0.01}
                />
              </Typography>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === "resources"} onChange={handleChange("resources")}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" align="left">
            Resources
          </Typography>
        </AccordionSummary>

        <AccordionDetails>
          <ResourcesTable solution={solution} />
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === "batching"} onChange={handleChange("batching")}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" align="left">
            Batching
          </Typography>
        </AccordionSummary>

        <AccordionDetails>
          <BatchingOverview solution={solution} />
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === "actions"} onChange={handleChange("actions")}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" align="left">
            All Modifications
          </Typography>
        </AccordionSummary>

        <AccordionDetails>
          <ModificationOverview solution={solution} />
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
});
