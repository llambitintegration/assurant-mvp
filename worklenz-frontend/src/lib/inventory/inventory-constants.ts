import React from 'react';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ShopOutlined,
  EnvironmentOutlined,
  SwapOutlined,
  UploadOutlined,
} from '@ant-design/icons';

export interface InventoryMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  adminOnly?: boolean;
}

export const INVENTORY_MENU_ITEMS: InventoryMenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: React.createElement(DashboardOutlined),
    path: '/inventory/dashboard',
  },
  {
    key: 'components',
    label: 'Components',
    icon: React.createElement(ShoppingOutlined),
    path: '/inventory/components',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    icon: React.createElement(ShopOutlined),
    path: '/inventory/suppliers',
  },
  {
    key: 'locations',
    label: 'Storage Locations',
    icon: React.createElement(EnvironmentOutlined),
    path: '/inventory/storage-locations',
  },
  {
    key: 'transactions',
    label: 'Transactions',
    icon: React.createElement(SwapOutlined),
    path: '/inventory/transactions',
  },
  {
    key: 'import',
    label: 'CSV Import',
    icon: React.createElement(UploadOutlined),
    path: '/inventory/csv-import',
  },
];

export const INVENTORY_BASE_PATH = '/inventory';
