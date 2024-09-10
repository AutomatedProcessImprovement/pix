import {
  Button,
  Grid,
  Paper,
  Typography,
  ButtonGroup,
  CircularProgress,
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import * as React from "react";
import "moment-duration-format";
import type { JSONReport } from "~/shared/optimos_json_type";
import { CloudDownload as CloudDownloadIcon, Cancel as CancelIcon } from "@mui/icons-material";
import { OptimosSolution } from "./OptimosSolution";
import { InitialSolutionContext } from "./InitialSolutionContext";
import { useAutoRefreshRequest } from "~/routes/projects.$projectId.$processingType/hooks/useAutoRefreshRequest";
import { FileType, getFile, getFileContent } from "~/services/files";
import { UserContext } from "~/routes/contexts";
import { cancelProcessingRequest, type ProcessingRequest } from "~/services/processing_requests";
import JSZip from "jszip";
import toast from "react-hot-toast";
import { SolutionChart } from "./SolutionChart";
import { formatCurrency, formatSeconds, formatPercentage } from "~/shared/num_helper";

interface SimulationResultsProps {
  report: JSONReport;
  processingRequest: ProcessingRequest;
}

const OptimizationResults = (props: SimulationResultsProps) => {
  const user = React.useContext(UserContext);
  const { report: reportJson, processingRequest: initialRequest } = props;
  const [report, setReport] = useState<JSONReport | null>(reportJson);

  const request = useAutoRefreshRequest(initialRequest);
  var oldFileId = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!request || !user) return;
      const fileIds = request.output_assets[0].files_ids;
      const files = await Promise.all(fileIds.map((id) => getFile(id, user.token!)));
      const optimosReportJsonFile = files?.find((file) => file.type === FileType.OPTIMIZATION_REPORT_OPTIMOS_JSON);

      if (!optimosReportJsonFile) return;
      if (oldFileId.current === optimosReportJsonFile.id) return;
      oldFileId.current = optimosReportJsonFile.id;
      console.log("Getting Content");
      const fileContent = await getFileContent(optimosReportJsonFile.id, user.token!);

      var jsonStr = "";
      if (optimosReportJsonFile.name.endsWith(".zip")) {
        const zipFile = await new JSZip().loadAsync(fileContent);
        jsonStr = await Object.values(zipFile.files)[0].async("string");
      } else {
        jsonStr = await fileContent.text();
      }

      const newReport = JSON.parse(jsonStr);
      console.log("Downloaded new Json");
      setReport(newReport);
    })();
  }, [request, user]);

  const [fileDownloadUrl, setFileDownloadUrl] = useState("");

  const linkDownloadRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (fileDownloadUrl !== "" && fileDownloadUrl !== undefined) {
      linkDownloadRef.current?.click();
      URL.revokeObjectURL(fileDownloadUrl);
    }
  }, [fileDownloadUrl]);

  const onDownload = () => {
    const blob = new Blob([JSON.stringify(reportJson)], {
      type: "application/json",
    });

    const optimizationReportFile = new File([blob], "name", {
      type: "application/json",
    });
    const fileDownloadUrl = URL.createObjectURL(optimizationReportFile);
    setFileDownloadUrl(fileDownloadUrl);
  };

  const onCancel = useCallback(async () => {
    if (!request) return;
    try {
      await cancelProcessingRequest(request.id, user!.token!);
      toast.success("Request cancelled (this may take a moment)");
    } catch (e) {
      toast.error("Failed to cancel the request");
      return;
    }
  }, [request, user]);

  if (!report)
    return (
      <Grid container justifyContent="center" alignItems="center" height="100vh" flexDirection={"column"}>
        <CircularProgress size={50} />
        <br></br>
        <Typography variant="h6">Loading...</Typography>
      </Grid>
    );

  const lastParetoFront = report.paretoFronts[report.paretoFronts.length - 1];
  const all_but_last_pareto_front = report.paretoFronts.slice(0, -1);
  const final_metrics = {
    ave_cost: 0,
    ave_time: 0,
    cost_metric: 0,
    time_metric: 0,
  };

  return (
    <InitialSolutionContext.Provider value={report.baseSolution}>
      <div style={{ height: "50px" }} />

      <Grid
        container
        alignItems="center"
        justifyContent="center"
        spacing={4}
        style={{ paddingTop: "10px" }}
        className="centeredContent"
      >
        <Grid item xs={8}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <h1 className="text-3xl font-semibold">Your Optimization Report</h1>
            </Grid>
            <Grid item xs={12}>
              <Paper elevation={5} sx={{ p: 3, minHeight: "10vw" }}>
                <Grid container>
                  <Grid item xs={8}>
                    <Typography variant="h5" align="left">
                      {report.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={4} justifyContent="flexEnd" textAlign={"right"}>
                    <ButtonGroup>
                      {!report.isFinal && (
                        <Button
                          type="button"
                          variant="outlined"
                          color="error"
                          onClick={onCancel}
                          startIcon={<CancelIcon />}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="contained"
                        onClick={(_e) => {
                          onDownload();
                        }}
                        startIcon={<CloudDownloadIcon />}
                      >
                        Report
                      </Button>
                    </ButtonGroup>
                    <a
                      style={{ display: "none" }}
                      download={"report.json"}
                      href={fileDownloadUrl}
                      ref={linkDownloadRef}
                    >
                      Download json
                    </a>
                  </Grid>
                  <Grid container>
                    {report.isFinal ? (
                      <>
                        {/* <Grid item xs={5}>
                          <Typography
                            sx={{
                              fontWeight: "bold",
                            }}
                            align={"left"}
                          >
                            Average cost
                          </Typography>
                          <Typography
                            sx={{
                              fontWeight: "bold",
                            }}
                            align={"left"}
                          >
                            Average cycle time
                          </Typography>

                          <Typography
                            sx={{
                              fontWeight: "bold",
                            }}
                            align={"left"}
                          >
                            Cost compared to original
                          </Typography>
                          <Typography
                            sx={{
                              fontWeight: "bold",
                            }}
                            align={"left"}
                          >
                            Time compared to original
                          </Typography>
                        </Grid>
                        <Grid item xs={7}>
                          <Typography align={"left"}> {formatCurrency(final_metrics?.ave_cost)}</Typography>
                          <Typography align={"left"}> {formatSeconds(final_metrics?.ave_time)}</Typography>
                          <Typography align={"left"}> {formatPercentage(1 / final_metrics?.cost_metric)}</Typography>
                          <Typography align={"left"}> {formatPercentage(1 / final_metrics?.time_metric)}</Typography>
                        </Grid>*/}
                      </>
                    ) : (
                      <>
                        <Grid container justifyContent="center">
                          <Grid item>
                            <CircularProgress size={60} />
                          </Grid>
                        </Grid>
                        <Grid container justifyContent="center" sx={{ mb: 4 }}>
                          <Grid item>
                            <Typography variant="body1" align="center">
                              The Process is still running, below you find the current iteration
                            </Typography>
                          </Grid>
                        </Grid>
                      </>
                    )}
                    <SolutionChart
                      optimalSolutions={lastParetoFront.solutions.filter((sol) => !sol.isBaseSolution)}
                      otherSolutions={all_but_last_pareto_front
                        .flatMap((front) => front.solutions)
                        .filter((sol) => !sol.isBaseSolution)}
                    />
                  </Grid>
                </Grid>
              </Paper>
              <Grid container>
                {lastParetoFront.solutions.map((solution, index) => (
                  <Grid item xs={12} key={`grid-${index}`} id={"solution_" + index}>
                    <OptimosSolution
                      key={index}
                      solution={solution}
                      finalMetrics={final_metrics}
                      constraints={report.constraints}
                    ></OptimosSolution>
                  </Grid>
                ))}
                {!!all_but_last_pareto_front.length && (
                  <>
                    <Grid item id="non-optimal-solutions">
                      <Typography variant="h5">Previous (non-optimal) solutions</Typography>
                    </Grid>
                    <Grid item xs={12} my={3}>
                      <Accordion
                        id="initial-solution-acc"
                        key="initial-solution"
                        slotProps={{ transition: { unmountOnExit: true } }}
                      >
                        <AccordionSummary>Initial Solution</AccordionSummary>
                        <AccordionDetails>
                          <OptimosSolution
                            solution={report.baseSolution}
                            constraints={report.constraints}
                          ></OptimosSolution>
                        </AccordionDetails>
                      </Accordion>

                      {all_but_last_pareto_front.map((front, index) => (
                        <Accordion
                          key={`non-optimal-solution-chunk-${index}`}
                          slotProps={{ transition: { unmountOnExit: true } }}
                        >
                          <AccordionSummary>Solution-Group {index + 1}</AccordionSummary>
                          <AccordionDetails>
                            <Grid container>
                              {front.solutions.map((solution, index) => (
                                <Grid item xs={12} key={`grid-${index}`} id={"solution_" + index}>
                                  <OptimosSolution
                                    key={index}
                                    solution={solution}
                                    finalMetrics={final_metrics}
                                    constraints={report.constraints}
                                  ></OptimosSolution>
                                </Grid>
                              ))}
                            </Grid>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </Grid>
                  </>
                )}
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </InitialSolutionContext.Provider>
  );
};

export default OptimizationResults;
