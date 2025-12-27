/**
 * Detail Drawer Component
 * Shows detailed information about a resource's utilization period
 */

import { Badge, Descriptions, Divider, Drawer, List, Tag, Typography } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { closeDetailDrawer } from '@/features/reporting/resourceHeatmap/resourceHeatmapSlice';
import {
  getUtilizationLabel,
  getUtilizationBadgeStatus,
  formatPercent,
  formatHours,
} from '../utils/heatmap-utils';

const DetailDrawer = () => {
  const dispatch = useAppDispatch();
  const { isDetailDrawerOpen, selectedResourceId, selectedPeriodIndex, resources } = useAppSelector(
    state => state.resourceHeatmapReducer
  );

  const selectedResource = resources.find(r => r.id === selectedResourceId);
  const selectedPeriod =
    selectedResource && selectedPeriodIndex !== null
      ? selectedResource.utilization_periods[selectedPeriodIndex]
      : null;

  if (!selectedResource || !selectedPeriod) {
    return null;
  }

  const utilizationStatus = getUtilizationLabel(selectedPeriod.utilization_percent);
  const badgeStatus = getUtilizationBadgeStatus(selectedPeriod.utilization_percent);

  const periodStart = new Date(selectedPeriod.period_start).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const periodEnd = new Date(selectedPeriod.period_end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Drawer
      title={
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {selectedResource.name}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            {selectedResource.department_name || 'No Department'}
          </Typography.Text>
        </div>
      }
      placement="right"
      onClose={() => dispatch(closeDetailDrawer())}
      open={isDetailDrawerOpen}
      width={480}
    >
      {/* Utilization Status Badge */}
      <div style={{ marginBottom: '16px' }}>
        <Badge status={badgeStatus} text={utilizationStatus} />
        <Typography.Title level={3} style={{ marginTop: '8px' }}>
          {formatPercent(selectedPeriod.utilization_percent)}
        </Typography.Title>
      </div>

      {/* Period Information */}
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Period">
          {periodStart} - {periodEnd}
        </Descriptions.Item>
        <Descriptions.Item label="Allocated Hours">
          {formatHours(selectedPeriod.allocated_hours)}
        </Descriptions.Item>
        <Descriptions.Item label="Available Hours">
          {formatHours(selectedPeriod.net_available_hours)}
        </Descriptions.Item>
        <Descriptions.Item label="Unavailable Hours">
          {formatHours(selectedPeriod.unavailable_hours)}
        </Descriptions.Item>
        <Descriptions.Item label="Total Allocation">
          {formatPercent(selectedPeriod.total_allocation_percent)}
        </Descriptions.Item>
      </Descriptions>

      {/* Project Allocations */}
      {selectedPeriod.allocations.length > 0 && (
        <>
          <Divider orientation="left">Project Allocations</Divider>
          <List
            size="small"
            dataSource={selectedPeriod.allocations}
            renderItem={allocation => (
              <List.Item>
                <List.Item.Meta
                  title={allocation.project_name}
                  description={`Allocation: ${formatPercent(allocation.allocation_percent)}`}
                />
                <Tag color="blue">{formatPercent(allocation.allocation_percent)}</Tag>
              </List.Item>
            )}
          />
        </>
      )}

      {/* Unavailability Periods */}
      {selectedPeriod.unavailabilities && selectedPeriod.unavailabilities.length > 0 && (
        <>
          <Divider orientation="left">Unavailability</Divider>
          <List
            size="small"
            dataSource={selectedPeriod.unavailabilities}
            renderItem={unavail => (
              <List.Item>
                <List.Item.Meta
                  title={unavail.unavailability_type}
                  description={`${new Date(unavail.start_date).toLocaleDateString()} - ${new Date(
                    unavail.end_date
                  ).toLocaleDateString()}`}
                />
                <Tag color="orange">{formatHours(unavail.hours)}</Tag>
              </List.Item>
            )}
          />
        </>
      )}

      {/* Resource Summary */}
      <Divider orientation="left">Resource Summary</Divider>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Resource Type">
          <Tag color={selectedResource.resource_type === 'personnel' ? 'green' : 'blue'}>
            {selectedResource.resource_type.toUpperCase()}
          </Tag>
        </Descriptions.Item>
        {selectedResource.email && <Descriptions.Item label="Email">{selectedResource.email}</Descriptions.Item>}
        <Descriptions.Item label="Average Utilization">
          {formatPercent(selectedResource.summary.avg_utilization_percent)}
        </Descriptions.Item>
        <Descriptions.Item label="Total Hours Allocated">
          {formatHours(selectedResource.summary.total_hours_allocated)}
        </Descriptions.Item>
        <Descriptions.Item label="Active Projects">{selectedResource.summary.active_projects_count}</Descriptions.Item>
      </Descriptions>
    </Drawer>
  );
};

export default DetailDrawer;
