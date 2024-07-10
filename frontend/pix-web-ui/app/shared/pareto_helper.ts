import type { Solution } from "./optimos_json_type";

/** Gets the duration of a solution in seconds */
export const getSolutionDuration = (solution: Solution) => {
  return (
    (new Date(solution.solution_info.simulation_start_date).getTime() -
      new Date(solution.solution_info.simulation_end_date).getTime()) /
    1000
  );
};

export const isNonMadDominated = (dominatedInfo: Solution, dominantInfo: Solution) => {
  return (
    dominantInfo.solution_info.mean_process_cycle_time < dominatedInfo.solution_info.mean_process_cycle_time &&
    dominantInfo.solution_info.total_pool_cost < dominatedInfo.solution_info.total_pool_cost
  );
};

export const isMadDominated = (dominatedInfo: Solution, dominantInfo: Solution) => {
  const devDominated = dominatedInfo.solution_info.deviation_info;
  const devDominant = dominantInfo.solution_info.deviation_info;

  const minCycleTimeDeviation = Math.min(devDominant.cycle_time_deviation, devDominated.cycle_time_deviation);
  const meanCycleTimeChange = Math.abs(
    dominatedInfo.solution_info.mean_process_cycle_time - dominantInfo.solution_info.mean_process_cycle_time
  );

  const simulationTimeChange = Math.abs(getSolutionDuration(dominatedInfo) - getSolutionDuration(dominantInfo));
  const minDurationDeviation = Math.min(
    devDominant.execution_duration_deviation,
    devDominated.execution_duration_deviation
  );

  return (
    isNonMadDominated(dominatedInfo, dominantInfo) &&
    meanCycleTimeChange > minCycleTimeDeviation &&
    simulationTimeChange > minDurationDeviation
  );
};

export enum FRONT_STATUS {
  DOMINATES_FRONT = "DOMINATES_FRONT",
  DOMINATED_BY_FRONT = "DOMINATED_BY_FRONT",
  IN_FRONT = "IN_FRONT",
}

export const addToFront = (solution: Solution, front: Solution[], isMad = false): Solution[] => {
  const isDominated = isMad ? isMadDominated : isNonMadDominated;
  let shouldAddNewSolution = true;
  const newFront: Solution[] = [];

  for (const frontSolution of front) {
    if (isDominated(frontSolution, solution)) {
      // If the current solution is dominated by the new solution, skip it
      continue;
    }
    if (isDominated(solution, frontSolution)) {
      // If the new solution is dominated by any solution, it should not be added
      shouldAddNewSolution = false;
    }
    newFront.push(frontSolution);
  }

  if (shouldAddNewSolution) {
    newFront.push(solution);
  }

  return newFront;
};
