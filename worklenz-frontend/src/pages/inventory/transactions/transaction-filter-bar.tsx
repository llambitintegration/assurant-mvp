/**
 * Transaction Filter Bar
 * Filtering component for transactions list
 */

import { useEffect } from 'react';
import { Card, Row, Col, Select, DatePicker, Button, Space } from '@/shared/antd-imports';
import { ClearOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setComponentFilter,
  setTransactionTypeFilter,
  setDateRange,
  setSearchQuery,
  resetFilters,
  fetchTransactions,
} from '@/features/inventory/transactions/transactionsSlice';
import { fetchComponents } from '@/features/inventory/components/componentsSlice';
import { TransactionType } from '@/types/inventory/transaction.types';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const TransactionFilterBar = () => {
  const dispatch = useAppDispatch();

  const { filters, dateRange } = useAppSelector(state => state.inventoryTransactions);
  const { components } = useAppSelector(state => state.inventoryComponents);

  // Fetch components for the filter dropdown
  useEffect(() => {
    dispatch(fetchComponents());
  }, [dispatch]);

  // Trigger fetch when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch(fetchTransactions());
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [filters, dateRange, dispatch]);

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      dispatch(setDateRange([
        dates[0].format('YYYY-MM-DD'),
        dates[1].format('YYYY-MM-DD'),
      ]));
    } else {
      dispatch(setDateRange(null));
    }
  };

  const handleClearFilters = () => {
    dispatch(resetFilters());
  };

  const hasActiveFilters =
    filters.component_id ||
    filters.transaction_type ||
    filters.search ||
    dateRange;

  // Default to last 30 days if no date range is set
  const defaultDateRange: [Dayjs, Dayjs] = [
    dayjs().subtract(30, 'days'),
    dayjs(),
  ];

  const currentDateRange: [Dayjs, Dayjs] | null = dateRange
    ? [dayjs(dateRange[0]), dayjs(dateRange[1])]
    : null;

  return (
    <Card size="small">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <RangePicker
              style={{ width: '100%' }}
              value={currentDateRange}
              onChange={handleDateRangeChange}
              format="YYYY-MM-DD"
              placeholder={['Start Date', 'End Date']}
              defaultValue={defaultDateRange}
            />
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="Transaction Type"
              style={{ width: '100%' }}
              value={filters.transaction_type}
              onChange={(value) => dispatch(setTransactionTypeFilter(value))}
              allowClear
            >
              <Option value={TransactionType.IN}>Stock In</Option>
              <Option value={TransactionType.OUT}>Stock Out</Option>
              <Option value={TransactionType.ADJUSTMENT}>Adjustment</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="Component"
              style={{ width: '100%' }}
              value={filters.component_id}
              onChange={(value) => dispatch(setComponentFilter(value))}
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {components.map(component => (
                <Option key={component.id} value={component.id}>
                  {component.name} {component.sku ? `(${component.sku})` : ''}
                </Option>
              ))}
            </Select>
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

export default TransactionFilterBar;
