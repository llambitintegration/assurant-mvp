import { useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Switch,
  Select,
} from '@/shared/antd-imports';
import { useAppDispatch, useAppSelector } from '@/app/store';
import {
  closeDrawer,
  createStorageLocation,
  updateStorageLocation,
  fetchLocationHierarchy,
} from '@/features/inventory/storageLocations/storageLocationsSlice';
import { storageLocationsApiService } from '@/api/inventory/storage-locations.api.service';
import { appMessage } from '@/shared/antd-imports';

const { TextArea } = Input;

const StorageLocationDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    isDrawerOpen,
    drawerMode,
    selectedLocationId,
    isLoading,
    hierarchyData,
  } = useAppSelector(state => state.inventoryStorageLocations);
  const [form] = Form.useForm();

  // Load hierarchy data for parent location dropdown
  useEffect(() => {
    if (isDrawerOpen) {
      dispatch(fetchLocationHierarchy());
    }
  }, [isDrawerOpen, dispatch]);

  // Load location data when editing
  useEffect(() => {
    if (isDrawerOpen && drawerMode === 'edit' && selectedLocationId) {
      loadLocationData(selectedLocationId);
    } else if (isDrawerOpen && drawerMode === 'create') {
      form.resetFields();
    }
  }, [isDrawerOpen, drawerMode, selectedLocationId]);

  const loadLocationData = async (id: string) => {
    try {
      const response = await storageLocationsApiService.getStorageLocationById(id);
      if (response.body) {
        form.setFieldsValue({
          location_code: response.body.location_code,
          name: response.body.name,
          description: response.body.description,
          parent_location_id: response.body.parent_location_id,
          is_active: response.body.is_active,
        });
      }
    } catch (error) {
      appMessage.error('Failed to load storage location data');
    }
  };

  const handleClose = () => {
    form.resetFields();
    dispatch(closeDrawer());
  };

  const handleSubmit = async (values: any) => {
    try {
      if (drawerMode === 'edit' && selectedLocationId) {
        await dispatch(
          updateStorageLocation({
            id: selectedLocationId,
            data: values,
          })
        ).unwrap();
        appMessage.success('Storage location updated successfully');
      } else {
        await dispatch(createStorageLocation(values)).unwrap();
        appMessage.success('Storage location created successfully');
      }
      handleClose();
    } catch (error) {
      appMessage.error(
        drawerMode === 'edit'
          ? 'Failed to update storage location'
          : 'Failed to create storage location'
      );
    }
  };

  // Build parent location options from hierarchy
  const buildLocationOptions = () => {
    const options: { value: string; label: string }[] = [];

    const traverse = (items: any[], level = 0) => {
      items.forEach(item => {
        // Don't allow selecting itself as parent when editing
        if (drawerMode === 'edit' && item.id === selectedLocationId) {
          return;
        }

        const prefix = '  '.repeat(level);
        options.push({
          value: item.id,
          label: `${prefix}${item.location_code} - ${item.name}`,
        });

        if (item.children && item.children.length > 0) {
          traverse(item.children, level + 1);
        }
      });
    };

    traverse(hierarchyData);
    return options;
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {drawerMode === 'edit' ? 'Edit Storage Location' : 'Add New Storage Location'}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onClose={handleClose}
      width={500}
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" onClick={() => form.submit()} loading={isLoading}>
            {drawerMode === 'edit' ? 'Update' : 'Create'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="location_code"
          label="Location Code"
          rules={[
            {
              required: true,
              message: 'Please enter location code',
            },
          ]}
        >
          <Input placeholder="Enter location code (e.g., WH-A-01)" />
        </Form.Item>

        <Form.Item
          name="name"
          label="Location Name"
          rules={[
            {
              required: true,
              message: 'Please enter location name',
            },
          ]}
        >
          <Input placeholder="Enter location name" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <TextArea
            placeholder="Enter description"
            rows={3}
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item name="parent_location_id" label="Parent Location">
          <Select
            placeholder="Select parent location (optional)"
            allowClear
            showSearch
            optionFilterProp="label"
            options={buildLocationOptions()}
          />
        </Form.Item>

        {drawerMode === 'edit' && (
          <Form.Item
            name="is_active"
            label="Status"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
};

export default StorageLocationDrawer;
