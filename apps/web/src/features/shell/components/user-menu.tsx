'use client';

import { Keyboard, KeyRound, LogOut, MonitorSmartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { useLogout } from '@/features/auth/api/hooks';
import { useCurrentUser } from '@/features/auth/components/current-user';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function UserMenu({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const user = useCurrentUser();
  const router = useRouter();
  const logout = useLogout();

  function signOut(): void {
    logout.mutate(undefined, {
      onSuccess: () => {
        router.replace('/login');
        router.refresh();
      },
      onError: () => toast.error('Could not sign out', 'Check your connection and try again.'),
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg p-0.5 outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-surface-muted xl:pr-2.5"
          aria-label={`Account menu for ${user.name}`}
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-sidebar text-2xs font-semibold text-white ring-2 ring-accent/30">
            {initials(user.name)}
          </span>
          <span className="hidden max-w-36 text-left leading-tight xl:block">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            {user.roles.length > 0 ? (
              <span className="block truncate text-2xs text-muted-foreground">{user.roles[0]}</span>
            ) : null}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar text-xs font-semibold text-white">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        {user.roles.length > 0 ? (
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {user.roles.map((role) => (
              <span
                key={role}
                className="rounded-full bg-surface-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground"
              >
                {role}
              </span>
            ))}
          </div>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/account/sessions">
            <MonitorSmartphone className="size-3.5" aria-hidden />
            Sessions and devices
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/change-password">
            <KeyRound className="size-3.5" aria-hidden />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onShowShortcuts}>
          <Keyboard className="size-3.5" aria-hidden />
          Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} disabled={logout.isPending}>
          <LogOut className="size-3.5" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
