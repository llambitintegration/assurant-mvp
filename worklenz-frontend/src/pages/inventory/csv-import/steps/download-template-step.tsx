/**
 * Download Template Step
 * Step 1: Download CSV template and view instructions
 */

import { Button, Card, Space, Table, Typography, Alert } from '@/shared/antd-imports';
import { DownloadOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setStep } from '@/features/inventory/csvImport/csvImportSlice';
import type { ColumnsType } from 'antd/es/table';

const { Title, Paragraph, Text } = Typography;

interface ITemplateField {
  field: string;
  description: string;
  required: boolean;
  example: string;
}

const DownloadTemplateStep = () => {
  const dispatch = useAppDispatch();

  const templateFields: ITemplateField[] = [
    {
      field: 'name',
      description: 'Component name',
      required: true,
      example: 'Arduino Uno R3',
    },
    {
      field: 'sku',
      description: 'Stock Keeping Unit (unique identifier)',
      required: false,
      example: 'ARD-UNO-R3-001',
    },
    {
      field: 'description',
      description: 'Component description',
      required: false,
      example: 'Microcontroller board based on ATmega328P',
    },
    {
      field: 'category',
      description: 'Component category',
      required: false,
      example: 'Microcontrollers',
    },
    {
      field: 'owner_type',
      description: 'Either "supplier" or "storage_location"',
      required: true,
      example: 'supplier',
    },
    {
      field: 'supplier_name',
      description: 'Supplier name (if owner_type is supplier)',
      required: false,
      example: 'Arduino Store',
    },
    {
      field: 'location_code',
      description: 'Storage location code (if owner_type is storage_location)',
      required: false,
      example: 'WH-A-01',
    },
    {
      field: 'quantity',
      description: 'Initial quantity',
      required: false,
      example: '50',
    },
    {
      field: 'unit',
      description: 'Unit of measurement',
      required: false,
      example: 'pcs',
    },
    {
      field: 'unit_cost',
      description: 'Cost per unit',
      required: false,
      example: '24.95',
    },
    {
      field: 'reorder_level',
      description: 'Minimum stock level before reorder',
      required: false,
      example: '10',
    },
  ];

  const columns: ColumnsType<ITemplateField> = [
    {
      title: 'Field',
      dataIndex: 'field',
      key: 'field',
      render: (text: string, record: ITemplateField) => (
        <Text strong={record.required}>
          {text}
          {record.required && <Text type="danger"> *</Text>}
        </Text>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Example',
      dataIndex: 'example',
      key: 'example',
      render: (text: string) => <Text code>{text}</Text>,
    },
  ];

  const handleDownloadTemplate = () => {
    // Create CSV template
    const headers = templateFields.map(f => f.field).join(',');
    const exampleRow = templateFields.map(f => f.example).join(',');
    const csvContent = `${headers}\n${exampleRow}\n`;

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNext = () => {
    dispatch(setStep(1));
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={4}>Step 1: Download CSV Template</Title>
        <Paragraph>
          Before importing components, download the CSV template to ensure your data is in the correct format.
        </Paragraph>

        <Alert
          message="Important Instructions"
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>Fields marked with * are required</li>
              <li>Owner type must be either "supplier" or "storage_location"</li>
              <li>If owner_type is "supplier", provide supplier_name</li>
              <li>If owner_type is "storage_location", provide location_code</li>
              <li>Numeric fields (quantity, unit_cost, reorder_level) should contain only numbers</li>
              <li>Do not modify the header row</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
          >
            Download Template
          </Button>
        </Space>
      </Card>

      <Card title="CSV Template Structure">
        <Table
          columns={columns}
          dataSource={templateFields}
          rowKey="field"
          pagination={false}
          size="small"
        />
      </Card>

      <div style={{ textAlign: 'right' }}>
        <Button type="primary" onClick={handleNext}>
          Next: Upload File
        </Button>
      </div>
    </Space>
  );
};

export default DownloadTemplateStep;
