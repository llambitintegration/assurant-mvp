import { useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Switch,
} from '@/shared/antd-imports';
import { useAppDispatch, useAppSelector } from '@/app/store';
import {
  closeDrawer,
  createSupplier,
  updateSupplier,
} from '@/features/inventory/suppliers/suppliersSlice';
import { suppliersApiService } from '@/api/inventory/suppliers.api.service';
import { appMessage } from '@/shared/antd-imports';

const { TextArea } = Input;

const SupplierDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isDrawerOpen, drawerMode, selectedSupplierId, isLoading } = useAppSelector(
    state => state.inventorySuppliers
  );
  const [form] = Form.useForm();

  // Load supplier data when editing
  useEffect(() => {
    if (isDrawerOpen && drawerMode === 'edit' && selectedSupplierId) {
      loadSupplierData(selectedSupplierId);
    } else if (isDrawerOpen && drawerMode === 'create') {
      form.resetFields();
    }
  }, [isDrawerOpen, drawerMode, selectedSupplierId]);

  const loadSupplierData = async (id: string) => {
    try {
      const response = await suppliersApiService.getSupplierById(id);
      if (response.body) {
        form.setFieldsValue({
          name: response.body.name,
          contact_person: response.body.contact_person,
          email: response.body.email,
          phone: response.body.phone,
          address: response.body.address,
          notes: response.body.notes,
          is_active: response.body.is_active,
        });
      }
    } catch (error) {
      appMessage.error('Failed to load supplier data');
    }
  };

  const handleClose = () => {
    form.resetFields();
    dispatch(closeDrawer());
  };

  const handleSubmit = async (values: any) => {
    try {
      if (drawerMode === 'edit' && selectedSupplierId) {
        await dispatch(
          updateSupplier({
            id: selectedSupplierId,
            data: values,
          })
        ).unwrap();
        appMessage.success('Supplier updated successfully');
      } else {
        await dispatch(createSupplier(values)).unwrap();
        appMessage.success('Supplier created successfully');
      }
      handleClose();
    } catch (error) {
      appMessage.error(
        drawerMode === 'edit'
          ? 'Failed to update supplier'
          : 'Failed to create supplier'
      );
    }
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {drawerMode === 'edit' ? 'Edit Supplier' : 'Add New Supplier'}
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
          name="name"
          label="Supplier Name"
          rules={[
            {
              required: true,
              message: 'Please enter supplier name',
            },
          ]}
        >
          <Input placeholder="Enter supplier name" />
        </Form.Item>

        <Form.Item name="contact_person" label="Contact Person">
          <Input placeholder="Enter contact person name" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            {
              type: 'email',
              message: 'Please enter a valid email',
            },
          ]}
        >
          <Input placeholder="Enter email address" />
        </Form.Item>

        <Form.Item name="phone" label="Phone">
          <Input placeholder="Enter phone number" />
        </Form.Item>

        <Form.Item name="address" label="Address">
          <TextArea
            placeholder="Enter address"
            rows={3}
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item name="notes" label="Notes">
          <TextArea
            placeholder="Enter any additional notes"
            rows={4}
            maxLength={1000}
            showCount
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

export default SupplierDrawer;
