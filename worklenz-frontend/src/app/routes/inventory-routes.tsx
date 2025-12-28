import { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import InventoryLayout from '@/layouts/InventoryLayout';

// Lazy load inventory page components
const InventoryDashboard = lazy(() => import('@/pages/inventory/dashboard/dashboard-page'));
const SuppliersList = lazy(() => import('@/pages/inventory/suppliers'));
const StorageLocationsList = lazy(() => import('@/pages/inventory/storage-locations'));
const ComponentsList = lazy(() => import('@/pages/inventory/components/components-list'));
const TransactionsList = lazy(() => import('@/pages/inventory/transactions/transactions-list'));
const CsvImport = lazy(() => import('@/pages/inventory/csv-import/csv-import-page'));

const inventoryRoutes: RouteObject[] = [
  {
    path: 'inventory',
    element: <InventoryLayout />,
    children: [
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <InventoryDashboard />
          </Suspense>
        ),
      },
      {
        path: 'suppliers',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <SuppliersList />
          </Suspense>
        ),
      },
      {
        path: 'storage-locations',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <StorageLocationsList />
          </Suspense>
        ),
      },
      {
        path: 'components',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <ComponentsList />
          </Suspense>
        ),
      },
      {
        path: 'transactions',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <TransactionsList />
          </Suspense>
        ),
      },
      {
        path: 'csv-import',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <CsvImport />
          </Suspense>
        ),
      },
    ],
  },
];

export default inventoryRoutes;
