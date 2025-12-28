/**
 * Import Results Step
 * Step 3: Display import results with success/error summary
 */

import { Button, Card, Space, Typography, Result, Statistic, Table, Alert, Row, Col } from '@/shared/antd-imports';
import { CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { resetImport, setStep } from '@/features/inventory/csvImport/csvImportSlice';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { ICsvImportError } from '@/types/inventory/csv-import.types';

const { Title, Paragraph, Text } = Typography;

const ImportResultsStep = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { importResult } = useAppSelector(state => state.inventoryCsvImport);

  if (!importResult) {
    return (
      <Card>
        <Result
          status="info"
          title="No Import Results"
          subTitle="Please complete the import process first"
          extra={
            <Button type="primary" onClick={() => dispatch(setStep(0))}>
              Start Import
            </Button>
          }
        />
      </Card>
    );
  }

  const hasErrors = importResult.errors.length > 0;
  const hasSuccesses = importResult.successful_imports > 0;

  const errorColumns: ColumnsType<ICsvImportError> = [
    {
      title: 'Row',
      dataIndex: 'row_number',
      key: 'row_number',
      width: 80,
      align: 'center',
    },
    {
      title: 'Error Field',
      dataIndex: 'error_field',
      key: 'error_field',
      width: 150,
      render: (field: string | undefined) => field ? <Text code>{field}</Text> : 'N/A',
    },
    {
      title: 'Error Message',
      dataIndex: 'error_message',
      key: 'error_message',
      render: (message: string) => <Text type="danger">{message}</Text>,
    },
    {
      title: 'Row Data',
      dataIndex: 'row_data',
      key: 'row_data',
      render: (data: any) => (
        <Text style={{ fontSize: 12 }}>
          {data.name ? `${data.name}` : ''}
          {data.sku ? ` (${data.sku})` : ''}
        </Text>
      ),
    },
  ];

  const handleDownloadErrors = () => {
    if (!importResult || importResult.errors.length === 0) return;

    // Create CSV with error details
    const headers = 'Row Number,Error Field,Error Message,Name,SKU,Category';
    const rows = importResult.errors.map((error: ICsvImportError) => {
      const data = error.row_data;
      return [
        error.row_number,
        error.error_field || '',
        `"${error.error_message.replace(/"/g, '""')}"`,
        data.name || '',
        data.sku || '',
        data.category || '',
      ].join(',');
    });
    const csvContent = `${headers}\n${rows.join('\n')}`;

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'import_errors.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportAnother = () => {
    dispatch(resetImport());
  };

  const handleViewComponents = () => {
    navigate('/inventory/components');
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Result
          status={hasErrors && !hasSuccesses ? 'error' : hasSuccesses ? 'success' : 'warning'}
          title={
            hasErrors && !hasSuccesses
              ? 'Import Failed'
              : hasSuccesses && !hasErrors
              ? 'Import Successful'
              : 'Import Completed with Errors'
          }
          subTitle={
            <div>
              <Paragraph>
                Your CSV import has been processed in {importResult.duration_ms}ms.
              </Paragraph>
              <Row gutter={16} style={{ marginTop: 24 }}>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="Total Rows"
                      value={importResult.total_rows}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="Successful Imports"
                      value={importResult.successful_imports}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="Failed Imports"
                      value={importResult.failed_imports}
                      valueStyle={{ color: importResult.failed_imports > 0 ? '#cf1322' : '#999' }}
                      prefix={<CloseCircleOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
            </div>
          }
        />
      </Card>

      {hasSuccesses && (
        <Card>
          <Alert
            message="Components Successfully Imported"
            description={`${importResult.successful_imports} component(s) have been added to your inventory.`}
            type="success"
            showIcon
          />
        </Card>
      )}

      {hasErrors && (
        <Card
          title="Import Errors"
          extra={
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadErrors}
            >
              Download Errors as CSV
            </Button>
          }
        >
          <Alert
            message="Some rows failed to import"
            description="Please review the errors below, fix the issues in your CSV file, and try importing again."
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            columns={errorColumns}
            dataSource={importResult.errors}
            rowKey={(record) => `${record.row_number}-${record.error_field}`}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={handleImportAnother}>
          Import Another File
        </Button>
        <Space>
          {hasSuccesses && (
            <Button type="primary" onClick={handleViewComponents}>
              View Components
            </Button>
          )}
        </Space>
      </div>
    </Space>
  );
};

export default ImportResultsStep;
