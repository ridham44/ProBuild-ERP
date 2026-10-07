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
          className="flex size-8 items-center justify-center rounded bg-foreground text-xs font-semibold text-background hover:opacity-90"
          aria-label={`Account menu for ${user.name}`}
        >
          {initials(user.name)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          {user.roles.length > 0 ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{user.roles.join(', ')}</p>
          ) : null}
        </div>
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
