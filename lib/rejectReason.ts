// Maps the internal `submissions.admin_notes` (written by the AI reviewer or a
// human admin) to a short, member-friendly reason. We deliberately do NOT show
// the raw notes — they contain internal phrasing ("AI review flagged…", issue
// dumps) that would confuse users. Unknown notes fall back to a generic line.

interface ReasonRule {
  match: RegExp;
  message: string;
}

// First matching rule wins, so order most-specific → most-general.
const RULES: ReasonRule[] = [
  { match: /duplicate|already (been )?(claimed|submitted)|same store.*same date/i,
    message: 'This receipt looks like one that was already submitted.' },
  { match: /older than|21[-\s]?day|6 months|too old/i,
    message: 'The receipt is outside the allowed date window.' },
  { match: /no person|face|person_visible|person detected/i,
    message: "We couldn't clearly see your face in the selfie." },
  { match: /receipt (not )?visible in selfie|receipt_visible/i,
    message: 'Your selfie needs to show the paper receipt too.' },
  { match: /merchant name|does not match|doesn't match.*store|wrong (branch|store)/i,
    message: "The receipt doesn't match the store you selected." },
  { match: /postal code|city .* does not match|address/i,
    message: "The receipt's location doesn't match the store." },
  { match: /diner|buffet.*(limit|claimed)|pax/i,
    message: 'This buffet receipt has already been claimed by the maximum number of diners.' },
  { match: /exceeds .* size|too large|oversize/i,
    message: 'One of your photos was too large. Please upload a smaller image.' },
  { match: /not detected|unreadable|could ?n[o']t (read|parse)|blur/i,
    message: "We couldn't read the receipt clearly — try a sharper, well-lit photo." },
];

const GENERIC = "This submission didn't meet our verification requirements.";

export function friendlyRejectReason(adminNotes: string | null | undefined): string {
  if (!adminNotes || !adminNotes.trim()) return GENERIC;
  for (const rule of RULES) {
    if (rule.match.test(adminNotes)) return rule.message;
  }
  return GENERIC;
}
