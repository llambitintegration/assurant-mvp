/**
 * Detail Drawer Component
 * Shows detailed information about a resource's utilization period using ProComponents
 */

import { useState } from 'react';
import { Drawer, Tag, Typography, Empty, Collapse, Badge as AntBadge, theme } from 'antd';
import { StatisticCard, ProCard, ProList } from '@ant-design/pro-components';
import { 
  ProjectOutlined, 
  ClockCircleOutlined, 
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CaretRightOutlined
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
  const { token } = theme.useToken();
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

  const countTasks = (tasks: ITaskDetail[] | undefined): number => {
    if (!tasks) return 0;
    return tasks.reduce((sum, task) => {
      return sum + 1 + countTasks(task.subtasks);
    }, 0);
  };

  const totalTasks = selectedPeriod.allocations.reduce(
    (sum, alloc) => sum + countTasks(alloc.tasks),
    0
  );

  const getStatusBadge = (status: string): 'success' | 'processing' | 'error' | 'default' => {
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

  const renderTaskItem = (task: ITaskDetail, isSubtask: boolean = false) => (
    <div 
      key={task.task_id}
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: isSubtask ? '6px 12px 6px 32px' : '10px 12px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        backgroundColor: isSubtask ? token.colorFillQuaternary : 'transparent',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AntBadge status={getStatusBadge(task.status_name)} />
          <Typography.Text 
            ellipsis 
            style={{ 
              maxWidth: isSubtask ? '180px' : '200px',
              color: token.colorText,
              fontSize: isSubtask ? '13px' : '14px'
            }}
          >
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
      <div style={{ textAlign: 'right', fontSize: '12px', color: token.colorTextSecondary }}>
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

  const renderTaskWithSubtasks = (task: ITaskDetail) => (
    <div key={task.task_id}>
      {renderTaskItem(task, false)}
      {task.subtasks && task.subtasks.length > 0 && (
        <div style={{ borderLeft: `2px solid ${token.colorPrimaryBorder}`, marginLeft: '16px' }}>
          {task.subtasks.map(subtask => renderTaskItem(subtask, true))}
        </div>
      )}
    </div>
  );

  const renderProjectAllocation = (allocation: IAllocationDetail) => {
    const taskCount = countTasks(allocation.tasks);
    
    return {
      key: allocation.project_id,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '2px', 
                backgroundColor: allocation.project_color || token.colorPrimary 
              }} 
            />
            <Typography.Text strong style={{ color: token.colorText }}>
              {allocation.project_name}
            </Typography.Text>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Tag color="blue">{formatPercent(allocation.allocation_percent)}</Tag>
            {taskCount > 0 && (
              <Tag color="default">{taskCount} task{taskCount !== 1 ? 's' : ''}</Tag>
            )}
          </div>
        </div>
      ),
      children: (
        <div style={{ backgroundColor: token.colorBgContainer }}>
          {allocation.tasks && allocation.tasks.length > 0 ? (
            <div>
              {allocation.tasks.map(task => renderTaskWithSubtasks(task))}
            </div>
          ) : (
            <Empty 
              description={
                <Typography.Text style={{ color: token.colorTextSecondary }}>
                  No tasks assigned in this period
                </Typography.Text>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '24px 0' }}
            />
          )}
        </div>
      ),
    };
  };

  return (
    <Drawer
      title={
        <div>
          <Typography.Title level={5} style={{ margin: 0, color: token.colorText }}>
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
      styles={{ 
        body: { padding: '16px', backgroundColor: token.colorBgLayout },
        header: { backgroundColor: token.colorBgContainer }
      }}
    >
      <StatisticCard.Group 
        direction="row"
        style={{ 
          backgroundColor: token.colorBgContainer, 
          borderRadius: token.borderRadiusLG,
          marginBottom: '16px'
        }}
      >
        <StatisticCard
          statistic={{
            title: <span style={{ color: token.colorTextSecondary }}>Utilization</span>,
            value: selectedPeriod.utilization_percent,
            suffix: '%',
            valueStyle: { color: utilizationColor },
            description: (
              <Statistic 
                title={<span style={{ color: token.colorTextTertiary }}>Status</span>}
                value={utilizationStatus} 
                layout="horizontal"
              />
            ),
          }}
        />
        <StatDivider type="vertical" />
        <StatisticCard
          statistic={{
            title: <span style={{ color: token.colorTextSecondary }}>Allocated</span>,
            value: selectedPeriod.allocated_hours.toFixed(1),
            suffix: 'h',
            description: (
              <Statistic 
                title={<span style={{ color: token.colorTextTertiary }}>of available</span>}
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
            title: <span style={{ color: token.colorTextSecondary }}>Projects</span>,
            value: selectedPeriod.allocations.length,
            description: (
              <Statistic 
                title={<span style={{ color: token.colorTextTertiary }}>Tasks</span>}
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
                <span style={{ color: activeTab === 'projects' ? token.colorPrimary : token.colorText }}>
                  <ProjectOutlined /> Projects & Tasks
                </span>
              ),
              children: (
                <div style={{ marginTop: '8px' }}>
                  {selectedPeriod.allocations.length > 0 ? (
                    <Collapse 
                      defaultActiveKey={selectedPeriod.allocations.map(a => a.project_id)}
                      ghost
                      expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} style={{ color: token.colorTextSecondary }} />}
                      style={{ 
                        background: token.colorBgContainer, 
                        borderRadius: token.borderRadiusLG,
                        border: `1px solid ${token.colorBorderSecondary}`
                      }}
                      items={selectedPeriod.allocations.map(allocation => renderProjectAllocation(allocation))}
                    />
                  ) : (
                    <Empty 
                      description={
                        <Typography.Text style={{ color: token.colorTextSecondary }}>
                          No project allocations for this period
                        </Typography.Text>
                      }
                      style={{ 
                        padding: '32px', 
                        backgroundColor: token.colorBgContainer,
                        borderRadius: token.borderRadiusLG
                      }}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'time',
              label: (
                <span style={{ color: activeTab === 'time' ? token.colorPrimary : token.colorText }}>
                  <ClockCircleOutlined /> Time Breakdown
                </span>
              ),
              children: (
                <div style={{ 
                  marginTop: '16px', 
                  backgroundColor: token.colorBgContainer,
                  borderRadius: token.borderRadiusLG,
                  padding: '16px'
                }}>
                  <ProList<{label: string; value: string; icon: React.ReactNode}>
                    ghost
                    dataSource={[
                      {
                        label: 'Period',
                        value: `${periodStart} - ${periodEnd}`,
                        icon: <CalendarOutlined style={{ color: token.colorPrimary }} />
                      },
                      {
                        label: 'Total Allocation',
                        value: formatPercent(selectedPeriod.total_allocation_percent),
                        icon: <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                      },
                      {
                        label: 'Allocated Hours',
                        value: formatHours(selectedPeriod.allocated_hours),
                        icon: <ClockCircleOutlined style={{ color: token.colorPrimary }} />
                      },
                      {
                        label: 'Available Hours',
                        value: formatHours(selectedPeriod.net_available_hours),
                        icon: <ClockCircleOutlined style={{ color: token.colorSuccess }} />
                      },
                      {
                        label: 'Unavailable Hours',
                        value: formatHours(selectedPeriod.unavailable_hours),
                        icon: <ExclamationCircleOutlined style={{ color: token.colorWarning }} />
                      },
                    ]}
                    metas={{
                      title: {
                        dataIndex: 'label',
                        render: (_, row) => (
                          <Typography.Text style={{ color: token.colorTextSecondary }}>{row.label}</Typography.Text>
                        ),
                      },
                      description: {
                        dataIndex: 'value',
                        render: (_, row) => (
                          <Typography.Text strong style={{ color: token.colorText }}>{row.value}</Typography.Text>
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
                      <Typography.Title level={5} style={{ marginTop: '16px', marginBottom: '8px', color: token.colorText }}>
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
                            render: (_, row) => (
                              <Typography.Text style={{ color: token.colorText }}>{row.title}</Typography.Text>
                            ),
                          },
                          description: {
                            dataIndex: 'description',
                            render: (_, row) => (
                              <Typography.Text style={{ color: token.colorTextSecondary }}>{row.description}</Typography.Text>
                            ),
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
              label: <span style={{ color: activeTab === 'summary' ? token.colorPrimary : token.colorText }}>Resource Summary</span>,
              children: (
                <div style={{ 
                  marginTop: '16px', 
                  backgroundColor: token.colorBgContainer,
                  borderRadius: token.borderRadiusLG,
                  padding: '16px'
                }}>
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
                        render: (_, row) => (
                          <Typography.Text style={{ color: token.colorTextSecondary }}>{row.label}</Typography.Text>
                        ),
                      },
                      description: {
                        render: (_, row) => 
                          row.tag ? (
                            <Tag color={row.tagColor}>{row.value}</Tag>
                          ) : (
                            <Typography.Text strong style={{ color: token.colorText }}>{row.value}</Typography.Text>
                          ),
                      },
                    }}
                  />
                </div>
              ),
            },
          ],
        }}
        style={{ 
          backgroundColor: token.colorBgContainer, 
          borderRadius: token.borderRadiusLG 
        }}
      />
    </Drawer>
  );
};

export default DetailDrawer;
