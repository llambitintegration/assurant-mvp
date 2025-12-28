/**
 * Upload File Step
 * Step 2: Upload CSV file and import
 */

import { useState } from 'react';
import { Button, Card, Space, Typography, Upload, Alert, message } from '@/shared/antd-imports';
import { InboxOutlined } from '@/shared/antd-imports';
import type { UploadProps } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setStep, setFile, importCsv } from '@/features/inventory/csvImport/csvImportSlice';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

const UploadFileStep = () => {
  const dispatch = useAppDispatch();
  const { uploadedFile, loading, error } = useAppSelector(state => state.inventoryCsvImport);
  const [fileList, setFileList] = useState<any[]>([]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv',
    maxCount: 1,
    fileList,
    beforeUpload: (file) => {
      // Validate file type
      const isCsv = file.type === 'text/csv' || file.name.endsWith('.csv');
      if (!isCsv) {
        message.error('You can only upload CSV files!');
        return false;
      }

      // Validate file size (5MB max)
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('File must be smaller than 5MB!');
        return false;
      }

      // Store file in Redux state and local state
      dispatch(setFile(file));
      setFileList([file]);
      return false; // Prevent auto upload
    },
    onRemove: () => {
      dispatch(setFile(null));
      setFileList([]);
    },
  };

  const handleBack = () => {
    dispatch(setStep(0));
  };

  const handleImport = async () => {
    if (!uploadedFile) {
      message.error('Please select a file to upload');
      return;
    }

    try {
      await dispatch(importCsv(uploadedFile)).unwrap();
      message.success('CSV import completed');
      // Step will be automatically set to 2 by the reducer
    } catch (err: any) {
      message.error(err || 'Failed to import CSV');
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={4}>Step 2: Upload CSV File</Title>
        <Paragraph>
          Upload your prepared CSV file. The system will validate and import the components.
        </Paragraph>

        {error && (
          <Alert
            message="Import Error"
            description={error}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 24 }}
          />
        )}

        <Dragger {...uploadProps} disabled={loading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Click or drag CSV file to this area to upload</p>
          <p className="ant-upload-hint">
            Only .csv files are supported. Maximum file size: 5MB
          </p>
        </Dragger>

        {uploadedFile && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="File Ready"
              description={
                <div>
                  <Text strong>File:</Text> {uploadedFile.name}
                  <br />
                  <Text strong>Size:</Text> {(uploadedFile.size / 1024).toFixed(2)} KB
                </div>
              }
              type="success"
              showIcon
            />
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={handleBack}>
          Back
        </Button>
        <Button
          type="primary"
          onClick={handleImport}
          disabled={!uploadedFile}
          loading={loading}
        >
          Import Components
        </Button>
      </div>
    </Space>
  );
};

export default UploadFileStep;
