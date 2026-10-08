import {
  AlertCircle,
  Ban,
  BookCheck,
  Check,
  CircleDashed,
  CircleDot,
  Clock,
  Lock,
  Hourglass,
  Send,
  Trophy,
  Pause,
  CircleCheck,
  Flag,
  Quote,
  PackageCheck,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { titleCase } from '@/lib/format';

/** The single status vocabulary used across every document and workflow screen. */
export const STATUS_DEFINITIONS = {
  DRAFT: { label: 'Draft', tone: 'neutral', icon: CircleDashed },
  PENDING_APPROVAL: { label: 'Pending Approval', tone: 'pending', icon: Clock },
  APPROVED: { label: 'Approved', tone: 'approved', icon: Check },
  REJECTED: { label: 'Rejected', tone: 'rejected', icon: X },
  PARTIALLY_RECEIVED: { label: 'Partially Received', tone: 'info', icon: CircleDot },
  RECEIVED: { label: 'Received', tone: 'success', icon: PackageCheck },
  POSTED: { label: 'Posted', tone: 'info', icon: BookCheck },
  PAID: { label: 'Paid', tone: 'success', icon: Wallet },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', icon: Ban },
  CLOSED: { label: 'Closed', tone: 'neutral', icon: Lock },
  OVERDUE: { label: 'Overdue', tone: 'overdue', icon: AlertCircle },
  OPEN: { label: 'Open', tone: 'success', icon: CircleDot },
  ACTIVE: { label: 'Active', tone: 'success', icon: Check },
  INACTIVE: { label: 'Inactive', tone: 'neutral', icon: Ban },
  SUBMITTED: { label: 'Submitted', tone: 'pending', icon: Clock },
  PARTIALLY_ORDERED: { label: 'Partially Ordered', tone: 'info', icon: CircleDot },
  ORDERED: { label: 'Ordered', tone: 'success', icon: PackageCheck },
  SENT: { label: 'Sent', tone: 'info', icon: Send },
  QUOTED: { label: 'Quoted', tone: 'info', icon: Quote },
  AWARDED: { label: 'Awarded', tone: 'approved', icon: Trophy },
  NOT_AWARDED: { label: 'Not Awarded', tone: 'neutral', icon: Ban },
  INVITED: { label: 'Invited', tone: 'neutral', icon: Hourglass },
  DECLINED: { label: 'Declined', tone: 'rejected', icon: X },
  PIPELINE: { label: 'Pipeline', tone: 'neutral', icon: Flag },
  ON_HOLD: { label: 'On Hold', tone: 'warning', icon: Pause },
  COMPLETED: { label: 'Completed', tone: 'success', icon: CircleCheck },
} as const satisfies Record<string, { label: string; tone: BadgeTone; icon: LucideIcon }>;

export type StatusKey = keyof typeof STATUS_DEFINITIONS;

const ALIASES: Record<string, StatusKey> = {
  PENDING: 'PENDING_APPROVAL',
  CANCELED: 'CANCELLED',
};

function resolveStatus(raw: string): StatusKey | null {
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (key in STATUS_DEFINITIONS) return key as StatusKey;
  return ALIASES[key] ?? null;
}

export type StatusBadgeProps = { status: string; className?: string };

/** Accepts API enum values (PENDING, SUBMITTED, ...) and maps them to the shared vocabulary. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = resolveStatus(status);
  if (!key) return <Badge className={className}>{titleCase(status)}</Badge>;
  const { label, tone, icon: Icon } = STATUS_DEFINITIONS[key];
  return (
    <Badge tone={tone} className={className}>
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}
