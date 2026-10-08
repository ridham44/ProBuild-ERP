'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type UrlTab = {
  id: string;
  label: string;
  /** Small count shown after the label, only when known. */
  count?: number | undefined;
  content: React.ReactNode;
};

/** Tabs whose selection lives in `?tab=` so a refresh or shared link opens the same tab. */
export function UrlTabs({ tabs, label }: { tabs: UrlTab[]; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get('tab');
  const active = tabs.some((tab) => tab.id === requested) ? (requested as string) : tabs[0]?.id;

  function select(next: string): void {
    const query = new URLSearchParams(params.toString());
    query.set('tab', next);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={active} onValueChange={select}>
      <TabsList aria-label={label} className="overflow-y-hidden">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
            {tab.count !== undefined ? (
              <span className="num rounded-sm bg-surface-muted px-1 text-2xs text-muted-foreground">
                {tab.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
