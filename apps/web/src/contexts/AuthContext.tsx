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
  careRecipientId: string;
}

interface AuthContextType {
  // State
  token: string | null;
  user: User | null;
  careRecipient: CareRecipient | null;
  caregiver: Caregiver | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isCaregiver: boolean;

  // Actions
  loginFamily: (email: string, password: string) => Promise<void>;
  loginCaregiver: (caregiverId: string, pin: string) => Promise<void>;
  signup: (email: string, name: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshCareRecipient: () => Promise<void>;
  setCareRecipient: (recipient: CareRecipient) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [careRecipient, setCareRecipientState] = useState<CareRecipient | null>(null);
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token && !isTokenExpired(token);
  const isCaregiver = !!caregiver;

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
        setCareRecipientState(recipients[0]);
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
      // Check for family token
      const storedToken = localStorage.getItem('token');
      if (storedToken && !isTokenExpired(storedToken)) {
        setToken(storedToken);
        const decoded = decodeJWT(storedToken);
        if (decoded?.sub) {
          await fetchUser(storedToken, decoded.sub);
          await fetchCareRecipients(storedToken);
        }
      } else {
        // Check for caregiver token
        const caregiverToken = localStorage.getItem('caregiverToken');
        if (caregiverToken && !isTokenExpired(caregiverToken)) {
          setToken(caregiverToken);
          const decoded = decodeJWT(caregiverToken);
          if (decoded?.caregiverId) {
            // Caregiver data should be fetched fresh, but for now use cached
            // The caregiver login response already returns all needed data
            const cachedCaregiver = localStorage.getItem('caregiver');
            const cachedRecipient = localStorage.getItem('careRecipient');
            if (cachedCaregiver) setCaregiver(JSON.parse(cachedCaregiver));
            if (cachedRecipient) setCareRecipientState(JSON.parse(cachedRecipient));
          }
        }
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

    // Store only token in localStorage
    localStorage.setItem('token', response.token);
    setToken(response.token);
    setUser(response.user);

    // Fetch care recipients
    await fetchCareRecipients(response.token);
  }, [fetchCareRecipients]);

  // Caregiver login
  const loginCaregiver = useCallback(async (caregiverId: string, pin: string) => {
    const response = await apiCall<{
      token: string;
      caregiver: Caregiver;
      careRecipient: CareRecipient | null;
    }>('/auth/caregiver/login', {
      method: 'POST',
      body: JSON.stringify({ caregiverId, pin }),
    });

    // Store token and minimal cached data for offline
    localStorage.setItem('caregiverToken', response.token);
    localStorage.setItem('caregiver', JSON.stringify(response.caregiver));
    if (response.careRecipient) {
      localStorage.setItem('careRecipient', JSON.stringify(response.careRecipient));
    }

    setToken(response.token);
    setCaregiver(response.caregiver);
    if (response.careRecipient) {
      setCareRecipientState(response.careRecipient);
    }
  }, []);

  // Signup
  const signup = useCallback(async (email: string, name: string, password: string, phone?: string) => {
    const response = await apiCall<{ token: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, name, password, phone }),
    });

    // Store only token in localStorage
    localStorage.setItem('token', response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('caregiverToken');
    localStorage.removeItem('caregiver');
    localStorage.removeItem('careRecipient');
    localStorage.removeItem('user'); // Clean up legacy data
    setToken(null);
    setUser(null);
    setCaregiver(null);
    setCareRecipientState(null);
  }, []);

  // Refresh user data from API
  const refreshUser = useCallback(async () => {
    if (!token || !user) return;
    const decoded = decodeJWT(token);
    if (decoded?.sub) {
      await fetchUser(token, decoded.sub);
    }
  }, [token, user, fetchUser]);

  // Refresh care recipient data from API
  const refreshCareRecipient = useCallback(async () => {
    if (!token) return;
    await fetchCareRecipients(token);
  }, [token, fetchCareRecipients]);

  // Set care recipient (for switching between multiple)
  const setCareRecipient = useCallback((recipient: CareRecipient) => {
    setCareRecipientState(recipient);
    // Update cached value for offline/reload
    localStorage.setItem('careRecipient', JSON.stringify(recipient));
  }, []);

  const value: AuthContextType = {
    token,
    user,
    careRecipient,
    caregiver,
    isLoading,
    isAuthenticated,
    isCaregiver,
    loginFamily,
    loginCaregiver,
    signup,
    logout,
    refreshUser,
    refreshCareRecipient,
    setCareRecipient,
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
