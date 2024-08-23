import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import type { FC } from "react";
import React, { useCallback, useEffect, useState } from "react";
import type { EnhancedResource, Resource, Solution, SolutionInfo } from "~/shared/optimos_json_type";
import {
  createInitialResourceStats,
  getBaseName,
  getInitialResourceByName,
  useInitialSolution,
} from "../InitialSolutionContext";
import { visuallyHidden } from "@mui/utils";
import { COLUMN_DEFINITIONS } from "./ResourcesTableColumnDefinitions";
import { ResourceTableRow } from "./ResourcesTableRow";

type OrderByField = keyof Omit<EnhancedResource, "initial_resource"> | "has_changes";
type Order = "asc" | "desc";

type ResourcesTableProps = {
  resources: Resource[];
  deletedResources: Resource[];
  solutionInfo: SolutionInfo;
};

const orderByHelper = (a: any, b: any, order: Order) => {
  if (a < b) {
    return order === "desc" ? -1 : 1;
  }
  if (a > b) {
    return order === "desc" ? 1 : -1;
  }
  return 0;
};

const getOrderByHasChangesValue = (resource: EnhancedResource) => {
  if (resource.is_deleted) return "1";
  if (resource.is_duplicate) return "2";
  if (resource.are_tasks_different) return "3";
  if (resource.are_shifts_different) return "4";
  return "5";
};

export const ResourcesTable: FC<ResourcesTableProps> = React.memo((props) => {
  const { resources, deletedResources, solutionInfo } = props;
  const initialSolution = useInitialSolution();

  const [orderBy, setOrderBy] = useState<OrderByField>("has_changes");
  const [order, setOrder] = useState<Order>("desc");
  const resourceToEnhancedResource = createEnhancedResourceMappingFunction(
    solutionInfo,
    resources,
    deletedResources,
    initialSolution
  );
  const [sortedResources, setSortedResources] = useState<EnhancedResource[]>(
    [...resources, ...deletedResources].map(resourceToEnhancedResource)
  );

  useEffect(() => {
    setSortedResources(
      [...sortedResources].sort((a, b) => {
        if (orderBy === "has_changes") {
          return orderByHelper(getOrderByHasChangesValue(a), getOrderByHasChangesValue(b), order);
        }
        return orderByHelper(a[orderBy], b[orderBy], order);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, orderBy]);

  const onSortingClick = useCallback(
    (columnId: OrderByField) => {
      if (orderBy !== columnId) {
        setOrder("desc");
        setOrderBy(columnId);
      } else {
        setOrder(order === "asc" ? "desc" : "asc");
      }
    },
    [orderBy, order]
  );

  return (
    <TableContainer component={Paper}>
      <Table aria-label="collapsible table">
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>
              <TableSortLabel
                active={orderBy === "has_changes"}
                direction={orderBy === "has_changes" ? order : "desc"}
                onClick={() => onSortingClick("has_changes")}
              >
                Status
                {orderBy === "has_changes" ? (
                  <Box component="span" sx={visuallyHidden}>
                    {order === "desc" ? "sorted descending" : "sorted ascending"}
                  </Box>
                ) : null}
              </TableSortLabel>
            </TableCell>
            {COLUMN_DEFINITIONS.map((column) => (
              <TableCell
                key={column.id}
                align="left"
                style={{ minWidth: column.minWidth }}
                sortDirection={orderBy === column.id ? order : false}
              >
                <TableSortLabel
                  active={orderBy === column.id}
                  direction={orderBy === column.id ? order : "desc"}
                  onClick={() => onSortingClick(column.id)}
                >
                  {column.label}
                  {orderBy === column.id ? (
                    <Box component="span" sx={visuallyHidden}>
                      {order === "desc" ? "sorted descending" : "sorted ascending"}
                    </Box>
                  ) : null}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedResources.map((resource) => (
            <ResourceTableRow key={resource.id} resource={resource} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
});

const areShiftsDifferent = (resource: Resource, initialResource?: Resource | null) =>
  JSON.stringify({ ...resource.shifts[0], resource_id: "" }) !==
  JSON.stringify({ ...initialResource?.shifts[0], resource_id: "" });

const splitTasks = (currentTasks: string[], initialTasks?: string[]) => {
  const newTasks = currentTasks.filter((task) => !initialTasks?.includes(task));
  const removedTasks = initialTasks?.filter((task) => !currentTasks.includes(task));
  const oldTasks = currentTasks.filter((task) => initialTasks?.includes(task));
  return { newTasks, oldTasks, removedTasks };
};

const createEnhancedResourceMappingFunction = (
  solutionInfo: SolutionInfo,
  resources: Resource[],
  deletedResources: Resource[],
  initialSolution: Solution
) => {
  const {
    pool_utilization,
    pool_time,
    pool_cost,
    available_time,
    pools_info: { task_allocations },
  } = solutionInfo;

  return (resource: Resource): EnhancedResource => {
    const tasks = resource.assigned_tasks;
    const initialResource = getInitialResourceByName(initialSolution, resource.name);
    const enhancedInitialResource = !initialResource
      ? null
      : {
          ...initialResource,
          ...createInitialResourceStats(initialResource.id, initialSolution),
        };

    const { newTasks, oldTasks, removedTasks } = splitTasks(tasks, enhancedInitialResource?.tasks);
    const isDeleted = deletedResources.some((r) => r.id === resource.id);
    const isDuplicate =
      getBaseName(resource.name) !== resource.name &&
      resources.filter((r) => getBaseName(r.name) === getBaseName(resource.name)).length > 1;

    return {
      ...resource,
      total_worktime: pool_time[resource.id],
      total_cost: pool_cost[resource.id],
      utilization: pool_utilization[resource.id],
      available_time: available_time[resource.id],
      tasks,
      initial_resource: enhancedInitialResource || undefined,
      is_duplicate: isDuplicate,
      is_deleted: isDeleted,
      are_tasks_different: !isDuplicate && !isDeleted && (newTasks.length > 0 || (removedTasks?.length ?? 0) > 0),
      are_shifts_different: !isDuplicate && !isDeleted && areShiftsDifferent(resource, initialResource),
      new_tasks: newTasks,
      removed_tasks: removedTasks ?? [],
      old_tasks: oldTasks,
    };
  };
};
