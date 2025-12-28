/**
 * Heatmap Interface
 * Type definitions for resource capacity heatmap feature
 */

export interface IHeatmapFilters {
  start_date: string;
  end_date: string;
  granularity: 'daily' | 'weekly' | 'monthly';
  department_ids?: string[];
  resource_types?: ('personnel' | 'equipment')[];
  project_id?: string;
  include_unavailability?: boolean;
  include_tasks?: boolean;
  page?: number;
  size?: number;
}

export interface ITaskDetail {
  task_id: string;
  task_name: string;
  status_name: string;
  status_color: string;
  priority_name: string;
  priority_color: string;
  start_date?: string;
  end_date?: string;
  estimated_hours?: number;
  logged_hours?: number;
  parent_task_id?: string;
  subtasks?: ITaskDetail[];
}

export interface IAllocationDetail {
  project_id: string;
  project_name: string;
  project_color?: string;
  allocation_percent: number;
  tasks?: ITaskDetail[];
}

export interface IUnavailabilityDetail {
  unavailability_id: string;
  unavailability_type: string;
  start_date: string;
  end_date: string;
  hours: number;
}

export interface IUtilizationPeriod {
  period_start: string;
  period_end: string;
  total_allocation_percent: number;
  net_available_hours: number;
  allocated_hours: number;
  unavailable_hours: number;
  utilization_percent: number;
  status: 'OVERUTILIZED' | 'OPTIMAL' | 'AVERAGE' | 'UNDERUTILIZED' | 'AVAILABLE';
  allocations: IAllocationDetail[];
  unavailabilities?: IUnavailabilityDetail[];
}

export interface IHeatmapResource {
  id: string;
  resource_type: 'personnel' | 'equipment';
  name: string;
  email?: string;
  department_id?: string;
  department_name?: string;
  utilization_periods: IUtilizationPeriod[];
  summary: {
    avg_utilization_percent: number;
    total_hours_allocated: number;
    active_projects_count: number;
  };
}

export interface IHeatmapResponse {
  resources: IHeatmapResource[];
  period_labels: string[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ITimePeriod {
  start: Date;
  end: Date;
  label: string;
}
