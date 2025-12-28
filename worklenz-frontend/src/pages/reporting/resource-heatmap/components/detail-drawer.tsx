/**
 * Detail Drawer Component
 * Shows detailed information about a resource's utilization period using ProComponents
 */

import { useState } from 'react';
import { Drawer, Tag, Typography, Empty, Collapse, Badge as AntBadge } from '@/shared/antd-imports';
import { StatisticCard, ProCard, ProList } from '@ant-design/pro-components';
import { 
  ProjectOutlined, 
  ClockCircleOutlined, 
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { closeDetailDrawer } from '@/features/reporting/resourceHeatmap/resourceHeatmapSlice';
import {
  getUtilizationLabel,
  getUtilizationColor,
  formatPercent,
  formatHours,
} from '../utils/heatmap-utils';
import { IAllocationDetail, ITaskDetail } from '@/types/reporting/resource-heatmap.types';

const { Statistic, Divider: StatDivider } = StatisticCard;

const DetailDrawer = () => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState('projects');
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
  const utilizationColor = getUtilizationColor(selectedPeriod.utilization_percent);

  const periodStart = new Date(selectedPeriod.period_start).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const periodEnd = new Date(selectedPeriod.period_end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const totalTasks = selectedPeriod.allocations.reduce(
    (sum, alloc) => sum + (alloc.tasks?.length || 0),
    0
  );

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('done') || statusLower.includes('complete')) {
      return 'success';
    }
    if (statusLower.includes('progress') || statusLower.includes('doing')) {
      return 'processing';
    }
    if (statusLower.includes('block') || statusLower.includes('issue')) {
      return 'error';
    }
    return 'default';
  };

  const renderTaskItem = (task: ITaskDetail) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '8px 12px',
      borderBottom: '1px solid #f0f0f0'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AntBadge status={getStatusBadge(task.status_name)} />
          <Typography.Text ellipsis style={{ maxWidth: '200px' }}>
            {task.task_name}
          </Typography.Text>
        </div>
        <div style={{ marginTop: '4px' }}>
          <Tag 
            color={task.status_color} 
            style={{ fontSize: '11px', marginRight: '4px' }}
          >
            {task.status_name}
          </Tag>
          {task.priority_name !== 'None' && (
            <Tag 
              color={task.priority_color}
              style={{ fontSize: '11px' }}
            >
              {task.priority_name}
            </Tag>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
        {task.end_date && (
          <div>
            <CalendarOutlined style={{ marginRight: '4px' }} />
            {new Date(task.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
        {task.logged_hours !== undefined && task.logged_hours > 0 && (
          <div>
            <ClockCircleOutlined style={{ marginRight: '4px' }} />
            {task.logged_hours.toFixed(1)}h logged
          </div>
        )}
      </div>
    </div>
  );

  const renderProjectAllocation = (allocation: IAllocationDetail) => {
    const taskCount = allocation.tasks?.length || 0;
    
    return (
      <Collapse.Panel
        key={allocation.project_id}
        header={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '2px', 
                  backgroundColor: allocation.project_color || '#1890ff' 
                }} 
              />
              <Typography.Text strong>{allocation.project_name}</Typography.Text>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Tag color="blue">{formatPercent(allocation.allocation_percent)}</Tag>
              {taskCount > 0 && (
                <Tag color="default">{taskCount} task{taskCount !== 1 ? 's' : ''}</Tag>
              )}
            </div>
          </div>
        }
      >
        {allocation.tasks && allocation.tasks.length > 0 ? (
          <div style={{ marginTop: '-12px' }}>
            {allocation.tasks.map(task => (
              <div key={task.task_id}>
                {renderTaskItem(task)}
              </div>
            ))}
          </div>
        ) : (
          <Empty 
            description="No tasks assigned in this period" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '16px 0' }}
          />
        )}
      </Collapse.Panel>
    );
  };

  return (
    <Drawer
      title={
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {selectedResource.name}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            {selectedResource.department_name || 'No Department'} · {periodStart} - {periodEnd}
          </Typography.Text>
        </div>
      }
      placement="right"
      onClose={() => dispatch(closeDetailDrawer())}
      open={isDetailDrawerOpen}
      width={520}
      styles={{ body: { padding: '16px' } }}
    >
      <StatisticCard.Group direction="row">
        <StatisticCard
          statistic={{
            title: 'Utilization',
            value: selectedPeriod.utilization_percent,
            suffix: '%',
            valueStyle: { color: utilizationColor },
            description: (
              <Statistic 
                title="Status" 
                value={utilizationStatus} 
                layout="horizontal"
              />
            ),
          }}
        />
        <StatDivider type="vertical" />
        <StatisticCard
          statistic={{
            title: 'Allocated',
            value: selectedPeriod.allocated_hours.toFixed(1),
            suffix: 'h',
            description: (
              <Statistic 
                title="of available" 
                value={selectedPeriod.net_available_hours.toFixed(1)} 
                suffix="h"
                layout="horizontal"
              />
            ),
          }}
        />
        <StatDivider type="vertical" />
        <StatisticCard
          statistic={{
            title: 'Projects',
            value: selectedPeriod.allocations.length,
            description: (
              <Statistic 
                title="Tasks" 
                value={totalTasks} 
                layout="horizontal"
              />
            ),
          }}
        />
      </StatisticCard.Group>

      <ProCard
        tabs={{
          activeKey: activeTab,
          onChange: setActiveTab,
          items: [
            {
              key: 'projects',
              label: (
                <span>
                  <ProjectOutlined /> Projects & Tasks
                </span>
              ),
              children: (
                <div style={{ marginTop: '8px' }}>
                  {selectedPeriod.allocations.length > 0 ? (
                    <Collapse 
                      defaultActiveKey={selectedPeriod.allocations.map(a => a.project_id)}
                      ghost
                      style={{ background: '#fafafa', borderRadius: '8px' }}
                    >
                      {selectedPeriod.allocations.map(allocation => renderProjectAllocation(allocation))}
                    </Collapse>
                  ) : (
                    <Empty description="No project allocations for this period" />
                  )}
                </div>
              ),
            },
            {
              key: 'time',
              label: (
                <span>
                  <ClockCircleOutlined /> Time Breakdown
                </span>
              ),
              children: (
                <div style={{ marginTop: '16px' }}>
                  <ProList<{label: string; value: string; icon: React.ReactNode}>
                    ghost
                    dataSource={[
                      {
                        label: 'Period',
                        value: `${periodStart} - ${periodEnd}`,
                        icon: <CalendarOutlined style={{ color: '#1890ff' }} />
                      },
                      {
                        label: 'Total Allocation',
                        value: formatPercent(selectedPeriod.total_allocation_percent),
                        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      },
                      {
                        label: 'Allocated Hours',
                        value: formatHours(selectedPeriod.allocated_hours),
                        icon: <ClockCircleOutlined style={{ color: '#1890ff' }} />
                      },
                      {
                        label: 'Available Hours',
                        value: formatHours(selectedPeriod.net_available_hours),
                        icon: <ClockCircleOutlined style={{ color: '#52c41a' }} />
                      },
                      {
                        label: 'Unavailable Hours',
                        value: formatHours(selectedPeriod.unavailable_hours),
                        icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                      },
                    ]}
                    metas={{
                      title: {
                        dataIndex: 'label',
                      },
                      description: {
                        dataIndex: 'value',
                        render: (_, row) => (
                          <Typography.Text strong>{row.value}</Typography.Text>
                        ),
                      },
                      avatar: {
                        dataIndex: 'icon',
                        render: (_, row) => row.icon,
                      },
                    }}
                  />

                  {selectedPeriod.unavailabilities && selectedPeriod.unavailabilities.length > 0 && (
                    <>
                      <Typography.Title level={5} style={{ marginTop: '16px', marginBottom: '8px' }}>
                        Unavailability Periods
                      </Typography.Title>
                      <ProList
                        ghost
                        dataSource={selectedPeriod.unavailabilities.map(u => ({
                          title: u.unavailability_type,
                          description: `${new Date(u.start_date).toLocaleDateString()} - ${new Date(u.end_date).toLocaleDateString()}`,
                          hours: u.hours,
                        }))}
                        metas={{
                          title: {
                            dataIndex: 'title',
                          },
                          description: {
                            dataIndex: 'description',
                          },
                          extra: {
                            render: (_, row) => (
                              <Tag color="orange">{formatHours(row.hours)}</Tag>
                            ),
                          },
                        }}
                      />
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'summary',
              label: 'Resource Summary',
              children: (
                <div style={{ marginTop: '16px' }}>
                  <ProList
                    ghost
                    dataSource={[
                      {
                        label: 'Resource Type',
                        value: selectedResource.resource_type.toUpperCase(),
                        tag: true,
                        tagColor: selectedResource.resource_type === 'personnel' ? 'green' : 'blue',
                      },
                      ...(selectedResource.email ? [{
                        label: 'Email',
                        value: selectedResource.email,
                        tag: false,
                        tagColor: '',
                      }] : []),
                      {
                        label: 'Average Utilization',
                        value: formatPercent(selectedResource.summary.avg_utilization_percent),
                        tag: false,
                        tagColor: '',
                      },
                      {
                        label: 'Total Hours Allocated',
                        value: formatHours(selectedResource.summary.total_hours_allocated),
                        tag: false,
                        tagColor: '',
                      },
                      {
                        label: 'Active Projects',
                        value: selectedResource.summary.active_projects_count.toString(),
                        tag: false,
                        tagColor: '',
                      },
                    ]}
                    metas={{
                      title: {
                        dataIndex: 'label',
                      },
                      description: {
                        render: (_, row) => 
                          row.tag ? (
                            <Tag color={row.tagColor}>{row.value}</Tag>
                          ) : (
                            <Typography.Text strong>{row.value}</Typography.Text>
                          ),
                      },
                    }}
                  />
                </div>
              ),
            },
          ],
        }}
        style={{ marginTop: '16px' }}
      />
    </Drawer>
  );
};

export default DetailDrawer;
