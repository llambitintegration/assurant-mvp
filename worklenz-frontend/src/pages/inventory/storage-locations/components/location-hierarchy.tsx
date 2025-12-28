import { useEffect, useMemo } from 'react';
import { Tree, Card, Empty, Spin, Tag, Space, Button, Tooltip } from '@/shared/antd-imports';
import { EditOutlined, DeleteOutlined } from '@/shared/antd-imports';
import type { TreeDataNode } from 'antd/es';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { fetchLocationHierarchy, openDrawer } from '@/features/inventory/storageLocations/storageLocationsSlice';
import { ILocationHierarchy } from '@/types/inventory/storage-location.types';

const LocationHierarchy: React.FC = () => {
  const dispatch = useAppDispatch();
  const { hierarchyData, isLoading } = useAppSelector(
    state => state.inventoryStorageLocations
  );

  useEffect(() => {
    dispatch(fetchLocationHierarchy());
  }, [dispatch]);

  // Convert hierarchy data to Ant Design Tree format
  const convertToTreeData = (items: ILocationHierarchy[]): TreeDataNode[] => {
    return items.map(item => ({
      key: item.id,
      title: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 0',
          }}
        >
          <Space>
            <strong>{item.location_code}</strong>
            <span>{item.name}</span>
            <Tag color={item.is_active ? 'green' : 'red'} style={{ marginLeft: 8 }}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Tag>
          </Space>
          <Space size="small">
            <Tooltip title="Edit">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(openDrawer({ mode: 'edit', locationId: item.id }));
                }}
              />
            </Tooltip>
          </Space>
        </div>
      ),
      children: item.children && item.children.length > 0
        ? convertToTreeData(item.children)
        : undefined,
    }));
  };

  const treeData = useMemo(
    () => convertToTreeData(hierarchyData),
    [hierarchyData]
  );

  if (isLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="Loading hierarchy..." />
        </div>
      </Card>
    );
  }

  if (!hierarchyData || hierarchyData.length === 0) {
    return (
      <Card>
        <Empty description="No storage locations found" />
      </Card>
    );
  }

  return (
    <Card>
      <Tree
        showLine
        defaultExpandAll
        treeData={treeData}
        style={{ padding: '16px 0' }}
      />
    </Card>
  );
};

export default LocationHierarchy;
