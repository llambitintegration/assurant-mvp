/**
 * Components List Page
 * Main page for managing inventory components
 */

import { useEffect } from 'react';
import { Button, Table, Space, Tag, Badge, Popconfirm, Image, Flex } from '@/shared/antd-imports';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import CustomPageHeader from '@/pages/reporting/page-header/custom-page-header';
import {
  fetchComponents,
  openDrawer,
  openDetailDrawer,
  deleteComponent,
  setPage,
  setPageSize,
} from '@/features/inventory/components/componentsSlice';
import { fetchSuppliers } from '@/features/inventory/suppliers/suppliersSlice';
import { fetchStorageLocations } from '@/features/inventory/storageLocations/storageLocationsSlice';
import { IComponent, OwnerType } from '@/types/inventory/component.types';
import ComponentsFilterBar from './components-filter-bar';
import ComponentsFormDrawer from './components-form-drawer';
import ComponentDetailDrawer from './components-detail-drawer';

const ComponentsList = () => {
  useDocumentTitle('Inventory - Components');
  const dispatch = useAppDispatch();

  const {
    components,
    total,
    isLoading,
    page,
    pageSize,
    totalPages,
  } = useAppSelector(state => state.inventoryComponents);

  const { suppliers } = useAppSelector(state => state.inventorySuppliers);
  const { locations } = useAppSelector(state => state.inventoryStorageLocations);

  useEffect(() => {
    dispatch(fetchComponents());
    dispatch(fetchSuppliers());
    dispatch(fetchStorageLocations());
  }, [dispatch, page, pageSize]);

  const handleEdit = (id: string) => {
    dispatch(openDrawer({ mode: 'edit', componentId: id }));
  };

  const handleDelete = async (id: string) => {
    await dispatch(deleteComponent(id));
  };

  const handleRowClick = (record: IComponent) => {
    dispatch(openDetailDrawer(record.id));
  };

  const getOwnerName = (component: IComponent) => {
    if (component.owner_type === OwnerType.SUPPLIER) {
      const supplier = suppliers.find(s => s.id === component.supplier_id);
      return supplier?.name || 'Unknown Supplier';
    } else {
      const location = locations.find(l => l.id === component.storage_location_id);
      return location?.name || 'Unknown Location';
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (sku: string | null) => sku || '-',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string | null) => category || '-',
    },
    {
      title: 'Owner',
      key: 'owner',
      width: 180,
      render: (_: any, record: IComponent) => {
        const ownerName = getOwnerName(record);
        const color = record.owner_type === OwnerType.SUPPLIER ? 'blue' : 'green';
        const label = record.owner_type === OwnerType.SUPPLIER ? 'Supplier' : 'Storage';
        return (
          <Space direction="vertical" size={0}>
            <Tag color={color} style={{ marginBottom: 4 }}>
              {label}
            </Tag>
            <span style={{ fontSize: '12px' }}>{ownerName}</span>
          </Space>
        );
      },
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right' as const,
      render: (quantity: number, record: IComponent) => {
        const isLowStock = record.reorder_level && quantity <= record.reorder_level;
        return (
          <Badge status={isLowStock ? 'error' : 'success'} text={`${quantity} ${record.unit || ''}`} />
        );
      },
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      width: 100,
      align: 'right' as const,
      render: (cost: number | null) => (cost ? `$${cost.toFixed(2)}` : '-'),
    },
    {
      title: 'QR Code',
      dataIndex: 'qr_code',
      key: 'qr_code',
      width: 80,
      align: 'center' as const,
      render: (qrCode: string | null) =>
        qrCode ? (
          <Image src={qrCode} alt="QR Code" width={40} height={40} preview={false} />
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: IComponent) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleRowClick(record);
            }}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(record.id);
            }}
          />
          <Popconfirm
            title="Delete Component"
            description="Are you sure you want to delete this component?"
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDelete(record.id);
            }}
            okText="Yes"
            cancelText="No"
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <CustomPageHeader
        title={`Components (${total})`}
        children={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => dispatch(openDrawer({ mode: 'create' }))}
          >
            Add Component
          </Button>
        }
      />

      <ComponentsFilterBar />

      <Table
        dataSource={components}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} components`,
          onChange: (page, pageSize) => {
            dispatch(setPage(page));
            dispatch(setPageSize(pageSize));
          },
        }}
        onRow={(record) => ({
          onClick: () => handleRowClick(record),
          style: { cursor: 'pointer' },
        })}
        scroll={{ x: 1200 }}
      />

      <ComponentsFormDrawer />
      <ComponentDetailDrawer />
    </Flex>
  );
};

export default ComponentsList;
