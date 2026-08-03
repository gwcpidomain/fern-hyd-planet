import { getApiUrl } from "./api-url";
import { getTenantHeaders } from "./tenant";
import { toast } from "sonner";

interface FetchOptions extends RequestInit {
  token?: string | null;
  showErrorToast?: boolean;
}

/**
 * Centralized Fetch API Client
 * ===========================
 * Handles endpoint mapping, authentication header injecting,
 * and global request error handling/toasting.
 * 
 * AUDIT FIX: Finding 3.1 (Severity: High)
 */
export async function apiClient<T = any>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, showErrorToast = true, ...restOptions } = options;

  const url = getApiUrl(path);
  
  const headers = new Headers(restOptions.headers || {});
  
  // Dynamically inject authorization token if available
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Always inject the tenant identifier so the backend can scope queries correctly
  const tenantHeaders = getTenantHeaders();
  Object.entries(tenantHeaders).forEach(([k, v]) => {
    if (!headers.has(k)) headers.set(k, v);
  });
  
  // Set JSON content type by default for writes
  if (restOptions.method && ["POST", "PUT", "PATCH"].includes(restOptions.method.toUpperCase())) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const finalOptions: RequestInit = {
    ...restOptions,
    headers,
  };

  try {
    const response = await fetch(url, finalOptions);

    if (!response.ok) {
      // Handle session expiration
      if (response.status === 401 || response.status === 403) {
        if (typeof window !== "undefined") {
          // Clear token to force re-auth
          localStorage.removeItem("token");
        }
        throw new Error("Session expired. Please log in again.");
      }

      const errorText = await response.text();
      let errorMsg = `Server error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error || errorJson.message || errorMsg;
      } catch {
        if (errorText) errorMsg = errorText.substring(0, 100);
      }
      throw new Error(errorMsg);
    }

    // Handle empty content responses
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error: any) {
    const message = error.message || "Network error. Please check your connection.";
    
    if (showErrorToast) {
      // Prevent duplicate notification fatigue by checking console logs
      console.warn("⚠️ API Client Fetch Failure:", message);
      toast.error("Telemetry Error", {
        description: message,
        id: `api-error-${path.replace(/\//g, "-")}`, // Deduplicates identical toasts
      });
    }

    throw error;
  }
}
