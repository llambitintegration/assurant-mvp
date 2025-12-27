/**
 * Resource Heatmap Page
 * Main page component for resource capacity visualization
 */

import { Button, Card, Dropdown, Flex, Space, Tabs, Typography } from '@/shared/antd-imports';
import { DownOutlined } from '@/shared/antd-imports';
import { useEffect } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAuthService } from '@/hooks/useAuth';
import CustomPageHeader from '../page-header/custom-page-header';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import { fetchHeatmapData, setActiveTab } from '@/features/reporting/resourceHeatmap/resourceHeatmapSlice';
import { resourceHeatmapApiService } from '@/api/reporting/resource-heatmap.api.service';
import HeatmapFilters from './components/heatmap-filters';
import StatsCards from './components/stats-cards';
import HeatmapVisualization from './components/heatmap-visualization';
import ResourceHeatmapTable from './components/resource-heatmap-table';

const { TabPane } = Tabs;

const ResourceHeatmap = () => {
  const { t } = useTranslation('reporting');
  const dispatch = useAppDispatch();
  useDocumentTitle('Reporting - Resource Heatmap');
  const currentSession = useAuthService().getCurrentSession();

  const { total, activeTab, granularity, selectedDepartmentIds, selectedResourceTypes, selectedProjectId } =
    useAppSelector(state => state.resourceHeatmapReducer);
  const { dateRange } = useAppSelector(state => state.reportingReducer);

  const handleExport = () => {
    if (!currentSession?.team_name) return;
    resourceHeatmapApiService.exportHeatmap(currentSession.team_name, {
      start_date: dateRange[0],
      end_date: dateRange[1],
      granularity,
      department_ids: selectedDepartmentIds.length > 0 ? selectedDepartmentIds : undefined,
      resource_types: selectedResourceTypes.length > 0 ? selectedResourceTypes : undefined,
      project_id: selectedProjectId || undefined,
    });
  };

  useEffect(() => {
    if (dateRange && dateRange.length === 2) {
      dispatch(fetchHeatmapData());
    }
  }, [dateRange, granularity, selectedDepartmentIds, selectedResourceTypes, selectedProjectId, dispatch]);

  return (
    <Flex vertical gap={16}>
      <CustomPageHeader
        title={`Resource Heatmap (${total})`}
        children={
          <Space>
            <TimeWiseFilter />

            <Dropdown menu={{ items: [{ key: '1', label: t('Excel') }], onClick: handleExport }}>
              <Button type="primary" icon={<DownOutlined />} iconPosition="end">
                {t('Export')}
              </Button>
            </Dropdown>
          </Space>
        }
      />

      <HeatmapFilters />

      <StatsCards />

      <Card>
        <Tabs activeKey={activeTab} onChange={(key) => dispatch(setActiveTab(key as 'heatmap' | 'table'))}>
          <TabPane tab="Heatmap View" key="heatmap">
            <HeatmapVisualization />
          </TabPane>
          <TabPane tab="Table View" key="table">
            <ResourceHeatmapTable />
          </TabPane>
        </Tabs>
      </Card>
    </Flex>
  );
};

export default ResourceHeatmap;
