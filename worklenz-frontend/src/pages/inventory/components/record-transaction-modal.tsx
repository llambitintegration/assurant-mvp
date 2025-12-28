/**
 * Record Transaction Modal
 * Modal for recording component inventory transactions
 */

import { useEffect, useMemo } from 'react';
import { Modal, Form, Radio, InputNumber, Input, Alert, Space, Typography } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { closeModal, createTransaction } from '@/features/inventory/transactions/transactionsSlice';
import { TransactionType, ICreateTransactionDto } from '@/types/inventory/transaction.types';

const { TextArea } = Input;
const { Text } = Typography;

interface RecordTransactionModalProps {
  componentId: string | null;
}

const RecordTransactionModal = ({ componentId }: RecordTransactionModalProps) => {
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();

  const { isModalOpen, isLoading } = useAppSelector(state => state.inventoryTransactions);
  const { components } = useAppSelector(state => state.inventoryComponents);

  const component = useMemo(
    () => components.find(c => c.id === componentId),
    [components, componentId]
  );

  const transactionType = Form.useWatch('transaction_type', form);
  const quantity = Form.useWatch('quantity', form);

  const calculatedNewQuantity = useMemo(() => {
    if (!component || !quantity) return component?.quantity || 0;

    switch (transactionType) {
      case TransactionType.IN:
        return component.quantity + quantity;
      case TransactionType.OUT:
        return component.quantity - quantity;
      case TransactionType.ADJUSTMENT:
        // For adjustment, the quantity field represents the final quantity
        return quantity;
      default:
        return component.quantity;
    }
  }, [component, transactionType, quantity]);

  const isValidTransaction = useMemo(() => {
    if (!component || !quantity) return true;

    if (transactionType === TransactionType.OUT) {
      return quantity <= component.quantity;
    }

    if (transactionType === TransactionType.ADJUSTMENT) {
      return quantity >= 0;
    }

    return true;
  }, [component, transactionType, quantity]);

  useEffect(() => {
    if (isModalOpen) {
      form.resetFields();
      form.setFieldsValue({
        transaction_type: TransactionType.IN,
      });
    }
  }, [isModalOpen, form]);

  const handleClose = () => {
    form.resetFields();
    dispatch(closeModal());
  };

  const handleSubmit = async () => {
    if (!component) return;

    try {
      const values = await form.validateFields();

      let actualQuantity = values.quantity;

      // For adjustment, calculate the difference
      if (values.transaction_type === TransactionType.ADJUSTMENT) {
        actualQuantity = values.quantity - component.quantity;
      }

      const data: ICreateTransactionDto = {
        component_id: component.id,
        transaction_type: values.transaction_type,
        quantity: Math.abs(actualQuantity),
        reference_number: values.reference_number || undefined,
        notes: values.notes || undefined,
      };

      await dispatch(createTransaction(data));
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  if (!component) {
    return null;
  }

  return (
    <Modal
      title="Record Transaction"
      open={isModalOpen}
      onCancel={handleClose}
      onOk={handleSubmit}
      okText="Submit"
      cancelText="Cancel"
      confirmLoading={isLoading}
      okButtonProps={{ disabled: !isValidTransaction }}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Alert
          message={
            <Space direction="vertical" size={0}>
              <Text strong>{component.name}</Text>
              <Text type="secondary">Current Quantity: {component.quantity} {component.unit || ''}</Text>
            </Space>
          }
          type="info"
          style={{ marginBottom: 16 }}
        />

        <Form.Item
          name="transaction_type"
          label="Transaction Type"
          rules={[{ required: true, message: 'Please select transaction type' }]}
        >
          <Radio.Group>
            <Radio.Button value={TransactionType.IN}>Stock In</Radio.Button>
            <Radio.Button value={TransactionType.OUT}>Stock Out</Radio.Button>
            <Radio.Button value={TransactionType.ADJUSTMENT}>Adjustment</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="quantity"
          label={
            transactionType === TransactionType.ADJUSTMENT
              ? 'New Quantity'
              : 'Quantity'
          }
          rules={[
            { required: true, message: 'Please enter quantity' },
            { type: 'number', min: 0, message: 'Quantity must be positive' },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();

                if (transactionType === TransactionType.OUT && value > component.quantity) {
                  return Promise.reject(
                    new Error(`Cannot remove more than current quantity (${component.quantity})`)
                  );
                }

                return Promise.resolve();
              },
            },
          ]}
          help={
            transactionType === TransactionType.ADJUSTMENT
              ? 'Enter the final quantity after adjustment'
              : 'Enter the quantity to add or remove'
          }
        >
          <InputNumber
            min={0}
            precision={0}
            style={{ width: '100%' }}
            placeholder="Enter quantity"
          />
        </Form.Item>

        {quantity && (
          <Alert
            message={
              <Space>
                <Text>Preview:</Text>
                <Text strong>
                  Current: {component.quantity} {component.unit || ''}
                </Text>
                <Text type="secondary">→</Text>
                <Text strong type={isValidTransaction ? 'success' : 'danger'}>
                  New: {calculatedNewQuantity} {component.unit || ''}
                </Text>
                {transactionType === TransactionType.ADJUSTMENT && (
                  <Text type="secondary">
                    ({calculatedNewQuantity - component.quantity >= 0 ? '+' : ''}
                    {calculatedNewQuantity - component.quantity})
                  </Text>
                )}
              </Space>
            }
            type={isValidTransaction ? 'success' : 'error'}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item name="reference_number" label="Reference Number (Optional)">
          <Input placeholder="e.g., PO-12345, WO-67890" />
        </Form.Item>

        <Form.Item name="notes" label="Notes (Optional)">
          <TextArea rows={3} placeholder="Add any additional notes..." />
        </Form.Item>

        {!isValidTransaction && (
          <Alert
            message="Invalid Transaction"
            description="The transaction would result in a negative quantity."
            type="error"
            showIcon
          />
        )}
      </Form>
    </Modal>
  );
};

export default RecordTransactionModal;
