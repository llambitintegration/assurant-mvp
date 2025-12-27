/**
 * Heatmap Utility Functions
 * Helper functions for resource capacity heatmap
 */

/**
 * Get color for utilization percentage
 * Red (≥100%): Overutilized
 * Green (80-100%): Optimal
 * Yellow (60-80%): Average
 * Pink (40-60%): Underutilized
 * Blue (<40%): Available
 */
export function getUtilizationColor(utilizationPercent: number): string {
  if (utilizationPercent >= 100) return '#ef4444'; // red-500
  if (utilizationPercent >= 80) return '#22c55e'; // green-500
  if (utilizationPercent >= 60) return '#eab308'; // yellow-500
  if (utilizationPercent >= 40) return '#ec4899'; // pink-500
  return '#60a5fa'; // blue-400
}

/**
 * Get label for utilization percentage
 */
export function getUtilizationLabel(utilizationPercent: number): string {
  if (utilizationPercent >= 100) return 'Overutilized';
  if (utilizationPercent >= 80) return 'Optimal';
  if (utilizationPercent >= 60) return 'Average';
  if (utilizationPercent >= 40) return 'Underutilized';
  return 'Available';
}

/**
 * Get utilization status badge color for ANT Design
 */
export function getUtilizationBadgeStatus(
  utilizationPercent: number
): 'error' | 'success' | 'warning' | 'processing' | 'default' {
  if (utilizationPercent >= 100) return 'error';
  if (utilizationPercent >= 80) return 'success';
  if (utilizationPercent >= 60) return 'warning';
  if (utilizationPercent >= 40) return 'processing';
  return 'default';
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format hours for display
 */
export function formatHours(hours: number, decimals: number = 1): string {
  return `${hours.toFixed(decimals)}h`;
}

/**
 * Get color legend data for heatmap
 */
export function getColorLegend() {
  return [
    { label: 'Overutilized (≥100%)', color: '#ef4444' },
    { label: 'Optimal (80-100%)', color: '#22c55e' },
    { label: 'Average (60-80%)', color: '#eab308' },
    { label: 'Underutilized (40-60%)', color: '#ec4899' },
    { label: 'Available (<40%)', color: '#60a5fa' },
  ];
}

/**
 * Calculate summary statistics for resources
 */
export function calculateSummaryStats(resources: any[]) {
  if (resources.length === 0) {
    return {
      totalResources: 0,
      avgUtilization: 0,
      overutilizedCount: 0,
      totalAvailableHours: 0,
    };
  }

  const totalResources = resources.length;

  const totalUtilization = resources.reduce(
    (sum, resource) => sum + resource.summary.avg_utilization_percent,
    0
  );
  const avgUtilization = totalUtilization / totalResources;

  const overutilizedCount = resources.filter(
    resource => resource.summary.avg_utilization_percent >= 100
  ).length;

  const totalAvailableHours = resources.reduce(
    (sum, resource) => {
      const totalNetHours = resource.utilization_periods.reduce(
        (periodSum: number, period: any) => periodSum + period.net_available_hours,
        0
      );
      return sum + totalNetHours;
    },
    0
  );

  return {
    totalResources,
    avgUtilization,
    overutilizedCount,
    totalAvailableHours,
  };
}
