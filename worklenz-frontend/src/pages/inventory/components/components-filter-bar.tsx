/**
 * Components Filter Bar
 * Advanced filtering component for components list
 */

import { useEffect } from 'react';
import { Card, Row, Col, Input, Select, Switch, Button, Space } from '@/shared/antd-imports';
import { SearchOutlined, ClearOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setSearchQuery,
  setOwnerTypeFilter,
  setSupplierIdFilter,
  setStorageLocationIdFilter,
  setCategoryFilter,
  setLowStockFilter,
  resetFilters,
  fetchComponents,
} from '@/features/inventory/components/componentsSlice';
import { OwnerType } from '@/types/inventory/component.types';

const { Option } = Select;

const ComponentsFilterBar = () => {
  const dispatch = useAppDispatch();

  const {
    searchQuery,
    ownerTypeFilter,
    supplierIdFilter,
    storageLocationIdFilter,
    categoryFilter,
    lowStockFilter,
  } = useAppSelector(state => state.inventoryComponents);

  const { suppliers } = useAppSelector(state => state.inventorySuppliers);
  const { locations } = useAppSelector(state => state.inventoryStorageLocations);

  // Trigger fetch when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch(fetchComponents());
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [
    searchQuery,
    ownerTypeFilter,
    supplierIdFilter,
    storageLocationIdFilter,
    categoryFilter,
    lowStockFilter,
    dispatch,
  ]);

  const handleClearFilters = () => {
    dispatch(resetFilters());
  };

  const hasActiveFilters =
    searchQuery ||
    ownerTypeFilter ||
    supplierIdFilter ||
    storageLocationIdFilter ||
    categoryFilter ||
    lowStockFilter;

  return (
    <Card size="small">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Search components..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="Owner Type"
              style={{ width: '100%' }}
              value={ownerTypeFilter}
              onChange={(value) => {
                dispatch(setOwnerTypeFilter(value));
                // Clear owner-specific filters when type changes
                if (value !== OwnerType.SUPPLIER) {
                  dispatch(setSupplierIdFilter(undefined));
                }
                if (value !== OwnerType.STORAGE_LOCATION) {
                  dispatch(setStorageLocationIdFilter(undefined));
                }
              }}
              allowClear
            >
              <Option value={OwnerType.SUPPLIER}>Supplier</Option>
              <Option value={OwnerType.STORAGE_LOCATION}>Storage Location</Option>
            </Select>
          </Col>

          {/* Conditional Owner Select */}
          {ownerTypeFilter === OwnerType.SUPPLIER && (
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                placeholder="Select Supplier"
                style={{ width: '100%' }}
                value={supplierIdFilter}
                onChange={(value) => dispatch(setSupplierIdFilter(value))}
                allowClear
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
            </Col>
          )}

          {ownerTypeFilter === OwnerType.STORAGE_LOCATION && (
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                placeholder="Select Storage Location"
                style={{ width: '100%' }}
                value={storageLocationIdFilter}
                onChange={(value) => dispatch(setStorageLocationIdFilter(value))}
                allowClear
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
            </Col>
          )}

          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Category"
              value={categoryFilter}
              onChange={(e) => dispatch(setCategoryFilter(e.target.value || undefined))}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Space>
              <span>Low Stock Only:</span>
              <Switch
                checked={lowStockFilter || false}
                onChange={(checked) => dispatch(setLowStockFilter(checked || undefined))}
              />
            </Space>
          </Col>

          {hasActiveFilters && (
            <Col xs={24} sm={12} md={8} lg={6}>
              <Button
                icon={<ClearOutlined />}
                onClick={handleClearFilters}
                block
              >
                Clear Filters
              </Button>
            </Col>
          )}
        </Row>
      </Space>
    </Card>
  );
};

export default ComponentsFilterBar;
