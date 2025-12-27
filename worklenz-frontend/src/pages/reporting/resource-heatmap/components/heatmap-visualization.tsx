/**
 * Heatmap Visualization Component
 * Color-coded grid showing resource utilization over time
 */

import { Card, Empty, Flex, Spin, Tooltip, Typography } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { openDetailDrawer } from '@/features/reporting/resourceHeatmap/resourceHeatmapSlice';
import { getUtilizationColor, getUtilizationLabel, getColorLegend } from '../utils/heatmap-utils';
import DetailDrawer from './detail-drawer';

const HeatmapVisualization = () => {
  const dispatch = useAppDispatch();
  const { resources, periodLabels, isLoading } = useAppSelector(state => state.resourceHeatmapReducer);

  const handleCellClick = (resourceId: string, periodIndex: number) => {
    dispatch(openDetailDrawer({ resourceId, periodIndex }));
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (resources.length === 0) {
    return <Empty description="No resource data available for the selected filters" />;
  }

  const colorLegend = getColorLegend();

  return (
    <>
      <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
        <div style={{ minWidth: '900px' }}>
          {/* Header Row with Period Labels */}
          <Flex gap={8} style={{ marginBottom: '8px' }}>
            <div style={{ width: 280, flexShrink: 0 }}>
              <Typography.Text strong>Resource</Typography.Text>
            </div>
            {periodLabels.map(label => (
              <div
                key={label}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#666',
                }}
              >
                {label}
              </div>
            ))}
          </Flex>

          {/* Resource Rows */}
          {resources.map(resource => (
            <Flex gap={8} key={resource.id} style={{ marginBottom: '8px' }}>
              {/* Resource Info Card */}
              <Card
                size="small"
                style={{
                  width: 280,
                  flexShrink: 0,
                  cursor: 'default',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <Typography.Text strong ellipsis style={{ display: 'block' }}>
                    {resource.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                    {resource.department_name || 'No Department'}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                    Avg: {resource.summary.avg_utilization_percent.toFixed(1)}%
                  </Typography.Text>
                </div>
              </Card>

              {/* Utilization Cells */}
              {resource.utilization_periods.map((period, idx) => (
                <Tooltip
                  key={idx}
                  title={
                    <div>
                      <div>
                        <strong>{getUtilizationLabel(period.utilization_percent)}</strong>
                      </div>
                      <div>Utilization: {period.utilization_percent.toFixed(1)}%</div>
                      <div>Allocated: {period.allocated_hours.toFixed(1)}h</div>
                      <div>Available: {period.net_available_hours.toFixed(1)}h</div>
                      {period.allocations.length > 0 && (
                        <div style={{ marginTop: '4px', fontSize: '11px' }}>
                          Projects: {period.allocations.map(a => a.project_name).join(', ')}
                        </div>
                      )}
                    </div>
                  }
                >
                  <div
                    onClick={() => handleCellClick(resource.id, idx)}
                    style={{
                      flex: 1,
                      height: 60,
                      backgroundColor: getUtilizationColor(period.utilization_percent),
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      border: '1px solid rgba(0,0,0,0.1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <Typography.Text
                      strong
                      style={{
                        color: '#fff',
                        fontSize: '14px',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}
                    >
                      {period.utilization_percent.toFixed(0)}%
                    </Typography.Text>
                  </div>
                </Tooltip>
              ))}
            </Flex>
          ))}

          {/* Legend */}
          <Flex gap={16} justify="center" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            {colorLegend.map(({ label, color }) => (
              <Flex align="center" gap={8} key={label}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    backgroundColor: color,
                    borderRadius: 2,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                />
                <Typography.Text style={{ fontSize: '12px' }}>{label}</Typography.Text>
              </Flex>
            ))}
          </Flex>
        </div>
      </div>

      <DetailDrawer />
    </>
  );
};

export default HeatmapVisualization;
