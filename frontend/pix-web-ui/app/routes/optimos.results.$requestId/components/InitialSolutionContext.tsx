import { createContext, useContext } from "react";
import type { EnhancedResource, ResourceStats, Solution } from "~/shared/optimos_json_type";

export const InitialSolutionContext = createContext<Solution | undefined>(undefined);

export const useInitialSolution = () => {
  const initialSolution = useContext(InitialSolutionContext);
  if (initialSolution === undefined) {
    throw new Error("useInitialSolution must be used within a InitialSolutionProvider");
  }
  return initialSolution;
};

export const useInitialResource = (resourceId?: string) => {
  const initialSolution = useInitialSolution();
  if (!resourceId) return null;
  const resource = initialSolution.solution_info.pools_info.pools[resourceId];
  return resource;
};
export const useInitialResourceStats = (resourceId?: string) => {
  const initialSolution = useInitialSolution();
  if (!resourceId) return null;
  return createInitialResourceStats(resourceId, initialSolution);
};

export const createInitialResourceStats = (resourceId: string, initialSolution: Solution): ResourceStats => {
  const {
    pool_time,
    pool_cost,
    pool_utilization,
    available_time,
    pools_info: { task_allocations, task_pools },
  } = initialSolution.solution_info;
  return {
    total_worktime: pool_time[resourceId],
    total_cost: pool_cost[resourceId],
    utilization: pool_utilization[resourceId],
    available_time: available_time[resourceId],
    tasks: task_allocations[resourceId],
    is_duplicate: false,
    are_tasks_different: false,
    is_deleted: false,
    are_shifts_different: false,
    new_tasks: [],
    old_tasks: [],
    removed_tasks: [],
  };
};

export const useInitialEnhancedResource = (resourceId?: string): EnhancedResource | null => {
  const initialResource = useInitialResource(resourceId);
  const initialResourceStats = useInitialResourceStats(resourceId);
  if (!resourceId) return null;
  const initialEnhancedResource = { ...initialResource!, ...initialResourceStats! };
  return initialEnhancedResource;
};

export const getBaseName = (resourceName: string) => resourceName.replace(/_COPY.*$/, "").replace(/_clone.*$/, "");

export const useInitialEnhancedResourceByName = (resourceName: string): EnhancedResource | null => {
  const initialSolution = useInitialSolution();
  const pools = initialSolution.solution_info.pools_info.pools;
  const resourceId = Object.keys(pools).find((id) => pools[id].name === getBaseName(resourceName));

  return useInitialEnhancedResource(resourceId);
};

export const useIsInitialSolutions = (poolsInfoId: string) => {
  const initialSolution = useInitialSolution();
  return initialSolution.solution_info.pools_info.id === poolsInfoId;
};

export const getInitialResourceByName = (initialSolution: Solution, resourceName: string) => {
  const pools = initialSolution.solution_info.pools_info.pools;
  const resourceId = Object.keys(pools).find((id) => pools[id].name === getBaseName(resourceName));
  if (!resourceId) return null;
  return initialSolution.solution_info.pools_info.pools[resourceId];
};
