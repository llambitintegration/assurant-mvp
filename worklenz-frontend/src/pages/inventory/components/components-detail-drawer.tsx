/**
 * Component Detail Drawer
 * Displays detailed component information with QR code and transactions
 */

import { useEffect, useState } from 'react';
import { Drawer, Descriptions, Button, Space, Image, Table, Tag, Divider, Empty } from '@/shared/antd-imports';
import { EditOutlined, DeleteOutlined, QrcodeOutlined, DownloadOutlined, PlusOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  closeDetailDrawer,
  openDrawer,
  deleteComponent,
  generateQrCode,
} from '@/features/inventory/components/componentsSlice';
import {
  fetchComponentHistory,
  clearComponentHistory,
  openModal,
} from '@/features/inventory/transactions/transactionsSlice';
import { OwnerType } from '@/types/inventory/component.types';
import { TransactionType } from '@/types/inventory/transaction.types';
import RecordTransactionModal from './record-transaction-modal';
import dayjs from 'dayjs';

const ComponentDetailDrawer = () => {
  const dispatch = useAppDispatch();

  const {
    isDetailDrawerOpen,
    detailComponentId,
    components,
    isLoading,
  } = useAppSelector(state => state.inventoryComponents);

  const { componentHistory } = useAppSelector(state => state.inventoryTransactions);
  const { suppliers } = useAppSelector(state => state.inventorySuppliers);
  const { locations } = useAppSelector(state => state.inventoryStorageLocations);

  const component = components.find(c => c.id === detailComponentId);

  useEffect(() => {
    if (isDetailDrawerOpen && detailComponentId) {
      dispatch(fetchComponentHistory(detailComponentId));
    }

    return () => {
      dispatch(clearComponentHistory());
    };
  }, [isDetailDrawerOpen, detailComponentId, dispatch]);

  const handleClose = () => {
    dispatch(closeDetailDrawer());
  };

  const handleEdit = () => {
    if (component) {
      dispatch(closeDetailDrawer());
      dispatch(openDrawer({ mode: 'edit', componentId: component.id }));
    }
  };

  const handleDelete = async () => {
    if (component) {
      await dispatch(deleteComponent(component.id));
      dispatch(closeDetailDrawer());
    }
  };

  const handleGenerateQr = async () => {
    if (component) {
      await dispatch(generateQrCode(component.id));
    }
  };

  const handleDownloadQr = () => {
    if (component?.qr_code) {
      const link = document.createElement('a');
      link.href = component.qr_code;
      link.download = `${component.name}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRecordTransaction = () => {
    dispatch(openModal());
  };

  const getOwnerName = () => {
    if (!component) return '-';

    if (component.owner_type === OwnerType.SUPPLIER) {
      const supplier = suppliers.find(s => s.id === component.supplier_id);
      return supplier?.name || 'Unknown Supplier';
    } else {
      const location = locations.find(l => l.id === component.storage_location_id);
      return location?.name || 'Unknown Location';
    }
  };

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

  const transactionColumns = [
    {
      title: 'Date',
      dataIndex: 'transaction_date',
      key: 'transaction_date',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Type',
      dataIndex: 'transaction_type',
      key: 'transaction_type',
      width: 120,
      render: (type: TransactionType) => (
        <Tag color={getTransactionTypeColor(type)}>{type}</Tag>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right' as const,
    },
    {
      title: 'Before',
      dataIndex: 'quantity_before',
      key: 'quantity_before',
      width: 80,
      align: 'right' as const,
    },
    {
      title: 'After',
      dataIndex: 'quantity_after',
      key: 'quantity_after',
      width: 80,
      align: 'right' as const,
    },
    {
      title: 'Reference',
      dataIndex: 'reference_number',
      key: 'reference_number',
      width: 120,
      render: (ref: string | null) => ref || '-',
    },
  ];

  if (!component) {
    return null;
  }

  return (
    <>
      <Drawer
        title="Component Details"
        open={isDetailDrawerOpen}
        onClose={handleClose}
        width={800}
        extra={
          <Space>
            <Button icon={<EditOutlined />} onClick={handleEdit}>
              Edit
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              Delete
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Component Information */}
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Name" span={2}>
              <strong>{component.name}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="SKU">{component.sku || '-'}</Descriptions.Item>
            <Descriptions.Item label="Category">{component.category || '-'}</Descriptions.Item>
            <Descriptions.Item label="Owner Type">
              <Tag color={component.owner_type === OwnerType.SUPPLIER ? 'blue' : 'green'}>
                {component.owner_type === OwnerType.SUPPLIER ? 'Supplier' : 'Storage Location'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Owner">{getOwnerName()}</Descriptions.Item>
            <Descriptions.Item label="Quantity">
              <strong>{component.quantity} {component.unit || ''}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Unit Cost">
              {component.unit_cost ? `$${component.unit_cost.toFixed(2)}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Reorder Level">
              {component.reorder_level || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={component.is_active ? 'green' : 'red'}>
                {component.is_active ? 'Active' : 'Inactive'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>
              {component.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {dayjs(component.created_at).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {dayjs(component.updated_at).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          {/* QR Code Section */}
          <div>
            <h3>QR Code</h3>
            {component.qr_code ? (
              <Space direction="vertical" align="center" style={{ width: '100%' }}>
                <Image
                  src={component.qr_code}
                  alt="Component QR Code"
                  width={200}
                  height={200}
                  style={{ border: '1px solid #d9d9d9', padding: 8 }}
                />
                <Space>
                  <Button icon={<DownloadOutlined />} onClick={handleDownloadQr}>
                    Download QR Code
                  </Button>
                  <Button
                    icon={<QrcodeOutlined />}
                    onClick={handleGenerateQr}
                    loading={isLoading}
                  >
                    Regenerate QR Code
                  </Button>
                </Space>
              </Space>
            ) : (
              <Empty
                description="No QR Code Generated"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<QrcodeOutlined />}
                  onClick={handleGenerateQr}
                  loading={isLoading}
                >
                  Generate QR Code
                </Button>
              </Empty>
            )}
          </div>

          <Divider />

          {/* Transactions Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Recent Transactions</h3>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleRecordTransaction}
              >
                Record Transaction
              </Button>
            </div>
            <Table
              dataSource={componentHistory.slice(0, 10)}
              columns={transactionColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{
                emptyText: 'No transactions recorded',
              }}
            />
          </div>
        </Space>
      </Drawer>

      <RecordTransactionModal componentId={detailComponentId} />
    </>
  );
};

export default ComponentDetailDrawer;
