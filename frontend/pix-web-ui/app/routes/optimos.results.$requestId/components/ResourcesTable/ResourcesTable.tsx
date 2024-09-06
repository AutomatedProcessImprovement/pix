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
import type { Resource, JSONResourceInfo, JSONSolution } from "~/shared/optimos_json_type";
import { useInitialSolution } from "../InitialSolutionContext";
import { visuallyHidden } from "@mui/utils";
import { COLUMN_DEFINITIONS } from "./ResourcesTableColumnDefinitions";
import { ResourceTableRow } from "./ResourcesTableRow";

type OrderByField = keyof Omit<JSONResourceInfo, "initial_resource"> | "has_changes";
type Order = "asc" | "desc";

type ResourcesTableProps = {
  solution: JSONSolution;
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

const getOrderByHasChangesValue = (resource: JSONResourceInfo) => {
  if (resource.modifiers.deleted) return "1";
  if (resource.modifiers.added) return "2";
  if (resource.modifiers.tasksModified) return "3";
  if (resource.modifiers.shiftsModified) return "4";
  return "5";
};

export const ResourcesTable: FC<ResourcesTableProps> = React.memo((props) => {
  const { solution } = props;
  const resourceInfo = Object.values(solution.resourceInfo);
  const deletedResourcesInfo = Object.values(solution.deletedResourcesInfo);

  const [orderBy, setOrderBy] = useState<OrderByField>("has_changes");
  const [order, setOrder] = useState<Order>("desc");

  const [sortedResources, setSortedResources] = useState<JSONResourceInfo[]>([
    ...resourceInfo,
    ...deletedResourcesInfo,
  ]);

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
