import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiCall, authenticatedApiCall } from '@/lib/api';

// Types
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  timezone?: string;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
}

interface CareRecipient {
  id: string;
  name: string;
  dateOfBirth?: string;
  gender?: string;
  condition?: string;
}

interface Caregiver {
  id: string;
  name: string;
  username?: string;
  careRecipientId: string;
}

interface AuthContextType {
  // State - active token for API calls
  token: string | null;
  user: User | null;
  careRecipient: CareRecipient | null;
  caregiver: Caregiver | null;
  isLoading: boolean;

  // Derived state
  isAuthenticated: boolean;
  isFamilyLoggedIn: boolean;
  isCaregiverLoggedIn: boolean;
  isCaregiver: boolean; // Legacy alias for isCaregiverLoggedIn

  // Actions
  loginFamily: (email: string, password: string) => Promise<void>;
  loginCaregiver: (usernameOrId: string, pin: string) => Promise<void>;
  signup: (email: string, name: string, password: string, phone?: string) => Promise<void>;
  logout: () => void; // Clears everything (legacy)
  logoutFamily: () => void; // Only clears family auth
  logoutCaregiver: () => void; // Only clears caregiver auth
  refreshUser: () => Promise<void>;
  refreshCareRecipient: () => Promise<void>;
  setCareRecipient: (recipient: CareRecipient) => void;
  switchToFamily: () => void; // Switch active context to family
  switchToCaregiver: () => void; // Switch active context to caregiver
}

const AuthContext = createContext<AuthContextType | null>(null);

// Storage keys - separated for family vs caregiver
const STORAGE_KEYS = {
  familyToken: 'familyToken',
  familyUser: 'familyUser',
  familyCareRecipient: 'familyCareRecipient',
  caregiverToken: 'caregiverToken',
  caregiver: 'caregiver',
  caregiverCareRecipient: 'caregiverCareRecipient',
  activeContext: 'activeContext', // 'family' | 'caregiver'
} as const;

// JWT decoder (simple base64 decode for payload)
function decodeJWT(token: string): { sub?: string; caregiverId?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

// Check if token is expired
function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded?.exp) return true;
  return decoded.exp * 1000 < Date.now();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Separate tokens for family and caregiver
  const [familyToken, setFamilyToken] = useState<string | null>(null);
  const [caregiverToken, setCaregiverToken] = useState<string | null>(null);

  // Active context determines which token to use
  const [activeContext, setActiveContext] = useState<'family' | 'caregiver' | null>(null);

  // User data
  const [user, setUser] = useState<User | null>(null);
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [familyCareRecipient, setFamilyCareRecipient] = useState<CareRecipient | null>(null);
  const [caregiverCareRecipient, setCaregiverCareRecipient] = useState<CareRecipient | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Derived state
  const isFamilyLoggedIn = !!familyToken && !isTokenExpired(familyToken);
  const isCaregiverLoggedIn = !!caregiverToken && !isTokenExpired(caregiverToken);

  // Active token based on context
  const token = activeContext === 'family' ? familyToken :
                activeContext === 'caregiver' ? caregiverToken : null;

  // Care recipient depends on active context
  const careRecipient = activeContext === 'family' ? familyCareRecipient :
                        activeContext === 'caregiver' ? caregiverCareRecipient : null;

  const isAuthenticated = !!token && !isTokenExpired(token);
  const isCaregiver = activeContext === 'caregiver' && isCaregiverLoggedIn;

  // Fetch user profile from API
  const fetchUser = useCallback(async (authToken: string, userId: string) => {
    try {
      const userData = await authenticatedApiCall<User>(`/users/${userId}`, authToken);
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return null;
    }
  }, []);

  // Fetch care recipients from API
  const fetchCareRecipients = useCallback(async (authToken: string) => {
    try {
      const recipients = await authenticatedApiCall<CareRecipient[]>('/care-recipients', authToken);
      if (recipients && recipients.length > 0) {
        setFamilyCareRecipient(recipients[0]);
        localStorage.setItem(STORAGE_KEYS.familyCareRecipient, JSON.stringify(recipients[0]));
        return recipients[0];
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch care recipients:', error);
      return null;
    }
  }, []);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      // Load family token
      const storedFamilyToken = localStorage.getItem(STORAGE_KEYS.familyToken);
      if (storedFamilyToken && !isTokenExpired(storedFamilyToken)) {
        setFamilyToken(storedFamilyToken);
        const decoded = decodeJWT(storedFamilyToken);
        if (decoded?.sub) {
          await fetchUser(storedFamilyToken, decoded.sub);
          await fetchCareRecipients(storedFamilyToken);
        }
      }

      // Load caregiver token
      const storedCaregiverToken = localStorage.getItem(STORAGE_KEYS.caregiverToken);
      if (storedCaregiverToken && !isTokenExpired(storedCaregiverToken)) {
        setCaregiverToken(storedCaregiverToken);
        const cachedCaregiver = localStorage.getItem(STORAGE_KEYS.caregiver);
        const cachedRecipient = localStorage.getItem(STORAGE_KEYS.caregiverCareRecipient);
        if (cachedCaregiver) setCaregiver(JSON.parse(cachedCaregiver));
        if (cachedRecipient) setCaregiverCareRecipient(JSON.parse(cachedRecipient));
      }

      // Restore active context or default based on what's available
      const storedContext = localStorage.getItem(STORAGE_KEYS.activeContext) as 'family' | 'caregiver' | null;
      if (storedContext === 'family' && storedFamilyToken && !isTokenExpired(storedFamilyToken)) {
        setActiveContext('family');
      } else if (storedContext === 'caregiver' && storedCaregiverToken && !isTokenExpired(storedCaregiverToken)) {
        setActiveContext('caregiver');
      } else if (storedFamilyToken && !isTokenExpired(storedFamilyToken)) {
        setActiveContext('family');
      } else if (storedCaregiverToken && !isTokenExpired(storedCaregiverToken)) {
        setActiveContext('caregiver');
      }

      setIsLoading(false);
    };

    initAuth();
  }, [fetchUser, fetchCareRecipients]);

  // Family login
  const loginFamily = useCallback(async (email: string, password: string) => {
    const response = await apiCall<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Store family token
    localStorage.setItem(STORAGE_KEYS.familyToken, response.token);
    localStorage.setItem(STORAGE_KEYS.activeContext, 'family');
    setFamilyToken(response.token);
    setUser(response.user);
    setActiveContext('family');

    // Fetch care recipients
    await fetchCareRecipients(response.token);
  }, [fetchCareRecipients]);

  // Caregiver login - accepts username (e.g., "happy-panda-42") or UUID
  const loginCaregiver = useCallback(async (usernameOrId: string, pin: string) => {
    // Detect if input is UUID or username
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usernameOrId);
    const payload = isUUID
      ? { caregiverId: usernameOrId, pin }
      : { username: usernameOrId.toLowerCase(), pin };

    const response = await apiCall<{
      token: string;
      caregiver: Caregiver;
      careRecipient: CareRecipient | null;
    }>('/auth/caregiver/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // Store caregiver token and data
    localStorage.setItem(STORAGE_KEYS.caregiverToken, response.token);
    localStorage.setItem(STORAGE_KEYS.caregiver, JSON.stringify(response.caregiver));
    localStorage.setItem(STORAGE_KEYS.activeContext, 'caregiver');
    if (response.careRecipient) {
      localStorage.setItem(STORAGE_KEYS.caregiverCareRecipient, JSON.stringify(response.careRecipient));
    }

    setCaregiverToken(response.token);
    setCaregiver(response.caregiver);
    setActiveContext('caregiver');
    if (response.careRecipient) {
      setCaregiverCareRecipient(response.careRecipient);
    }
  }, []);

  // Signup (family only)
  const signup = useCallback(async (email: string, name: string, password: string, phone?: string) => {
    const response = await apiCall<{ token: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, name, password, phone }),
    });

    // Store family token
    localStorage.setItem(STORAGE_KEYS.familyToken, response.token);
    localStorage.setItem(STORAGE_KEYS.activeContext, 'family');
    setFamilyToken(response.token);
    setUser(response.user);
    setActiveContext('family');
  }, []);

  // Logout family only
  const logoutFamily = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.familyToken);
    localStorage.removeItem(STORAGE_KEYS.familyUser);
    localStorage.removeItem(STORAGE_KEYS.familyCareRecipient);
    setFamilyToken(null);
    setUser(null);
    setFamilyCareRecipient(null);

    // If we were in family context, switch to caregiver if available
    if (activeContext === 'family') {
      if (caregiverToken && !isTokenExpired(caregiverToken)) {
        setActiveContext('caregiver');
        localStorage.setItem(STORAGE_KEYS.activeContext, 'caregiver');
      } else {
        setActiveContext(null);
        localStorage.removeItem(STORAGE_KEYS.activeContext);
      }
    }
  }, [activeContext, caregiverToken]);

  // Logout caregiver only
  const logoutCaregiver = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.caregiverToken);
    localStorage.removeItem(STORAGE_KEYS.caregiver);
    localStorage.removeItem(STORAGE_KEYS.caregiverCareRecipient);
    setCaregiverToken(null);
    setCaregiver(null);
    setCaregiverCareRecipient(null);

    // If we were in caregiver context, switch to family if available
    if (activeContext === 'caregiver') {
      if (familyToken && !isTokenExpired(familyToken)) {
        setActiveContext('family');
        localStorage.setItem(STORAGE_KEYS.activeContext, 'family');
      } else {
        setActiveContext(null);
        localStorage.removeItem(STORAGE_KEYS.activeContext);
      }
    }
  }, [activeContext, familyToken]);

  // Legacy logout - clears everything
  const logout = useCallback(() => {
    // Clear all storage
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    // Also clean up legacy keys
    localStorage.removeItem('token');
    localStorage.removeItem('careRecipient');
    localStorage.removeItem('user');

    // Reset all state
    setFamilyToken(null);
    setCaregiverToken(null);
    setUser(null);
    setCaregiver(null);
    setFamilyCareRecipient(null);
    setCaregiverCareRecipient(null);
    setActiveContext(null);
  }, []);

  // Switch active context
  const switchToFamily = useCallback(() => {
    if (familyToken && !isTokenExpired(familyToken)) {
      setActiveContext('family');
      localStorage.setItem(STORAGE_KEYS.activeContext, 'family');
    }
  }, [familyToken]);

  const switchToCaregiver = useCallback(() => {
    if (caregiverToken && !isTokenExpired(caregiverToken)) {
      setActiveContext('caregiver');
      localStorage.setItem(STORAGE_KEYS.activeContext, 'caregiver');
    }
  }, [caregiverToken]);

  // Refresh user data from API
  const refreshUser = useCallback(async () => {
    if (!familyToken || !user) return;
    const decoded = decodeJWT(familyToken);
    if (decoded?.sub) {
      await fetchUser(familyToken, decoded.sub);
    }
  }, [familyToken, user, fetchUser]);

  // Refresh care recipient data from API
  const refreshCareRecipient = useCallback(async () => {
    if (!familyToken) return;
    await fetchCareRecipients(familyToken);
  }, [familyToken, fetchCareRecipients]);

  // Set care recipient (for switching between multiple)
  const setCareRecipient = useCallback((recipient: CareRecipient) => {
    if (activeContext === 'family') {
      setFamilyCareRecipient(recipient);
      localStorage.setItem(STORAGE_KEYS.familyCareRecipient, JSON.stringify(recipient));
    } else {
      setCaregiverCareRecipient(recipient);
      localStorage.setItem(STORAGE_KEYS.caregiverCareRecipient, JSON.stringify(recipient));
    }
  }, [activeContext]);

  const value: AuthContextType = {
    token,
    user,
    careRecipient,
    caregiver,
    isLoading,
    isAuthenticated,
    isFamilyLoggedIn,
    isCaregiverLoggedIn,
    isCaregiver,
    loginFamily,
    loginCaregiver,
    signup,
    logout,
    logoutFamily,
    logoutCaregiver,
    refreshUser,
    refreshCareRecipient,
    setCareRecipient,
    switchToFamily,
    switchToCaregiver,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook for getting token (for API calls)
export function useAuthToken(): string | null {
  const { token } = useAuth();
  return token;
}
