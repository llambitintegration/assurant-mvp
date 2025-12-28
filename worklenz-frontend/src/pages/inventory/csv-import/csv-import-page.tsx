/**
 * CSV Import Page
 * Multi-step wizard for importing components from CSV
 */

import { Flex, Steps } from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import DownloadTemplateStep from './steps/download-template-step';
import UploadFileStep from './steps/upload-file-step';
import ImportResultsStep from './steps/import-results-step';

const CsvImportPage = () => {
  useDocumentTitle('Import Components from CSV');

  const { currentStep } = useAppSelector(state => state.inventoryCsvImport);

  const steps = [
    {
      title: 'Download Template',
      description: 'Get CSV template',
    },
    {
      title: 'Upload File',
      description: 'Upload your CSV',
    },
    {
      title: 'View Results',
      description: 'Review import results',
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <DownloadTemplateStep />;
      case 1:
        return <UploadFileStep />;
      case 2:
        return <ImportResultsStep />;
      default:
        return <DownloadTemplateStep />;
    }
  };

  return (
    <Flex vertical gap={24}>
      <PageHeader
        className="site-page-header"
        title="Import Components from CSV"
        style={{ padding: '16px 0' }}
      />

      <Steps current={currentStep} items={steps} />

      <div style={{ marginTop: 24 }}>
        {renderStepContent()}
      </div>
    </Flex>
  );
};

export default CsvImportPage;
