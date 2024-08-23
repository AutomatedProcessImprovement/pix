export interface ScenarioProperties {
  scenario_name: string;
  num_instances: number;
  algorithm: "HC-FLEX" | "HC-STRICT" | "TS" | "ALL";
  approach: "CA" | "AR" | "CO" | "CAAR" | "ARCA" | "ALL";
}

export interface FinalSolutionMetric {
  name: string;
  func_ev: number;
  total_explored: number;
  pareto_size: number;
  in_jp: number;
  not_in_jp: number;
  hyperarea: number;
  hausd_dist: number;
  delta_sprd: number;
  purity_rate: number;
  ave_time: number;
  ave_cost: number;
  time_metric: number;
  cost_metric: number;
}

export interface FullOutputJson {
  name: string;
  initial_solution: Solution;
  final_solutions?: Solution[];
  current_solution?: Solution;
  final_solution_metrics: FinalSolutionMetric;
  cons_params: ConsParams;
}

export interface Solution {
  solution_info: SolutionInfo;
  sim_params: SimParams;
  name: string;
  iteration: number;
}

export interface SolutionInfo {
  pools_info: PoolsInfo;
  mean_process_cycle_time: number;
  simulation_start_date: string;
  simulation_end_date: string;
  simulation_time: number;
  deviation_info: DeviationInfo;
  pool_utilization: { [key: string]: number };
  pool_time: { [key: string]: number };
  pool_cost: { [key: string]: number };
  total_pool_cost: number;
  total_pool_time: number;
  available_time: { [key: string]: number };
}

export interface DeviationInfo {
  cycle_time_deviation: number;
  execution_duration_deviation: number;
  dev_type: number;
}

export interface PoolsInfo {
  pools: { [key: string]: Resource };
  task_pools: { [key: string]: ResourceListItem[] };
  task_allocations: { [key: string]: string[] };
  id: string;
}

export interface Resource {
  id: string;
  name: string;
  time_var: number;
  total_amount: number;
  cost_per_hour: number;
  custom_id: string;
  max_weekly_cap: number;
  max_daily_cap: number;
  max_consecutive_cap: number;
  max_shifts_day: number;
  max_shifts_week: number;
  is_human: boolean;
  daily_start_times: DailyStartTimes;
  never_work_masks: ConstraintWorkMask;
  always_work_masks: ConstraintWorkMask;
  day_free_cap: ConstraintWorkMask;
  remaining_shifts: ConstraintWorkMask;
  shifts: Shift[];
  assigned_tasks: string[];
}

export interface ConstraintWorkMask {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}
export type Shift = ConstraintWorkMask & {
  total?: number;
  resource_id?: string;
};

export interface DailyStartTimes {
  monday: string | null;
  tuesday: string | null;
  wednesday: string | null;
  thursday: string | null;
  friday: string | null;
  saturday: string | null;
  sunday: string | null;
}

export interface SimParams {
  resource_profiles: ResourceProfile[];
  arrival_time_distribution: ArrivalTimeDistribution;
  arrival_time_calendar: TimePeriod[];
  gateway_branching_probabilities: GatewayBranchingProbability[];
  task_resource_distribution: TaskResourceDistribution[];
  event_distribution: EventDistribution;
  resource_calendars: ResourceCalendar[];
}

export interface ResourceProfile {
  id: string;
  name: string;
  resource_list: ResourceListItem[];
}

export interface ResourceListItem {
  id: string;
  name: string;
  cost_per_hour: number;
  amount: number;
  calendar: string;
  assigned_tasks: string[];
}

export interface ArrivalTimeDistribution {
  distribution_name: string;
  distribution_params: DistributionParam[];
}

export interface DistributionParam {
  value: number;
}

export interface GatewayBranchingProbability {
  gateway_id: string;
  probabilities: Probability[];
}

export interface Probability {
  path_id: string;
  value: number;
}

export interface TaskResourceDistribution {
  task_id: string;
  resources: Resource[];
}

export interface Resource {
  resource_id: string;
  distribution_name: string;
  distribution_params: DistributionParam2[];
}

export interface DistributionParam2 {
  value: number;
}

export interface EventDistribution {}

export interface ResourceCalendar {
  id: string;
  name: string;
  time_periods: TimePeriod[];
}

export interface TimePeriod {
  from: string;
  to: string;
  beginTime: string;
  endTime: string;
}

export interface ConsParams {
  time_var: number;
  max_cap: number;
  max_shift_size: number;
  max_shift_blocks: number;
  hours_in_day: number;
  resources: ResourceConstraints[];
}

export interface ResourceConstraints {
  id: string;
  constraints: Constraints;
}

export interface Constraints {
  global_constraints: GlobalConstraints;
  daily_start_times: DailyStartTimes;
  never_work_masks: ConstraintWorkMask;
  always_work_masks: ConstraintWorkMask;
}

export interface GlobalConstraints {
  max_weekly_cap: number;
  max_daily_cap: number;
  max_consecutive_cap: number;
  max_shifts_day: number;
  max_shifts_week: number;
  is_human: boolean;
}

// --------------------------------------------------------
// Additional combined Types
// --------------------------------------------------------

export type ResourceStats = {
  total_worktime: number;
  total_cost: number;
  utilization: number;
  available_time: number;
  tasks: string[];
  is_duplicate: boolean;
  is_deleted: boolean;
  are_tasks_different: boolean;
  are_shifts_different: boolean;
  initial_resource?: EnhancedResource;
  new_tasks: string[];
  old_tasks: string[];
  removed_tasks: string[];
};

export type EnhancedResource = Resource & ResourceStats;
