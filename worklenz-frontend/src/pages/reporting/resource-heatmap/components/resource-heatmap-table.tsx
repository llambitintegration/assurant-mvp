/**
 * Resource Heatmap Table Component
 * Alternative table view for resource utilization data
 */

import { Badge, Empty, Flex, Spin, Table, Tag, Typography } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setPage, setPageSize } from '@/features/reporting/resourceHeatmap/resourceHeatmapSlice';
import { IHeatmapResource } from '@/types/reporting/resource-heatmap.types';
import { formatPercent, getUtilizationBadgeStatus, getUtilizationColor, getUtilizationLabel } from '../utils/heatmap-utils';

const ResourceHeatmapTable = () => {
  const dispatch = useAppDispatch();
  const { resources, periodLabels, total, page, pageSize, isLoading } = useAppSelector(
    state => state.resourceHeatmapReducer
  );

  const columns: ColumnsType<IHeatmapResource> = [
    {
      title: 'Resource Name',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (name: string, record: IHeatmapResource) => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            {record.department_name || 'No Department'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'personnel' ? 'green' : 'blue'}>{type.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Avg Utilization',
      key: 'avg_utilization',
      width: 150,
      sorter: (a, b) => a.summary.avg_utilization_percent - b.summary.avg_utilization_percent,
      render: (_, record: IHeatmapResource) => {
        const avgUtil = record.summary.avg_utilization_percent;
        const status = getUtilizationBadgeStatus(avgUtil);
        return (
          <div>
            <Badge status={status} text={formatPercent(avgUtil)} />
          </div>
        );
      },
    },
    {
      title: 'Active Projects',
      dataIndex: ['summary', 'active_projects_count'],
      key: 'active_projects',
      width: 120,
      sorter: (a, b) => a.summary.active_projects_count - b.summary.active_projects_count,
    },
    {
      title: 'Total Hours',
      dataIndex: ['summary', 'total_hours_allocated'],
      key: 'total_hours',
      width: 120,
      sorter: (a, b) => a.summary.total_hours_allocated - b.summary.total_hours_allocated,
      render: (hours: number) => `${hours.toFixed(1)}h`,
    },
  ];

  const expandedRowRender = (record: IHeatmapResource) => {
    return (
      <div style={{ padding: '16px', backgroundColor: '#fafafa' }}>
        <Typography.Title level={5}>Utilization Timeline</Typography.Title>
        <Flex gap={8} style={{ marginTop: '12px', flexWrap: 'wrap' }}>
          {record.utilization_periods.map((period, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                borderRadius: '4px',
                backgroundColor: getUtilizationColor(period.utilization_percent),
                color: '#fff',
                minWidth: '120px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>
                {periodLabels[idx] || `Period ${idx + 1}`}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {formatPercent(period.utilization_percent, 0)}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '4px' }}>
                {getUtilizationLabel(period.utilization_percent)}
              </div>
            </div>
          ))}
        </Flex>
      </div>
    );
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

  return (
    <Table
      columns={columns}
      dataSource={resources}
      rowKey="id"
      expandable={{
        expandedRowRender,
        defaultExpandAllRows: false,
      }}
      pagination={{
        current: page,
        pageSize: pageSize,
        total: total,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} resources`,
        onChange: (newPage, newPageSize) => {
          dispatch(setPage(newPage));
          if (newPageSize !== pageSize) {
            dispatch(setPageSize(newPageSize));
          }
        },
      }}
      scroll={{ x: 800 }}
    />
  );
};

export default ResourceHeatmapTable;
