// Raw submission data from database
export interface Submission {
  id: number;
  user_id: string;
  partner_store_name: string;
  partner_store_category: 'cafe' | 'restaurant' | 'others';
  status: 'pending' | 'approved' | 'rejected';
  selfie_url: string;
  receipt_url: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // User profile data (when joined)
  profiles?: {
    username: string | null;
    full_name: string | null;
  };
}

// Transformed submission for UI components
export interface TransformedSubmission {
  id: number;
  submissionDate: string;
  restaurantName: string;
  receiptPhoto: string;
  selfiePhoto: string;
  status: 'approved' | 'pending' | 'rejected';
  category: string;
  points?: number;
}

// Approved submission counts for badges
export interface ApprovedCounts {
  total: number;
  restaurant: number;
  cafe: number;
  others: number;
}

// Submission statistics
export interface SubmissionStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  byCategory: {
    cafe: number;
    restaurant: number;
    others: number;
  };
}

// Hook options for useSubmissions
export interface UseSubmissionsOptions {
  userId?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  includeUserProfiles?: boolean;
}