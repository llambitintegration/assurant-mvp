/**
 * Transactions List Page
 * Displays all inventory transactions with filtering capabilities
 */

import { useEffect } from 'react';
import { Table, Tag, Space, Flex, Typography } from '@/shared/antd-imports';
import { ArrowRightOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import CustomPageHeader from '@/pages/reporting/page-header/custom-page-header';
import {
  fetchTransactions,
  setPage,
  setPageSize,
} from '@/features/inventory/transactions/transactionsSlice';
import { TransactionType, ITransaction } from '@/types/inventory/transaction.types';
import TransactionFilterBar from './transaction-filter-bar';
import { ErrorBoundary } from '@/components/error-boundary';
import dayjs from 'dayjs';

const { Text } = Typography;

const TransactionsList = () => {
  useDocumentTitle('Inventory - Transactions');
  const dispatch = useAppDispatch();

  const {
    transactions,
    total,
    isLoading,
    page,
    pageSize,
  } = useAppSelector(state => state.inventoryTransactions);

  useEffect(() => {
    dispatch(fetchTransactions());
  }, [dispatch, page, pageSize]);

  const getTransactionTypeColor = (type: TransactionType) => {
    switch (type) {
      case TransactionType.IN:
        return 'green';
      case TransactionType.OUT:
        return 'red';
      case TransactionType.ADJUSTMENT:
        return 'orange';
      default:
        return 'default';
    }
  };

  const getTransactionTypeIcon = (type: TransactionType) => {
    switch (type) {
      case TransactionType.IN:
        return '+';
      case TransactionType.OUT:
        return '-';
      case TransactionType.ADJUSTMENT:
        return '±';
      default:
        return '';
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'transaction_date',
      key: 'transaction_date',
      width: 180,
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text>{dayjs(date).format('YYYY-MM-DD')}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {dayjs(date).format('HH:mm:ss')}
          </Text>
        </Space>
      ),
      sorter: (a: ITransaction, b: ITransaction) =>
        dayjs(a.transaction_date).unix() - dayjs(b.transaction_date).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Component',
      key: 'component',
      width: 250,
      render: (_: any, record: ITransaction) => {
        const component = record.component as any;
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{component?.name || 'Unknown Component'}</Text>
            {component?.sku && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                SKU: {component.sku}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Type',
      dataIndex: 'transaction_type',
      key: 'transaction_type',
      width: 120,
      align: 'center' as const,
      render: (type: TransactionType) => (
        <Tag color={getTransactionTypeColor(type)}>
          {getTransactionTypeIcon(type)} {type}
        </Tag>
      ),
      filters: [
        { text: 'Stock In', value: TransactionType.IN },
        { text: 'Stock Out', value: TransactionType.OUT },
        { text: 'Adjustment', value: TransactionType.ADJUSTMENT },
      ],
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right' as const,
      render: (quantity: number, record: ITransaction) => {
        const prefix = record.transaction_type === TransactionType.IN ? '+' :
                       record.transaction_type === TransactionType.OUT ? '-' : '±';
        const color = record.transaction_type === TransactionType.IN ? '#52c41a' :
                      record.transaction_type === TransactionType.OUT ? '#ff4d4f' : '#faad14';
        return (
          <Text style={{ color, fontWeight: 500 }}>
            {prefix}{quantity}
          </Text>
        );
      },
    },
    {
      title: 'Inventory Change',
      key: 'inventory_change',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: ITransaction) => (
        <Space size="small">
          <Text>{record.quantity_before}</Text>
          <ArrowRightOutlined style={{ color: '#999' }} />
          <Text strong>{record.quantity_after}</Text>
        </Space>
      ),
    },
    {
      title: 'Created By',
      key: 'created_by',
      width: 150,
      render: (_: any, record: ITransaction) => {
        const user = record.created_by_user;
        return user ? user.name || user.email : 'System';
      },
    },
    {
      title: 'Reference',
      dataIndex: 'reference_number',
      key: 'reference_number',
      width: 150,
      render: (ref: string | null) => ref || '-',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      ellipsis: true,
      render: (notes: string | null) => notes || '-',
    },
  ];

  return (
    <ErrorBoundary>
      <Flex vertical gap={16}>
        <CustomPageHeader
          title={`Transactions (${total})`}
          children={
            <Space>
              {/* Add export functionality here if needed */}
            </Space>
          }
        />

        <TransactionFilterBar />

        <Table
          dataSource={transactions}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} transactions`,
            onChange: (page, pageSize) => {
              dispatch(setPage(page));
              dispatch(setPageSize(pageSize));
            },
          }}
          scroll={{ x: 1400 }}
        />
      </Flex>
    </ErrorBoundary>
  );
};

export default TransactionsList;
