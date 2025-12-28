import {
  Button,
  Input,
  Table,
  TableColumnsType,
  Tag,
  Popconfirm,
  Space,
  Tooltip,
} from '@/shared/antd-imports';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
} from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { PageHeader } from '@ant-design/pro-components';
import { useAppDispatch, useAppSelector } from '@/app/store';
import {
  fetchSuppliers,
  deleteSupplier,
  openDrawer,
  setSearchQuery,
  setPage,
} from '@/features/inventory/suppliers/suppliersSlice';
import { ISupplier } from '@/types/inventory/supplier.types';
import { colors } from '@/styles/colors';
import { appMessage } from '@/shared/antd-imports';
import SupplierDrawer from './components/supplier-drawer';

const SuppliersListPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    suppliers,
    total,
    isLoading,
    page,
    pageSize,
    searchQuery,
  } = useAppSelector(state => state.inventorySuppliers);

  const [hoverRow, setHoverRow] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchSuppliers());
  }, [dispatch, page, pageSize, searchQuery]);

  const handleSearch = (value: string) => {
    dispatch(setSearchQuery(value));
  };

  const handleEdit = (supplier: ISupplier) => {
    dispatch(openDrawer({ mode: 'edit', supplierId: supplier.id }));
  };

  const handleDelete = async (id: string) => {
    try {
      await dispatch(deleteSupplier(id)).unwrap();
      appMessage.success('Supplier deleted successfully');
    } catch (error) {
      appMessage.error('Failed to delete supplier');
    }
  };

  const handleAddSupplier = () => {
    dispatch(openDrawer({ mode: 'create' }));
  };

  const columns: TableColumnsType<ISupplier> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      width: '20%',
    },
    {
      title: 'Contact Person',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: '15%',
      render: (text: string | null) => text || '-',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: '20%',
      render: (text: string | null) => text || '-',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: '15%',
      render: (text: string | null) => text || '-',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: '10%',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '10%',
      render: (_, record) =>
        hoverRow === record.id && (
          <Space size="small">
            <Tooltip title="Edit">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Delete Supplier"
              description="Are you sure you want to delete this supplier?"
              icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
              okText="Delete"
              cancelText="Cancel"
              onConfirm={() => handleDelete(record.id)}
            >
              <Tooltip title="Delete">
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        title={`Suppliers (${total})`}
        extra={[
          <Input
            key="search"
            placeholder="Search suppliers..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />,
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddSupplier}
          >
            Add Supplier
          </Button>,
        ]}
      />
      <Table
        columns={columns}
        dataSource={suppliers}
        rowKey="id"
        loading={isLoading}
        onRow={record => ({
          onMouseEnter: () => setHoverRow(record.id),
          onMouseLeave: () => setHoverRow(null),
        })}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} suppliers`,
          onChange: (newPage) => dispatch(setPage(newPage)),
        }}
      />
      <SupplierDrawer />
    </div>
  );
};

export default SuppliersListPage;
