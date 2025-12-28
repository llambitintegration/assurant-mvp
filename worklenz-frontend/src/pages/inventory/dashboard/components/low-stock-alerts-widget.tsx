/**
 * Low Stock Alerts Widget
 * Shows components below reorder level
 */

import { Button, Card, Empty, Progress, Table, Typography } from '@/shared/antd-imports';
import { EyeOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { ILowStockAlert } from '@/types/inventory/dashboard.types';

const { Text } = Typography;

const LowStockAlertsWidget = () => {
  const navigate = useNavigate();
  const { lowStockAlerts, loading } = useAppSelector(state => state.inventoryDashboard);

  const columns: ColumnsType<ILowStockAlert> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ILowStockAlert) => (
        <div>
          <div>{text}</div>
          {record.sku && <Text type="secondary" style={{ fontSize: 12 }}>{record.sku}</Text>}
        </div>
      ),
    },
    {
      title: 'Current Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      width: 100,
    },
    {
      title: 'Reorder Level',
      dataIndex: 'reorder_level',
      key: 'reorder_level',
      align: 'right',
      width: 120,
      render: (level: number | null) => level ?? 'N/A',
    },
    {
      title: 'Stock %',
      dataIndex: 'stock_percentage',
      key: 'stock_percentage',
      width: 150,
      render: (percentage: number) => (
        <Progress
          percent={Math.round(percentage)}
          size="small"
          status={percentage < 50 ? 'exception' : 'normal'}
          strokeColor={percentage < 50 ? '#cf1322' : '#faad14'}
        />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, record: ILowStockAlert) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/inventory/components/${record.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="Low Stock Alerts"
      extra={
        <Button
          type="link"
          onClick={() => navigate('/inventory/components?filter=low_stock')}
        >
          View All
        </Button>
      }
    >
      {lowStockAlerts.length === 0 ? (
        <Empty
          description="No low stock alerts"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={lowStockAlerts}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
        />
      )}
    </Card>
  );
};

export default LowStockAlertsWidget;
