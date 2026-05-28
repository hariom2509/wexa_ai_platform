const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api";

export function getAuthToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

export function setAuthToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  } as Record<string, string>;

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    credentials: "include"
  });

  if (response.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login')) {
    // Try to refresh token
    try {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include"
      });
      
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setAuthToken(refreshData.access_token);
        
        // Retry original request
        headers["Authorization"] = `Bearer ${refreshData.access_token}`;
        response = await fetch(`${API_URL}${url}`, {
          ...options,
          headers,
          credentials: "include"
        });
      } else {
        clearAuthToken();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    } catch (e) {
      clearAuthToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
  }

  if (!response.ok) {
    let errorMessage = "API request failed";
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch (e) {
      // Ignored
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  get: (url: string) => fetchWithAuth(url, { method: "GET" }),
  post: (url: string, body: any) =>
    fetchWithAuth(url, { method: "POST", body: JSON.stringify(body) }),
  put: (url: string, body: any) =>
    fetchWithAuth(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: (url: string) => fetchWithAuth(url, { method: "DELETE" }),
};
