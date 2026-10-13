import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns';
import { ContactStatus, PriorityLevel, ReminderStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd MMM yyyy');
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'dd MMM, hh:mm a');
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDueDate(date: string | Date): { label: string; urgent: boolean } {
  const d = new Date(date);
  if (isPast(d)) return { label: 'Overdue', urgent: true };
  if (isToday(d)) return { label: 'Today', urgent: true };
  if (isTomorrow(d)) return { label: 'Tomorrow', urgent: false };
  return { label: format(d, 'dd MMM'), urgent: false };
}

export function formatPhone(phone: string) {
  // Format as +91 XXXXX XXXXX for Indian numbers
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `+${digits}`;
}

export function formatBudget(amount: number | null | undefined) {
  if (!amount) return null;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function getContactStatusConfig(status: ContactStatus) {
  const configs: Record<ContactStatus, { label: string; color: string; bg: string }> = {
    new_lead:          { label: 'New Lead',          color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
    active_customer:   { label: 'Active',             color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    returning_customer:{ label: 'Returning',          color: 'text-violet-400', bg: 'bg-violet-400/10' },
    follow_up_required:{ label: 'Follow-up Required', color: 'text-amber-400',  bg: 'bg-amber-400/10'  },
    complaint:         { label: 'Complaint',          color: 'text-red-400',    bg: 'bg-red-400/10'    },
    closed:            { label: 'Closed',             color: 'text-zinc-400',   bg: 'bg-zinc-400/10'   },
    spam:              { label: 'Spam',               color: 'text-zinc-500',   bg: 'bg-zinc-500/10'   },
  };
  return configs[status] || configs.new_lead;
}

export function getPriorityConfig(priority: PriorityLevel) {
  const configs: Record<PriorityLevel, { label: string; color: string; dot: string }> = {
    high:   { label: 'High',   color: 'text-red-400',    dot: 'bg-red-400'    },
    medium: { label: 'Medium', color: 'text-amber-400',  dot: 'bg-amber-400'  },
    low:    { label: 'Low',    color: 'text-zinc-400',   dot: 'bg-zinc-400'   },
  };
  return configs[priority] || configs.medium;
}

export function getReminderStatusConfig(status: ReminderStatus) {
  const configs: Record<ReminderStatus, { label: string; color: string }> = {
    pending:   { label: 'Pending',   color: 'text-amber-400'  },
    sent:      { label: 'Sent',      color: 'text-blue-400'   },
    done:      { label: 'Completed', color: 'text-emerald-400' },
    cancelled: { label: 'Cancelled', color: 'text-zinc-500'   },
  };
  return configs[status] || configs.pending;
}

export function getInitials(name: string | null | undefined, fallback?: string): string {
  if (!name) return fallback?.charAt(0)?.toUpperCase() || '?';
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function getWhatsAppLink(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}

export function truncate(text: string, maxLen: number) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
