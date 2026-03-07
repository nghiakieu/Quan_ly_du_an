"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from './api';

interface User {
    id: number;
    email: string;
    username: string;
    role: string;
    is_active: boolean;
}

interface AuthContextType {
    token: string | null;
    user: User | null;
    login: (token: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
    token: null,
    user: null,
    login: () => { },
    logout: () => { },
    isAuthenticated: false,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);

    const logout = () => {
        localStorage.removeItem('access_token');
        setToken(null);
        setUser(null);
    };

    const fetchUser = async () => {
        try {
            const res = await api.post('/auth/test-token');
            setUser(res.data);
        } catch (err) {
            console.error('Failed to fetch user:', err);
            // If token is invalid, log out
            logout();
        }
    };

    useEffect(() => {
        // Load token from local storage on mount
        const storedToken = localStorage.getItem('access_token');
        if (storedToken) {
            setToken(storedToken);
        }
    }, []);

    useEffect(() => {
        if (token) {
            fetchUser();
        } else {
            setUser(null);
        }
    }, [token]);

    const login = (newToken: string) => {
        localStorage.setItem('access_token', newToken);
        setToken(newToken);
    };



    return (
        <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
