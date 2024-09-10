import { Card, CardContent, Grid, Icon, Stack, Typography } from "@mui/material";
import type { FC } from "react";
import type { BaseAction, JSONSolution } from "~/shared/optimos_json_type";
import {
  AddCircleOutline,
  ContentCopy as ContentCopyIcon,
  DeleteOutline,
  DoubleArrow,
  RemoveCircleOutline,
} from "@mui/icons-material";

type ModificationOverviewProps = {
  solution: JSONSolution;
};

export const ModificationOverview: FC<ModificationOverviewProps> = (props) => {
  const { solution } = props;
  const actions = solution.actions;

  return (
    <Grid container spacing={2}>
      {actions.map((action, index) => {
        return (
          <Grid item xs={6} key={index}>
            <ActionCard action={action} />
          </Grid>
        );
      })}
    </Grid>
  );
};

const ActionCard = ({ action }: { action: BaseAction }) => {
  let title;
  let description;
  let icon;
  switch (action.type) {
    case "AddResourceAction":
      icon = <ContentCopyIcon />;
      title = "Clone Resource";
      description = (
        <span>
          Cloned resource <b>{action.params["resource_id"]}.</b>
        </span>
      );
      break;
    case "ModifyCalendarByCostAction":
    case "ModifyCalendarByITAction":
    case "ModifyCalendarByWTAction":
      const resourceId = action.params["calendar_id"].replace("timetable", "");
      if ("shift_hours" in action.params) {
        icon = <DoubleArrow />;
        title = "Move shift to start" + (action.params["shift_hours"] > 0 ? " later" : " earlier");
        description = (
          <span>
            Moved <b>{action.params["period_index"]}. shift</b> on <b>{action.params["day"]}</b> by{" "}
            {action.params["shift_hours"]} hours for resource <b>{resourceId}</b>.
          </span>
        );
      } else if ("add_hours_after" in action.params && "add_hours_before" in action.params) {
        if (action.params["add_hours_after"] > 0 && action.params["add_hours_before"] > 0) {
          icon = <AddCircleOutline />;
          title = "Add hours before and after shift";
          description = (
            <span>
              Added {action.params["add_hours_before"]} hours before and {action.params["add_hours_after"]} hours after{" "}
              <b>{action.params["period_index"]}. shift</b> on <b>{action.params["day"]}</b> for resource{" "}
              <b>{resourceId}</b>.
            </span>
          );
        } else if (action.params["add_hours_after"] < 0 && action.params["add_hours_before"] < 0) {
          icon = <RemoveCircleOutline />;
          title = "Remove hours before and after shift";
          description = (
            <span>
              Removed {Math.abs(action.params["add_hours_before"])} hours before and{" "}
              {Math.abs(action.params["add_hours_after"])} hours after <b>{action.params["period_index"]}. shift</b> on{" "}
              <b>{action.params["day"]}</b> for resource <b>{resourceId}</b>.
            </span>
          );
        }
      } else if ("add_hours_after" in action.params && action.params["add_hours_after"] > 0) {
        icon = <AddCircleOutline />;
        title = "Add hours after shift";
        description = (
          <span>
            Added {action.params["add_hours_after"]} hours after <b>{action.params["period_index"]}. shift</b> on{" "}
            <b>{action.params["day"]}</b> for resource <b>{resourceId}</b>.
          </span>
        );
      } else if ("add_hours_after" in action.params && action.params["add_hours_after"] < 0) {
        icon = <RemoveCircleOutline />;
        title = "Remove hours after shift";
        description = (
          <span>
            Removed {Math.abs(action.params["add_hours_after"])} hours after{" "}
            <b>{action.params["period_index"]}. shift</b> on <b>{action.params["day"]}</b> for resource{" "}
            <b>{resourceId}</b>.
          </span>
        );
      } else if ("add_hours_before" in action.params && action.params["add_hours_before"] > 0) {
        icon = <AddCircleOutline />;
        title = "Add hours before shift";
        description = (
          <span>
            Added {action.params["add_hours_before"]} hours before <b>{action.params["period_index"]}. shift</b> on{" "}
            <b>{action.params["day"]}</b> for resource <b>{resourceId}</b>.
          </span>
        );
      } else if ("add_hours_before" in action.params && action.params["add_hours_before"] < 0) {
        icon = <RemoveCircleOutline />;
        title = "Remove hours before shift";
        description = (
          <span>
            Removed {Math.abs(action.params["add_hours_before"])} hours before{" "}
            <b>{action.params["period_index"]}. shift</b> on <b>{action.params["day"]}</b> for resource{" "}
            <b>{resourceId}</b>.
          </span>
        );
      } else if ("remove_period" in action.params) {
        icon = <DeleteOutline />;
        title = "Remove shift";
        description = (
          <span>
            Removed <b>{action.params["period_index"]}. shift</b> on <b>{action.params["day"]}</b> for resource{" "}
            <b>{resourceId}</b>.
          </span>
        );
      }

      break;
    default:
      title = "Unknown action";
      description = "Unknown action type";
  }
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mx: 1 }}>
          {icon}
          <Typography variant="h6" component="div">
            {title}
          </Typography>
        </Stack>
        <Typography variant="body1">{description}</Typography>
      </CardContent>
    </Card>
  );
};
