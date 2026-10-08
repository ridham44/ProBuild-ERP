'use client';

import { FolderKanban, Package, ShoppingCart, Truck, ClipboardList } from 'lucide-react';
import * as React from 'react';
import { canUser } from '@/features/auth/permissions';
import { api } from '@/lib/api/browser';
import { apiQuery, unwrapAs } from '@/lib/api/errors';
import type {
  ItemRow,
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
