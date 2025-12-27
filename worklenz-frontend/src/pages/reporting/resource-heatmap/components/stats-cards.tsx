/**
 * Stats Cards Component
 * Summary statistics for resource heatmap
 */

import { Badge, Card, Col, Row, Statistic } from '@/shared/antd-imports';
import { ArrowUpOutlined, ArrowDownOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { calculateSummaryStats } from '../utils/heatmap-utils';

const StatsCards = () => {
  const { resources } = useAppSelector(state => state.resourceHeatmapReducer);

  const stats = calculateSummaryStats(resources);

  return (
    <Row gutter={16}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Total Resources"
            value={stats.totalResources}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Average Utilization"
            value={stats.avgUtilization}
            precision={1}
            valueStyle={{ color: stats.avgUtilization >= 80 ? '#3f8600' : '#cf1322' }}
            suffix="%"
            prefix={
              stats.avgUtilization >= 80 ? (
                <ArrowUpOutlined />
              ) : stats.avgUtilization < 60 ? (
                <ArrowDownOutlined />
              ) : null
            }
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Overutilized Resources"
            value={stats.overutilizedCount}
            valueStyle={{ color: stats.overutilizedCount > 0 ? '#cf1322' : '#3f8600' }}
            prefix={stats.overutilizedCount > 0 ? <Badge status="error" /> : <Badge status="success" />}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Total Available Hours"
            value={stats.totalAvailableHours}
            precision={0}
            valueStyle={{ color: '#666' }}
            suffix="h"
          />
        </Card>
      </Col>
    </Row>
  );
};

export default StatsCards;
