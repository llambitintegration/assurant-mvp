/**
 * Recent Transactions Widget
 * Shows last 10 transactions
 */

import { Button, Card, Empty, Table, Tag, Typography } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchTransactions, setPageSize } from '@/features/inventory/transactions/transactionsSlice';
import type { ColumnsType } from 'antd/es/table';
import { ITransaction, TransactionType } from '@/types/inventory/transaction.types';
import dayjs from 'dayjs';

const { Text } = Typography;

const getTransactionTypeBadge = (type: TransactionType) => {
  const config = {
    [TransactionType.IN]: { color: 'green', label: 'IN' },
    [TransactionType.OUT]: { color: 'red', label: 'OUT' },
    [TransactionType.ADJUSTMENT]: { color: 'blue', label: 'ADJUSTMENT' },
  };
  return <Tag color={config[type].color}>{config[type].label}</Tag>;
};

const RecentTransactionsWidget = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { transactions, isLoading } = useAppSelector(state => state.inventoryTransactions);

  useEffect(() => {
    // Fetch only 10 recent transactions for the widget
    dispatch(setPageSize(10));
    dispatch(fetchTransactions());
  }, [dispatch]);

  const columns: ColumnsType<ITransaction> = [
    {
      title: 'Date',
      dataIndex: 'transaction_date',
      key: 'transaction_date',
      width: 120,
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Component',
      key: 'component',
      render: (_, record: ITransaction) => (
        <div>
          <div>{record.component?.name || 'N/A'}</div>
          {record.component?.sku && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.component.sku}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'transaction_type',
      key: 'transaction_type',
      width: 130,
      render: (type: TransactionType) => getTransactionTypeBadge(type),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      width: 100,
      render: (qty: number, record: ITransaction) => {
        const sign = record.transaction_type === TransactionType.IN ? '+' :
                     record.transaction_type === TransactionType.OUT ? '-' : '';
        const color = record.transaction_type === TransactionType.IN ? '#52c41a' :
                      record.transaction_type === TransactionType.OUT ? '#cf1322' : '#1890ff';
        return <Text style={{ color }}>{sign}{qty}</Text>;
      },
    },
  ];

  return (
    <Card
      title="Recent Transactions"
      extra={
        <Button
          type="link"
          onClick={() => navigate('/inventory/transactions')}
        >
          View All
        </Button>
      }
    >
      {transactions.length === 0 ? (
        <Empty
          description="No recent transactions"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="small"
        />
      )}
    </Card>
  );
};

export default RecentTransactionsWidget;
