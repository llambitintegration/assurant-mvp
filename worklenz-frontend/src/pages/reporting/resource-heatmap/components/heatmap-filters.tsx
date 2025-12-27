/**
 * Heatmap Filters Component
 * Filter controls for resource heatmap
 */

import { Card, Flex, Input, Segmented, Select, Space } from '@/shared/antd-imports';
import { SearchOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setGranularity,
  setSelectedDepartmentIds,
  setSelectedResourceTypes,
  setSelectedProjectId,
  setSearchQuery,
} from '@/features/reporting/resourceHeatmap/resourceHeatmapSlice';

const HeatmapFilters = () => {
  const dispatch = useAppDispatch();

  const { granularity, selectedDepartmentIds, selectedResourceTypes, selectedProjectId, searchQuery } =
    useAppSelector(state => state.resourceHeatmapReducer);

  return (
    <Card>
      <Flex gap={12} wrap="wrap" align="center">
        {/* Granularity Selector */}
        <Space direction="vertical" size={2}>
          <span style={{ fontSize: '12px', color: '#666' }}>Time Period</span>
          <Segmented
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
            ]}
            value={granularity}
            onChange={(value) => dispatch(setGranularity(value as 'daily' | 'weekly' | 'monthly'))}
          />
        </Space>

        {/* Resource Type Filter */}
        <Space direction="vertical" size={2} style={{ minWidth: '180px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>Resource Type</span>
          <Select
            mode="multiple"
            placeholder="All Types"
            style={{ width: '100%' }}
            value={selectedResourceTypes}
            onChange={(value) => dispatch(setSelectedResourceTypes(value))}
            options={[
              { label: 'Personnel', value: 'personnel' },
              { label: 'Equipment', value: 'equipment' },
            ]}
            allowClear
            maxTagCount="responsive"
          />
        </Space>

        {/* Department Filter - Placeholder for now */}
        <Space direction="vertical" size={2} style={{ minWidth: '200px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>Departments</span>
          <Select
            mode="multiple"
            placeholder="All Departments"
            style={{ width: '100%' }}
            value={selectedDepartmentIds}
            onChange={(value) => dispatch(setSelectedDepartmentIds(value))}
            allowClear
            maxTagCount="responsive"
          >
            {/* TODO: Load departments from API */}
          </Select>
        </Space>

        {/* Project Filter - Placeholder for now */}
        <Space direction="vertical" size={2} style={{ minWidth: '200px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>Project</span>
          <Select
            placeholder="All Projects"
            style={{ width: '100%' }}
            value={selectedProjectId}
            onChange={(value) => dispatch(setSelectedProjectId(value))}
            allowClear
          >
            {/* TODO: Load projects from API */}
          </Select>
        </Space>

        {/* Search Input */}
        <Space direction="vertical" size={2} style={{ minWidth: '250px', flex: 1 }}>
          <span style={{ fontSize: '12px', color: '#666' }}>Search Resources</span>
          <Input
            placeholder="Search by name..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            allowClear
          />
        </Space>
      </Flex>
    </Card>
  );
};

export default HeatmapFilters;
