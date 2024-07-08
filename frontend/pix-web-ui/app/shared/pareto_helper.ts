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

export const checkFront = (solution: Solution, front: Solution[], isMad = false) => {
  let dominatesFront = true;

  for (const frontSolution of front) {
    const dominated = isMad ? isMadDominated(solution, frontSolution) : isNonMadDominated(solution, frontSolution);
    const dominates = isMad ? isMadDominated(frontSolution, solution) : isNonMadDominated(frontSolution, solution);

    if (dominated) return FRONT_STATUS.DOMINATED_BY_FRONT;
    if (!dominates) dominatesFront = false;
  }
  return dominatesFront ? FRONT_STATUS.DOMINATES_FRONT : FRONT_STATUS.IN_FRONT;
};
