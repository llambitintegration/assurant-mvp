/**
 * Stats Cards Component
 * Dashboard statistics cards showing key inventory metrics
 */

import { Col, Row, Spin } from '@/shared/antd-imports';
import { StatisticCard } from '@ant-design/pro-components';
import {
  AppstoreOutlined,
  DollarOutlined,
  WarningOutlined,
  ShopOutlined,
  InboxOutlined,
} from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';

const { Statistic } = StatisticCard;

const StatsCards = () => {
  const { stats, loading } = useAppSelector(state => state.inventoryDashboard);

  if (loading && !stats) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <StatisticCard.Group>
      <StatisticCard
        statistic={{
          title: 'Total Active Components',
          value: stats.total_active_components,
          icon: <AppstoreOutlined style={{ color: '#1890ff', fontSize: 32 }} />,
        }}
      />
      <StatisticCard
        statistic={{
          title: 'Total Inventory Value',
          value: stats.total_inventory_value,
          precision: 2,
          prefix: '$',
          icon: <DollarOutlined style={{ color: '#52c41a', fontSize: 32 }} />,
        }}
      />
      <StatisticCard
        statistic={{
          title: 'Low Stock Items',
          value: stats.low_stock_count,
          valueStyle: { color: stats.low_stock_count > 0 ? '#cf1322' : '#52c41a' },
          icon: <WarningOutlined style={{ color: stats.low_stock_count > 0 ? '#cf1322' : '#52c41a', fontSize: 32 }} />,
        }}
      />
      <StatisticCard
        statistic={{
          title: 'Active Suppliers',
          value: stats.total_active_suppliers,
          icon: <ShopOutlined style={{ color: '#722ed1', fontSize: 32 }} />,
        }}
      />
      <StatisticCard
        statistic={{
          title: 'Active Storage Locations',
          value: stats.total_active_storage_locations,
          icon: <InboxOutlined style={{ color: '#fa8c16', fontSize: 32 }} />,
        }}
      />
    </StatisticCard.Group>
  );
};

export default StatsCards;
