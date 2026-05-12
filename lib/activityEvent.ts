import type { ActivityEvent } from '@/hooks/useActivity';

export interface EventDescriptor {
  target: string;
  status: { text: string; tone: 'approved' | 'rejected' | 'neutral' } | null;
  trailing: { text: string; tone: 'star' | 'progress' | 'voucher' | 'visit' } | null;
}

// Source of truth for History row rendering. Used by both the History snippet
// on My Tasks and the standalone /tasks/history page so they stay in sync.
// See documentation/history-feed.md for the canonical event vocabulary.
export function describeActivityEvent(event: ActivityEvent): EventDescriptor {
  switch (event.event_type) {
    case 'submission_approved': {
      const countsForVisit10 = !!event.metadata?.counts_for_visit_10;
      return {
        target: event.target,
        status: { text: 'Approved', tone: 'approved' },
        trailing: countsForVisit10
          ? { text: '+1 visit', tone: 'visit' }
          : null,
      };
    }
    case 'submission_rejected':
      return {
        target: event.target,
        status: { text: 'Rejected', tone: 'rejected' },
        trailing: null,
      };
    case 'share_verified': {
      const stars = Number(event.metadata?.stars_awarded ?? 15);
      return {
        target: event.target,
        status: null,
        trailing: { text: `+${stars} ★`, tone: 'star' },
      };
    }
    case 'daily_streak_milestone': {
      const stars = Number(event.metadata?.stars_awarded ?? 50);
      return {
        target: event.target,
        status: null,
        trailing: { text: `+${stars} ★`, tone: 'star' },
      };
    }
    case 'referral_qualified': {
      const stars = Number(event.metadata?.stars_awarded ?? 100);
      return {
        target: event.target,
        status: null,
        trailing: { text: `+${stars} ★`, tone: 'star' },
      };
    }
    case 'stars_converted':
      return {
        target: event.target,
        status: null,
        trailing: { text: '+1 progress', tone: 'progress' },
      };
    case 'cycle_completed':
      return {
        target: event.target,
        status: null,
        trailing: { text: '+1 voucher', tone: 'voucher' },
      };
    case 'visit_badge_earned':
    case 'category_badge_earned':
      return {
        target: `Earned ${event.target}`,
        status: null,
        trailing: null,
      };
    case 'voucher_redemption_requested':
      return {
        target: event.target,
        status: { text: 'Requested', tone: 'neutral' },
        trailing: null,
      };
    default:
      return {
        target: event.target,
        status: null,
        trailing: null,
      };
  }
}
