/**
 * Heatmap Service
 * Handles business logic for resource capacity heatmap visualization
 */

import prisma from "../../config/prisma";
import {
  IHeatmapFilters,
  IHeatmapResponse,
  IHeatmapResource,
  IUtilizationPeriod,
  ITimePeriod,
  IAllocationDetail,
  IUnavailabilityDetail,
  ITaskDetail
} from "../../interfaces/rcm/heatmap.interface";

/**
 * Get heatmap data with utilization calculations
 */
export async function getHeatmapData(
  filters: IHeatmapFilters,
  teamId: string
): Promise<IHeatmapResponse> {
  // Validate dates
  if (!filters.start_date || !filters.end_date) {
    throw new Error("Start date and end date are required");
  }

  const startDate = new Date(filters.start_date);
  const endDate = new Date(filters.end_date);

  if (startDate >= endDate) {
    throw new Error("End date must be after start date");
  }

  // Generate time periods based on granularity
  const timePeriods = generateTimePeriods(startDate, endDate, filters.granularity);
  const periodLabels = timePeriods.map(p => p.label);

  // Build resource query
  const page = filters.page || 1;
  const size = filters.size || 20;
  const skip = (page - 1) * size;

  const resourceWhere: any = {
    team_id: teamId,
    is_active: true
  };

  // Filter by resource types
  if (filters.resource_types && filters.resource_types.length > 0) {
    resourceWhere.resource_type = {
      in: filters.resource_types
    };
  }

  // Filter by departments (using the junction table)
  if (filters.department_ids && filters.department_ids.length > 0) {
    resourceWhere.department_assignments = {
      some: {
        department_id: {
          in: filters.department_ids
        }
      }
    };
  }

  // Get resources with pagination
  const [resources, totalResources] = await Promise.all([
    prisma.rcm_resources.findMany({
      where: resourceWhere,
      skip,
      take: size,
      include: {
        department_assignments: {
          where: {
            is_primary: true
          },
          include: {
            department: {
              select: {
                name: true
              }
            }
          },
          take: 1
        }
      },
      orderBy: [
        { first_name: 'asc' },
        { last_name: 'asc' },
        { equipment_name: 'asc' }
      ]
    }),
    prisma.rcm_resources.count({ where: resourceWhere })
  ]);

  // Calculate utilization for each resource
  const heatmapResources: IHeatmapResource[] = await Promise.all(
    resources.map(async (resource) => {
      // Get all data in parallel
      const [allocations, availabilityRecords, unavailabilityPeriods] = await Promise.all([
        getResourceAllocations(resource.id, startDate, endDate, filters.project_id),
        getResourceAvailability(resource.id),
        filters.include_unavailability
          ? getResourceUnavailability(resource.id, startDate, endDate)
          : Promise.resolve([])
      ]);

      // Get tasks if requested and resource has email (personnel only)
      let tasksByProject: Map<string, ITaskDetail[]> | undefined;
      if (filters.include_tasks && resource.email && allocations.length > 0) {
        const projectIds = [...new Set(allocations.map(a => a.project_id))];
        tasksByProject = await getResourceTasks(resource.email, projectIds, startDate, endDate);
      }

      // Calculate utilization for each time period
      const utilizationPeriods = timePeriods.map(period => {
        return calculateUtilizationForPeriod(
          period,
          allocations,
          availabilityRecords,
          unavailabilityPeriods,
          tasksByProject
        );
      });

      // Calculate summary statistics
      const totalHoursAllocated = utilizationPeriods.reduce(
        (sum, p) => sum + p.allocated_hours,
        0
      );

      const avgUtilization = utilizationPeriods.length > 0
        ? utilizationPeriods.reduce((sum, p) => sum + p.utilization_percent, 0) / utilizationPeriods.length
        : 0;

      const activeProjectIds = new Set(
        utilizationPeriods.flatMap(p => p.allocations.map(a => a.project_id))
      );

      const primaryDepartment = resource.department_assignments?.[0];

      return {
        id: resource.id,
        resource_type: resource.resource_type as 'personnel' | 'equipment',
        name: resource.resource_type === 'personnel'
          ? `${resource.first_name || ''} ${resource.last_name || ''}`.trim()
          : resource.equipment_name || '',
        email: resource.email || undefined,
        department_id: primaryDepartment?.department_id || undefined,
        department_name: primaryDepartment?.department?.name || undefined,
        utilization_periods: utilizationPeriods,
        summary: {
          avg_utilization_percent: avgUtilization,
          total_hours_allocated: totalHoursAllocated,
          active_projects_count: activeProjectIds.size
        }
      };
    })
  );

  const totalPages = Math.ceil(totalResources / size);

  return {
    resources: heatmapResources,
    period_labels: periodLabels,
    total: totalResources,
    page,
    totalPages
  };
}

/**
 * Generate time periods based on granularity
 */
export function generateTimePeriods(
  startDate: Date,
  endDate: Date,
  granularity: 'daily' | 'weekly' | 'monthly'
): ITimePeriod[] {
  const periods: ITimePeriod[] = [];
  let currentStart = new Date(startDate);

  while (currentStart < endDate) {
    let currentEnd: Date;
    let label: string;

    if (granularity === 'daily') {
      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + 1);
      label = currentStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (granularity === 'weekly') {
      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + 7);
      const weekEnd = new Date(currentEnd);
      weekEnd.setDate(weekEnd.getDate() - 1);
      label = `${currentStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else { // monthly
      currentEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 1);
      label = currentStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    // Don't go beyond end date
    if (currentEnd > endDate) {
      currentEnd = endDate;
    }

    periods.push({
      start: new Date(currentStart),
      end: currentEnd,
      label
    });

    currentStart = currentEnd;
  }

  return periods;
}

/**
 * Get allocations for a resource in a date range
 */
export async function getResourceAllocations(
  resourceId: string,
  startDate: Date,
  endDate: Date,
  projectId?: string
): Promise<any[]> {
  const where: any = {
    resource_id: resourceId,
    is_active: true,
    AND: [
      {
        start_date: { lt: endDate }
      },
      {
        end_date: { gt: startDate }
      }
    ]
  };

  if (projectId) {
    where.project_id = projectId;
  }

  const allocations = await prisma.rcm_allocations.findMany({
    where
  });

  // Fetch project names and colors separately (projects table is ignored in Prisma)
  const projectIds = [...new Set(allocations.map(a => a.project_id))];
  const projects = await prisma.$queryRaw<Array<{id: string; name: string; color_code: string}>>`
    SELECT id, name, color_code FROM projects WHERE id = ANY(${projectIds}::uuid[])
  `;

  const projectMap = new Map(projects.map(p => [p.id, { name: p.name, color: p.color_code }]));

  // Attach project names and colors to allocations
  return allocations.map(alloc => {
    const project = projectMap.get(alloc.project_id);
    return {
      ...alloc,
      project_name: project?.name || `Project ${alloc.project_id.slice(0, 8)}`,
      project_color: project?.color || '#1890ff'
    };
  });
}

/**
 * Get tasks assigned to a resource for specific projects within a date range
 * Includes subtasks nested under their parent tasks
 */
export async function getResourceTasks(
  resourceEmail: string,
  projectIds: string[],
  _startDate: Date,
  _endDate: Date
): Promise<Map<string, ITaskDetail[]>> {
  if (!resourceEmail || projectIds.length === 0) {
    return new Map();
  }

  // Query ALL tasks and subtasks assigned to the resource in the allocated projects
  // Note: We don't filter by date - show all tasks the resource is assigned to in these projects
  // This gives visibility into the full scope of work for allocations
  const tasks = await prisma.$queryRaw<Array<{
    task_id: string;
    task_name: string;
    project_id: string;
    parent_task_id: string | null;
    status_name: string;
    status_color: string;
    priority_name: string;
    priority_color: string;
    start_date: Date | null;
    end_date: Date | null;
    total_minutes: number;
  }>>`
    SELECT 
      t.id as task_id,
      t.name as task_name,
      t.project_id,
      t.parent_task_id,
      COALESCE(ts.name, 'Unknown') as status_name,
      COALESCE(ts.color_code, '#808080') as status_color,
      COALESCE(tp.name, 'None') as priority_name,
      COALESCE(tp.color_code, '#808080') as priority_color,
      t.start_date,
      t.end_date,
      COALESCE(t.total_minutes, 0) as total_minutes
    FROM tasks t
    INNER JOIN tasks_assignees ta ON t.id = ta.task_id
    INNER JOIN team_members tm ON ta.team_member_id = tm.id
    INNER JOIN users u ON tm.user_id = u.id
    LEFT JOIN task_statuses ts ON t.status_id = ts.id
    LEFT JOIN task_priorities tp ON t.priority_id = tp.id
    WHERE u.email = ${resourceEmail}
      AND t.project_id = ANY(${projectIds}::uuid[])
    ORDER BY t.parent_task_id NULLS FIRST, t.start_date ASC NULLS LAST, t.name ASC
  `;

  // Build task map for nesting subtasks
  const taskMap = new Map<string, ITaskDetail>();
  const tasksByProject = new Map<string, ITaskDetail[]>();
  
  // First pass: create all task details
  for (const task of tasks) {
    const taskDetail: ITaskDetail = {
      task_id: task.task_id,
      task_name: task.task_name,
      status_name: task.status_name,
      status_color: task.status_color,
      priority_name: task.priority_name,
      priority_color: task.priority_color,
      start_date: task.start_date?.toISOString(),
      end_date: task.end_date?.toISOString(),
      estimated_hours: undefined,
      logged_hours: task.total_minutes > 0 ? task.total_minutes / 60 : undefined,
      parent_task_id: task.parent_task_id || undefined,
      subtasks: []
    };

    taskMap.set(task.task_id, taskDetail);
  }

  // Track which tasks are subtasks that should be nested (not shown at top level)
  const nestedSubtaskIds = new Set<string>();

  // Second pass: identify and nest subtasks under their parents
  for (const task of tasks) {
    if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
      // This is a subtask with parent in our result set - nest it
      const taskDetail = taskMap.get(task.task_id)!;
      const parentTask = taskMap.get(task.parent_task_id)!;
      if (!parentTask.subtasks) parentTask.subtasks = [];
      parentTask.subtasks.push(taskDetail);
      nestedSubtaskIds.add(task.task_id);
    }
  }

  // Third pass: add only top-level tasks to project list (excluding nested subtasks)
  for (const task of tasks) {
    if (!nestedSubtaskIds.has(task.task_id)) {
      const taskDetail = taskMap.get(task.task_id)!;
      const projectTasks = tasksByProject.get(task.project_id) || [];
      projectTasks.push(taskDetail);
      tasksByProject.set(task.project_id, projectTasks);
    }
  }

  // Clean up empty subtask arrays
  for (const [_, projectTasks] of tasksByProject) {
    for (const task of projectTasks) {
      if (task.subtasks && task.subtasks.length === 0) {
        delete task.subtasks;
      }
    }
  }

  return tasksByProject;
}

/**
 * Get availability records for a resource
 */
export async function getResourceAvailability(resourceId: string): Promise<any[]> {
  const availability = await prisma.rcm_availability.findMany({
    where: {
      resource_id: resourceId
    },
    orderBy: {
      effective_from: 'desc'
    }
  });

  return availability;
}

/**
 * Get unavailability periods for a resource
 */
export async function getResourceUnavailability(
  resourceId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const unavailability = await prisma.rcm_unavailability_periods.findMany({
    where: {
      resource_id: resourceId,
      AND: [
        {
          start_date: { lt: endDate }
        },
        {
          end_date: { gt: startDate }
        }
      ]
    }
  });

  return unavailability;
}

/**
 * Calculate utilization for a specific time period
 */
export function calculateUtilizationForPeriod(
  period: ITimePeriod,
  allocations: any[],
  availabilityRecords: any[],
  unavailabilityPeriods: any[],
  tasksByProject?: Map<string, ITaskDetail[]>
): IUtilizationPeriod {
  // Filter allocations that overlap with this period
  const periodAllocations = allocations.filter(alloc => {
    return alloc.start_date < period.end && alloc.end_date > period.start;
  });

  // Calculate total allocation percentage (can exceed 100%)
  const totalAllocationPercent = periodAllocations.reduce((sum, alloc) => {
    return sum + Number(alloc.allocation_percent);
  }, 0);

  // Get allocation details with tasks
  const allocationDetails: IAllocationDetail[] = periodAllocations.map(alloc => ({
    project_id: alloc.project_id,
    project_name: alloc.project_name || 'Unknown Project',
    project_color: alloc.project_color,
    allocation_percent: Number(alloc.allocation_percent),
    tasks: tasksByProject?.get(alloc.project_id)
  }));

  // Calculate available hours for this period
  const periodDays = calculateDaysBetween(period.start, period.end);

  // Default to 40 hours/week if no availability records
  let weeklyHours = 40;
  if (availabilityRecords.length > 0) {
    // Use the most recent availability record
    const latestAvailability = availabilityRecords[availabilityRecords.length - 1];
    weeklyHours = Number(latestAvailability.total_hours_per_week);
  }

  const grossHoursAvailable = (weeklyHours / 7) * periodDays;

  // Calculate unavailable hours
  let unavailableHours = 0;
  const unavailabilityDetails: IUnavailabilityDetail[] = [];

  unavailabilityPeriods.forEach(unav => {
    // Calculate overlap between unavailability and period
    const overlapStart = unav.start_date > period.start ? unav.start_date : period.start;
    const overlapEnd = unav.end_date < period.end ? unav.end_date : period.end;

    if (overlapStart < overlapEnd) {
      const overlapDays = calculateDaysBetween(overlapStart, overlapEnd);
      const hoursLost = (weeklyHours / 7) * overlapDays;
      unavailableHours += hoursLost;

      unavailabilityDetails.push({
        unavailability_id: unav.id,
        unavailability_type: unav.unavailability_type,
        start_date: unav.start_date.toISOString(),
        end_date: unav.end_date.toISOString(),
        hours: hoursLost
      });
    }
  });

  // Calculate net available hours
  const netAvailableHours = Math.max(0, grossHoursAvailable - unavailableHours);

  // Calculate allocated hours
  const allocatedHours = (netAvailableHours * totalAllocationPercent) / 100;

  // Calculate utilization percentage
  const utilizationPercent = netAvailableHours > 0
    ? (allocatedHours / netAvailableHours) * 100
    : 0;

  // Determine status
  const status = getUtilizationStatus(utilizationPercent);

  return {
    period_start: period.start.toISOString(),
    period_end: period.end.toISOString(),
    total_allocation_percent: totalAllocationPercent,
    net_available_hours: netAvailableHours,
    allocated_hours: allocatedHours,
    unavailable_hours: unavailableHours,
    utilization_percent: utilizationPercent,
    status,
    allocations: allocationDetails,
    unavailabilities: unavailabilityDetails.length > 0 ? unavailabilityDetails : undefined
  };
}

/**
 * Get utilization status based on percentage
 */
export function getUtilizationStatus(utilizationPercent: number): 'OVERUTILIZED' | 'OPTIMAL' | 'AVERAGE' | 'UNDERUTILIZED' | 'AVAILABLE' {
  if (utilizationPercent >= 100) return 'OVERUTILIZED';
  if (utilizationPercent >= 80) return 'OPTIMAL';
  if (utilizationPercent >= 60) return 'AVERAGE';
  if (utilizationPercent >= 40) return 'UNDERUTILIZED';
  return 'AVAILABLE';
}

/**
 * Calculate the number of days between two dates
 */
export function calculateDaysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffMs = end.getTime() - start.getTime();
  return diffMs / msPerDay;
}
