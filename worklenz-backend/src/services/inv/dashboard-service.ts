/**
 * Dashboard Service
 * Handles business logic for inventory analytics and low stock alerts
 */

import prisma from "../../config/prisma";
import { IDashboardStats, ILowStockAlert } from "../../interfaces/inv/dashboard.interface";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Get comprehensive dashboard statistics
 * Runs all aggregations in parallel for optimal performance
 */
export async function getDashboardStats(teamId: string): Promise<IDashboardStats> {
  // Run all aggregations in parallel
  const [
    totalComponents,
    totalActiveComponents,
    totalInventoryValue,
    lowStockAlerts,
    totalSuppliers,
    totalActiveSuppliers,
    totalStorageLocations,
    totalActiveStorageLocations,
    recentTransactionsCount
  ] = await Promise.all([
    // 1. Total components (all)
    prisma.inv_components.count({
      where: {
        team_id: teamId
      }
    }),

    // 2. Total active components
    prisma.inv_components.count({
      where: {
        team_id: teamId,
        is_active: true
      }
    }),

    // 3. Total inventory value (sum of quantity * unit_cost)
    calculateTotalInventoryValue(teamId),

    // 4. Low stock alerts (detailed)
    getLowStockAlerts(teamId),

    // 5. Total suppliers (all)
    prisma.inv_suppliers.count({
      where: {
        team_id: teamId
      }
    }),

    // 6. Total active suppliers
    prisma.inv_suppliers.count({
      where: {
        team_id: teamId,
        is_active: true
      }
    }),

    // 7. Total storage locations (all)
    prisma.inv_storage_locations.count({
      where: {
        team_id: teamId
      }
    }),

    // 8. Total active storage locations
    prisma.inv_storage_locations.count({
      where: {
        team_id: teamId,
        is_active: true
      }
    }),

    // 9. Recent transactions count (last 30 days)
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count
      FROM inv_transactions
      WHERE team_id = ${teamId}::uuid
        AND created_at >= NOW() - INTERVAL '30 days'
    `.then(result => Number(result[0]?.count || 0))
  ]);

  return {
    total_components: totalComponents,
    total_active_components: totalActiveComponents,
    total_inventory_value: totalInventoryValue,
    low_stock_count: lowStockAlerts.length,
    total_suppliers: totalSuppliers,
    total_active_suppliers: totalActiveSuppliers,
    total_storage_locations: totalStorageLocations,
    total_active_storage_locations: totalActiveStorageLocations,
    recent_transactions_count: recentTransactionsCount
  };
}

/**
 * Calculate total inventory value (quantity * unit_cost for all components)
 */
async function calculateTotalInventoryValue(teamId: string): Promise<number> {
  // Use raw query to calculate sum(quantity * unit_cost)
  const result = await prisma.$queryRaw<Array<{ total_value: Decimal | null }>>`
    SELECT
      COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0) as total_value
    FROM inv_components
    WHERE team_id = ${teamId}::uuid
      AND is_active = true
  `;

  if (!result || result.length === 0 || result[0].total_value === null) {
    return 0;
  }

  // Convert Decimal to number
  const totalValue = result[0].total_value;
  return typeof totalValue === 'number' ? totalValue : Number(totalValue.toString());
}

/**
 * Get low stock alerts with detailed information
 * Returns components where quantity <= reorder_level, sorted by urgency
 */
async function getLowStockAlerts(teamId: string): Promise<ILowStockAlert[]> {
  const alerts = await prisma.$queryRaw<Array<{
    component_id: string;
    component_name: string;
    sku: string | null;
    category: string | null;
    current_quantity: number;
    reorder_level: number;
    unit: string | null;
    stock_percentage: number;
    quantity_needed: number;
    supplier_id: string | null;
    supplier_name: string | null;
    storage_location_id: string | null;
    storage_location_name: string | null;
    unit_cost: Decimal | null;
  }>>`
    SELECT
      c.id as component_id,
      c.name as component_name,
      c.sku,
      c.category,
      c.quantity as current_quantity,
      c.reorder_level,
      c.unit,
      CASE
        WHEN c.reorder_level > 0 THEN (c.quantity::float / c.reorder_level) * 100
        ELSE 100
      END as stock_percentage,
      CASE
        WHEN c.quantity < c.reorder_level THEN c.reorder_level - c.quantity
        ELSE 0
      END as quantity_needed,
      c.supplier_id,
      s.name as supplier_name,
      c.storage_location_id,
      sl.name as storage_location_name,
      c.unit_cost
    FROM inv_components c
    LEFT JOIN inv_suppliers s ON c.supplier_id = s.id
    LEFT JOIN inv_storage_locations sl ON c.storage_location_id = sl.id
    WHERE c.team_id = ${teamId}::uuid
      AND c.is_active = true
      AND c.reorder_level IS NOT NULL
      AND c.quantity <= c.reorder_level
    ORDER BY stock_percentage ASC
    LIMIT 20
  `;

  // Map to interface format and calculate estimated reorder cost
  return alerts.map(alert => ({
    component_id: alert.component_id,
    component_name: alert.component_name,
    sku: alert.sku,
    category: alert.category,
    current_quantity: alert.current_quantity,
    reorder_level: alert.reorder_level,
    unit: alert.unit,
    stock_percentage: alert.stock_percentage,
    quantity_needed: alert.quantity_needed,
    supplier_id: alert.supplier_id,
    supplier_name: alert.supplier_name,
    storage_location_id: alert.storage_location_id,
    storage_location_name: alert.storage_location_name,
    unit_cost: alert.unit_cost,
    estimated_reorder_cost: alert.unit_cost && alert.quantity_needed > 0
      ? Number(alert.unit_cost.toString()) * alert.quantity_needed
      : undefined
  }));
}

/**
 * Get inventory value breakdown by category
 */
export async function getInventoryValueByCategory(teamId: string): Promise<Array<{
  category: string | null;
  total_quantity: number;
  total_value: number;
  component_count: number;
  average_unit_cost?: number;
}>> {
  const results = await prisma.$queryRaw<Array<{
    category: string | null;
    total_quantity: bigint;
    total_value: Decimal | null;
    component_count: bigint;
  }>>`
    SELECT
      COALESCE(category, 'Uncategorized') as category,
      SUM(quantity)::bigint as total_quantity,
      SUM(quantity * COALESCE(unit_cost, 0)) as total_value,
      COUNT(*)::bigint as component_count
    FROM inv_components
    WHERE team_id = ${teamId}::uuid
      AND is_active = true
    GROUP BY category
    ORDER BY total_value DESC
  `;

  return results.map(result => {
    const totalValue = result.total_value
      ? (typeof result.total_value === 'number' ? result.total_value : Number(result.total_value.toString()))
      : 0;
    const totalQuantity = Number(result.total_quantity);
    const componentCount = Number(result.component_count);

    return {
      category: result.category,
      total_quantity: totalQuantity,
      total_value: totalValue,
      component_count: componentCount,
      average_unit_cost: totalQuantity > 0 ? totalValue / totalQuantity : undefined
    };
  });
}
