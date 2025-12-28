/**
 * Inventory Dashboard Page
 * Main dashboard showing inventory stats, alerts, and quick actions
 */

import { useEffect } from 'react';
import { Button, Card, Col, Flex, Row, Space } from '@/shared/antd-imports';
import { ReloadOutlined, PlusOutlined } from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useNavigate } from 'react-router-dom';
import { fetchDashboardData } from '@/features/inventory/dashboard/dashboardSlice';
import StatsCards from './components/stats-cards';
import LowStockAlertsWidget from './components/low-stock-alerts-widget';
import RecentTransactionsWidget from './components/recent-transactions-widget';

const DashboardPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  useDocumentTitle('Inventory Dashboard');

  const { loading } = useAppSelector(state => state.inventoryDashboard);

  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchDashboardData());
  };

  return (
    <Flex vertical gap={16}>
      <PageHeader
        className="site-page-header"
        title="Inventory Dashboard"
        style={{ padding: '16px 0' }}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        }
      />

      <StatsCards />

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <LowStockAlertsWidget />
        </Col>
        <Col xs={24} lg={12}>
          <RecentTransactionsWidget />
        </Col>
      </Row>

      <Card title="Quick Actions" style={{ marginTop: 16 }}>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/inventory/components/new')}
          >
            Add Component
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => navigate('/inventory/suppliers/new')}
          >
            Add Supplier
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => navigate('/inventory/storage-locations/new')}
          >
            Add Storage Location
          </Button>
          <Button
            onClick={() => navigate('/inventory/csv-import')}
          >
            Import from CSV
          </Button>
          <Button
            onClick={() => navigate('/inventory/transactions')}
          >
            View All Transactions
          </Button>
        </Space>
      </Card>
    </Flex>
  );
};

export default DashboardPage;
