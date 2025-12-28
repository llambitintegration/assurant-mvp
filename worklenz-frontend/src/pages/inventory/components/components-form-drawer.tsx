/**
 * Components Form Drawer
 * Form for creating and editing components
 */

import { useEffect } from 'react';
import { Drawer, Form, Input, InputNumber, Select, Radio, Button, Space, Row, Col } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  closeDrawer,
  createComponent,
  updateComponent,
} from '@/features/inventory/components/componentsSlice';
import { ICreateComponentDto, OwnerType } from '@/types/inventory/component.types';

const { Option } = Select;
const { TextArea } = Input;

const ComponentsFormDrawer = () => {
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();

  const {
    isDrawerOpen,
    selectedComponentId,
    drawerMode,
    components,
    isLoading,
  } = useAppSelector(state => state.inventoryComponents);

  const { suppliers } = useAppSelector(state => state.inventorySuppliers);
  const { locations } = useAppSelector(state => state.inventoryStorageLocations);

  const ownerType = Form.useWatch('owner_type', form);

  useEffect(() => {
    if (isDrawerOpen && selectedComponentId && drawerMode === 'edit') {
      const component = components.find(c => c.id === selectedComponentId);
      if (component) {
        form.setFieldsValue({
          name: component.name,
          sku: component.sku || '',
          description: component.description || '',
          category: component.category || '',
          owner_type: component.owner_type,
          supplier_id: component.supplier_id || undefined,
          storage_location_id: component.storage_location_id || undefined,
          quantity: component.quantity,
          unit: component.unit || '',
          unit_cost: component.unit_cost || undefined,
          reorder_level: component.reorder_level || undefined,
        });
      }
    } else if (isDrawerOpen && drawerMode === 'create') {
      form.resetFields();
      // Set default owner type
      form.setFieldsValue({ owner_type: OwnerType.SUPPLIER });
    }
  }, [isDrawerOpen, selectedComponentId, drawerMode, components, form]);

  const handleClose = () => {
    form.resetFields();
    dispatch(closeDrawer());
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Clean up the values based on owner type
      const data: ICreateComponentDto = {
        name: values.name,
        sku: values.sku || undefined,
        description: values.description || undefined,
        category: values.category || undefined,
        owner_type: values.owner_type,
        quantity: values.quantity,
        unit: values.unit || undefined,
        unit_cost: values.unit_cost || undefined,
        reorder_level: values.reorder_level || undefined,
      };

      // Add the appropriate owner ID
      if (values.owner_type === OwnerType.SUPPLIER) {
        data.supplier_id = values.supplier_id;
      } else {
        data.storage_location_id = values.storage_location_id;
      }

      if (drawerMode === 'create') {
        await dispatch(createComponent(data));
      } else if (selectedComponentId) {
        await dispatch(updateComponent({ id: selectedComponentId, data }));
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <Drawer
      title={drawerMode === 'create' ? 'Add Component' : 'Edit Component'}
      open={isDrawerOpen}
      onClose={handleClose}
      width={600}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit} loading={isLoading}>
              {drawerMode === 'create' ? 'Create' : 'Update'}
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, message: 'Please enter component name' }]}
        >
          <Input placeholder="Enter component name" />
        </Form.Item>

        <Form.Item name="sku" label="SKU">
          <Input placeholder="Enter SKU (optional)" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <TextArea rows={3} placeholder="Enter description (optional)" />
        </Form.Item>

        <Form.Item name="category" label="Category">
          <Input placeholder="Enter category (optional)" />
        </Form.Item>

        <Form.Item
          name="owner_type"
          label="Owner Type"
          rules={[{ required: true, message: 'Please select owner type' }]}
        >
          <Radio.Group>
            <Radio value={OwnerType.SUPPLIER}>Supplier</Radio>
            <Radio value={OwnerType.STORAGE_LOCATION}>Storage Location</Radio>
          </Radio.Group>
        </Form.Item>

        {ownerType === OwnerType.SUPPLIER && (
          <Form.Item
            name="supplier_id"
            label="Supplier"
            rules={[{ required: true, message: 'Please select a supplier' }]}
          >
            <Select
              placeholder="Select supplier"
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {suppliers.map(supplier => (
                <Option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {ownerType === OwnerType.STORAGE_LOCATION && (
          <Form.Item
            name="storage_location_id"
            label="Storage Location"
            rules={[{ required: true, message: 'Please select a storage location' }]}
          >
            <Select
              placeholder="Select storage location"
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {locations.map(location => (
                <Option key={location.id} value={location.id}>
                  {location.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="quantity"
              label="Quantity"
              rules={[
                { required: true, message: 'Please enter quantity' },
                { type: 'number', min: 0, message: 'Quantity must be positive' },
              ]}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder="0"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="unit" label="Unit">
              <Input placeholder="e.g., pcs, kg, m" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="unit_cost"
              label="Unit Cost ($)"
              rules={[{ type: 'number', min: 0, message: 'Cost must be positive' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="reorder_level"
              label="Reorder Level"
              rules={[{ type: 'number', min: 0, message: 'Reorder level must be positive' }]}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder="0"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
};

export default ComponentsFormDrawer;
