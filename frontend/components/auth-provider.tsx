"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api-url';
import { getTenantId, getTenantHeaders } from '@/lib/tenant';
import { useRouter, usePathname } from 'next/navigation';

interface User {
    id: number;
    email: string;
    full_name?: string;
    tenant_id?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    tenantId: string;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, fullName: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tenantId, setTenantId] = useState<string>('fern');
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Resolve tenant from subdomain on mount (client-side only)
        setTenantId(getTenantId());

        // 1. Check LocalStorage on Mount
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            setToken(storedToken);
            fetchUser(storedToken);
        } else {
            setIsLoading(false);
            if (pathname !== '/login' && pathname !== '/signup' && pathname !== '/') {
                router.push('/login');
            }
        }
    }, []);

    const fetchUser = async (authToken: string) => {
        try {
            const res = await fetch(getApiUrl('/api/auth/me'), {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    ...getTenantHeaders(),
                },
            });
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
                // Ensure local tenantId is consistent with what the server says
                if (userData.tenant_id) {
                    setTenantId(userData.tenant_id);
                }
            } else {
                logout();
            }
        } catch (err) {
            console.error(err);
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const res = await fetch(getApiUrl('/api/auth/login'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...getTenantHeaders(),
            },
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Login failed');
        }

        const data = await res.json();
        const newToken = data.access_token;
        localStorage.setItem('token', newToken);
        setToken(newToken);
        await fetchUser(newToken);

        // After login, check if we're on the root domain (no subdomain).
        // If so, redirect to the correct tenant subdomain so the URL matches the user's workspace.
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            const parts = hostname.split('.');
            const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
            const isRootDomain = !isLocal && parts.length === 2; // e.g. gwcinsights.com (no subdomain)

            if (isRootDomain) {
                // Get tenant from the token that was just set — resolves to the logged-in user's tenant
                const resolvedTenant = getTenantId();
                // Redirect to: fern.gwcinsights.com or trifecta.gwcinsights.com
                window.location.href = `${window.location.protocol}//${resolvedTenant}.${hostname}/`;
                return;
            }
        }

        router.push('/');
    };

    const register = async (email: string, password: string, fullName: string) => {
        const res = await fetch(getApiUrl('/api/auth/register'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getTenantHeaders(),
            },
            body: JSON.stringify({ email, password, full_name: fullName }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Registration failed');
        }

        // Auto-login after register
        await login(email, password);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        router.push('/');
    };

    return (
        <AuthContext.Provider value={{ user, token, tenantId, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
