/**
 * Returns the base API URL, dynamically using the current browser hostname.
 * This ensures LAN devices reach the correct backend instead of their own localhost.
 */
export function getApiBaseUrl(): string {
    // If env var is explicitly set, always use it
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    // In the browser, use the same hostname if local, otherwise default to production Render URL
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (
            hostname === 'localhost' || 
            hostname.endsWith('.localhost') ||
            hostname === '127.0.0.1' || 
            hostname.endsWith('.127.0.0.1') ||
            hostname.startsWith('192.168.') || 
            hostname.startsWith('10.') || 
            hostname.startsWith('172.')
        ) {
            // Dynamically query localhost backend for local development subdomains
            return `${window.location.protocol}//localhost:8000`;
        }
        return "https://fern-hyd-planet.onrender.com";
    }
    // SSR fallback
    return "http://localhost:8000";
}

/** Convenience: returns full API URL for a given path */
export function getApiUrl(path: string): string {
    return `${getApiBaseUrl()}${path}`;
}
