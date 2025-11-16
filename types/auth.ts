export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  dateOfBirth: Date;
  gender: string;
  invitationCode?: string;
}

export interface AuthContextType {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, dateOfBirth: string, gender: string, invitationCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  forceClearAuth: () => Promise<void>;
}