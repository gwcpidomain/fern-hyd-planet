/**
 * Tenant Utilities
 * ================
 * Extracts the active tenant from the current subdomain.
 *
 * Subdomain routing:
 *   fern.gwcinsights.com       -> tenantId = "fern"
 *   trifecta.gwcinsights.com   -> tenantId = "trifecta"
 *   gwcinsights.com            -> tenantId = "fern"  (default)
 *   localhost                  -> tenantId from NEXT_PUBLIC_DEFAULT_TENANT or "fern"
 */

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT || 'fern';

/**
 * Returns the active tenant ID from the browser hostname.
 * Falls back to DEFAULT_TENANT when no valid subdomain is found.
 */
export function getTenantId(): string {
    if (typeof window === 'undefined') {
        // SSR: always fallback; tenant is resolved by backend from headers
        return DEFAULT_TENANT;
    }

    const hostname = window.location.hostname;

    // Local / LAN dev: skip subdomain detection
    const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.');

    // Only allow localStorage override in local dev — never in production
    if (isLocal) {
        const override = localStorage.getItem('tenant_override');
        if (override) return override;
    }

    const parts = hostname.split('.');

    // Handle localhost subdomains (e.g. trifecta.localhost) where length is 2
    if (parts.length === 2 && parts[1] === 'localhost') {
        return parts[0];
    }

    if (isLocal) {
        return DEFAULT_TENANT;
    }

    // Vercel preview URLs (e.g. fern-hyd-planet-xxx.vercel.app) — no subdomain tenant
    if (hostname.endsWith('.vercel.app')) {
        return DEFAULT_TENANT;
    }

    // Production: extract first subdomain segment
    if (parts.length > 2) {
        const subdomain = parts[0];
        if (subdomain && subdomain !== 'www') {
            return subdomain;
        }
    }

    return DEFAULT_TENANT;
}

/**
 * Returns request headers that include the tenant ID.
 * Merge into your fetch() headers so the backend can resolve the active tenant.
 */
export function getTenantHeaders(): Record<string, string> {
    return { 'X-Tenant-Id': getTenantId() };
}
