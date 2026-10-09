'use client';

import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs';
import { ModuleIconTile, usePageModule } from './page-module';

export type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  /** Status badges or identifiers shown beside the title. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Overrides the module icon taken from the route; `null` hides it. */
  icon?: LucideIcon | null;
  className?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  meta,
  actions,
  icon,
  className,
}: PageHeaderProps) {
  const pageModule = usePageModule();
  const Icon = icon === null ? null : (icon ?? pageModule?.icon ?? null);
  return (
    <header className={cn('mb-6 space-y-3', className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          {Icon ? (
            <ModuleIconTile
              icon={Icon}
              tone={pageModule?.tone ?? 'primary'}
              className="mt-0.5 hidden sm:flex"
            />
          ) : null}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
              {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
            </div>
            {description ? (
              <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
