/**
 * API Client for Cloudflare Workers deployment
 * Uses environment variable for API URL in production
 * Falls back to /api proxy in development
 */

// Get API URL from environment
// In production (Workers), use VITE_API_URL from wrangler.toml
// In dev, use proxy via /api
const API_URL = (import.meta.env?.VITE_API_URL as string | undefined) || '/api';

export async function apiCall<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Helper for authenticated requests
 */
export async function authenticatedApiCall<T = any>(
  endpoint: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  return apiCall<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
}
