'use client';

import { ClipboardCheck, ClipboardList, FolderKanban, Package, PackageCheck, PackageMinus, ShoppingCart, Truck } from 'lucide-react';
import * as React from 'react';
import { canUser } from '@/features/auth/permissions';
import { api } from '@/lib/api/browser';
import { apiQuery, unwrapAs } from '@/lib/api/errors';
import type {
  GoodsReceiptRow,
  ItemRow,
  MaterialIssueRow,
  MaterialRequestRow,
  Page,
  ProjectRow,
  PurchaseOrderRow,
  RequisitionRow,
  Supplier,
} from '@/lib/api/types';
import { registerSearchProvider, type SearchProvider } from './registry';

const LIMIT = 5;

/** Command-palette providers over the real list endpoints with `search`. Each checks VIEW before calling. */
export const DOMAIN_PROVIDERS: SearchProvider[] = [
  {
    id: 'projects',
    group: 'Projects',
    order: 10,
    search: async (query, { user, signal }) => {
      if (!canUser(user, 'projects.project', 'VIEW')) return [];
      const page = unwrapAs<Page<ProjectRow>>(
        await api.GET('/v1/projects', { params: { query: apiQuery({ search: query, limit: LIMIT }) }, signal }),
      );
      return page.items.map((project) => ({
        id: `project:${project.id}`,
        title: project.name,
        subtitle: `${project.code} · ${project.customer.name}`,
        href: `/projects/${project.id}`,
        icon: FolderKanban,
      }));
    },
  },
  {
    id: 'purchase-orders',
    group: 'Purchase orders',
    order: 20,
    search: async (query, { user, signal }) => {
      if (!canUser(user, 'procurement.order', 'VIEW')) return [];
      const page = unwrapAs<Page<PurchaseOrderRow>>(
        await api.GET('/v1/purchase-orders', { params: { query: apiQuery({ search: query, limit: LIMIT }) }, signal }),
      );
      return page.items.map((po) => ({
        id: `po:${po.id}`,
        title: po.number,
        subtitle: `${po.supplier.name} · ${po.project.code}`,
        href: `/procurement/orders/${po.id}`,
        icon: ShoppingCart,
      }));
    },
  },
  {
    id: 'requisitions',
    group: 'Requisitions',
    order: 25,
    search: async (query, { user, signal }) => {
      if (!canUser(user, 'procurement.requisition', 'VIEW')) return [];
      const page = unwrapAs<Page<RequisitionRow>>(
        await api.GET('/v1/requisitions', { params: { query: apiQuery({ search: query, limit: LIMIT }) }, signal }),
      );
      return page.items.map((pr) => ({
        id: `pr:${pr.id}`,
        title: pr.number,
        subtitle: pr.purpose ?? pr.project.name,
        href: `/procurement/requests/${pr.id}`,
        icon: ClipboardList,
      }));
    },
  },
  {
    id: 'goods-receipts',
    group: 'Goods receipts',
    order: 26,
    search: async (query, { user, signal }) => {
      if (!canUser(user, 'procurement.receipt', 'VIEW')) return [];
      const page = unwrapAs<Page<GoodsReceiptRow>>(
        await api.GET('/v1/goods-receipts', { params: { query: apiQuery({ search: query, limit: LIMIT }) }, signal }),
      );
      return page.items.map((receipt) => ({
        id: `grn:${receipt.id}`,
        title: receipt.number,
        subtitle: `${receipt.supplier.name} · ${receipt.order.number}`,
        href: `/inventory/receipts/${receipt.id}`,
        icon: PackageCheck,
      }));
    },
  },
  {
    id: 'material-requests',
    group: 'Material requests',
    order: 27,
    search: async (query, { user, signal }) => {
      if (!canUser(user, 'inventory.request', 'VIEW')) return [];
      const page = unwrapAs<Page<MaterialRequestRow>>(
        await api.GET('/v1/material-requests', { params: { query: apiQuery({ search: query, limit: LIMIT }) }, signal }),
      );
      return page.items.map((request) => ({
        id: `mr:${request.id}`,
        title: request.number,
        subtitle: request.purpose ?? request.project.name,
        href: `/inventory/material-requests/${request.id}`,
        icon: ClipboardCheck,
      }));
    },
  },
  {
    id: 'material-issues',
    group: 'Material issues',
    order: 28,
    search: async (query, { user, signal }) => {
      if (!canUser(user, 'inventory.issue', 'VIEW')) return [];
      const page = unwrapAs<Page<MaterialIssueRow>>(
        await api.GET('/v1/material-issues', { params: { query: apiQuery({ search: query, limit: LIMIT }) }, signal }),
      );
      return page.items.map((issue) => ({
        id: `mi:${issue.id}`,
        title: issue.number,
        subtitle: `${issue.project.name} · ${issue.warehouse.name}`,
        href: `/inventory/material-issues/${issue.id}`,
        icon: PackageMinus,
      }));
    },
  },
  {
    id: 'suppliers',
    group: 'Suppliers',
    order: 30,
    search: async (query, { user, signal }) => {
      if (!canUser(user, 'parties.supplier', 'VIEW')) return [];
      const page = unwrapAs<Page<Supplier>>(
        await api.GET('/v1/suppliers', { params: { query: apiQuery({ search: query, limit: LIMIT }) }, signal }),
      );
      return page.items.map((supplier) => ({
        id: `supplier:${supplier.id}`,
        title: supplier.name,
        subtitle: supplier.code,
        href: `/procurement/suppliers/${supplier.id}`,
        icon: Truck,
      }));
    },
  },
  {
    id: 'items',
    group: 'Items',
    order: 40,
    search: async (query, { user, signal }) => {
      if (!canUser(user, 'inventory.item', 'VIEW')) return [];
      const page = unwrapAs<Page<ItemRow>>(
        await api.GET('/v1/items', { params: { query: apiQuery({ search: query, limit: LIMIT }) }, signal }),
      );
      return page.items.map((item) => ({
        id: `item:${item.id}`,
        title: item.name,
        subtitle: `${item.sku} · ${item.baseUnit}`,
        href: `/inventory/items/${item.id}`,
        icon: Package,
      }));
    },
  },
];

/** Registers the domain providers for the lifetime of the signed-in shell. */
export function useRegisterDomainSearchProviders(): void {
  React.useEffect(() => {
    const cleanups = DOMAIN_PROVIDERS.map((provider) => registerSearchProvider(provider));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
}
