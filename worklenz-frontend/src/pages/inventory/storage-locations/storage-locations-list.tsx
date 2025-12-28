import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Table,
  TableColumnsType,
  Tag,
  Popconfirm,
  Space,
  Tooltip,
  Tabs,
} from '@/shared/antd-imports';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  TableOutlined,
  GroupOutlined,
} from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { useAppDispatch, useAppSelector } from '@/app/store';
import {
  fetchStorageLocations,
  fetchLocationHierarchy,
  deleteStorageLocation,
  openDrawer,
  setSearchQuery,
  setPage,
} from '@/features/inventory/storageLocations/storageLocationsSlice';
import { IStorageLocation } from '@/types/inventory/storage-location.types';
import { colors } from '@/styles/colors';
import { appMessage } from '@/shared/antd-imports';
import StorageLocationDrawer from './components/location-drawer';
import LocationHierarchy from './components/location-hierarchy';

const StorageLocationsListPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    locations,
    total,
    isLoading,
    page,
    pageSize,
    searchQuery,
  } = useAppSelector(state => state.inventoryStorageLocations);

  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('table');

  useEffect(() => {
    dispatch(fetchStorageLocations());
    dispatch(fetchLocationHierarchy());
  }, [dispatch, page, pageSize, searchQuery]);

  const handleSearch = (value: string) => {
    dispatch(setSearchQuery(value));
  };

  const handleEdit = (location: IStorageLocation) => {
    dispatch(openDrawer({ mode: 'edit', locationId: location.id }));
  };

  const handleDelete = async (id: string) => {
    try {
      await dispatch(deleteStorageLocation(id)).unwrap();
      appMessage.success('Storage location deleted successfully');
    } catch (error) {
      appMessage.error('Failed to delete storage location');
    }
  };

  const handleAddLocation = () => {
    dispatch(openDrawer({ mode: 'create' }));
  };

  const columns: TableColumnsType<IStorageLocation> = [
    {
      title: 'Location Code',
      dataIndex: 'location_code',
      key: 'location_code',
      width: '15%',
      sorter: true,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      sorter: true,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: '25%',
      render: (text: string | null) => text || '-',
    },
    {
      title: 'Parent Location',
      dataIndex: 'parent_location',
      key: 'parent_location',
      width: '20%',
      render: (parent: IStorageLocation | null) =>
        parent ? `${parent.location_code} - ${parent.name}` : '-',
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
              title="Delete Storage Location"
              description="Are you sure you want to delete this storage location?"
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

  const tabItems = [
    {
      key: 'table',
      label: (
        <span>
          <TableOutlined /> Table View
        </span>
      ),
      children: (
        <Table
          columns={columns}
          dataSource={locations}
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
            showTotal: (total) => `Total ${total} locations`,
            onChange: (newPage) => dispatch(setPage(newPage)),
          }}
        />
      ),
    },
    {
      key: 'hierarchy',
      label: (
        <span>
          <GroupOutlined /> Hierarchy View
        </span>
      ),
      children: <LocationHierarchy />,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        title={`Storage Locations (${total})`}
        extra={[
          <Input
            key="search"
            placeholder="Search locations..."
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
            onClick={handleAddLocation}
          >
            Add Location
          </Button>,
        ]}
      />
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
      <StorageLocationDrawer />
    </div>
  );
};

export default StorageLocationsListPage;
