/**
 * Grahak API Client
 * Centralised axios instance with auth header injection.
 */

import axios, { AxiosInstance } from 'axios';
import {
  TokenResponse, Contact, ContactListResponse, DashboardData,
  Reminder, Note, AIInsight, Message, SimulateMessageResponse,
  SearchResponse, Business
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${BASE_URL}/api/v1`,
    headers: { 'Content-Type': 'application/json' },
    timeout: 25000,
  });

  // Inject auth token from localStorage
  client.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('grahak_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });

  // Handle 401 — redirect to login
  client.interceptors.response.use(
    (response) => {
      // SQLite returns timezone-free UTC values; preserve their instant in browsers.
      const normalizeDates = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        for (const [key, item] of Object.entries(value)) {
          if (typeof item === 'string' && key.endsWith('_at') && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(item)) {
            (value as Record<string, unknown>)[key] = item + 'Z';
          } else normalizeDates(item);
        }
      };
      normalizeDates(response.data);
      return response;
    },
    (error) => {
      if (error.response?.status === 401 && !['/auth/login', '/auth/signup'].includes(error.config?.url) && typeof window !== 'undefined') {
        localStorage.removeItem('grahak_token');
        localStorage.removeItem('grahak_user');
        window.dispatchEvent(new Event('grahak:unauthorized'));
      }
      return Promise.reject(error);
    }
  );

  return client;
}

export const api = createApiClient();

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string') return error.response.data.detail;
  return fallback;
}

// ──────────────────────────── AUTH ─────────────────────────────

export const authApi = {
  signup: (data: { email: string; password: string; full_name: string; business_name: string }) =>
    api.post<TokenResponse>('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    api.post<TokenResponse>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ──────────────────────────── BUSINESS ─────────────────────────────

export const businessApi = {
  getProfile: () => api.get<Business>('/business/profile'),
  updateOnboarding: (data: Record<string, string>) =>
    api.post<Business>('/business/onboarding', data),
  getStatus: () => api.get('/business/status'),
};

// ──────────────────────────── DASHBOARD ─────────────────────────────

export const dashboardApi = {
  get: () => api.get<DashboardData>('/dashboard'),
};

// ──────────────────────────── CONTACTS ─────────────────────────────

export const contactsApi = {
  listAll: async (): Promise<Contact[]> => {
    const contacts: Contact[] = [];
    let page = 1;
    while (true) {
      const response = await api.get<ContactListResponse>('/contacts', { params: { page, page_size: 100 } });
      contacts.push(...response.data.contacts);
      if (!response.data.contacts.length || contacts.length >= response.data.total) return contacts;
      page += 1;
    }
  },
  list: (params?: { page?: number; page_size?: number; status?: string; search?: string; sort_by?: string }) =>
    api.get<ContactListResponse>('/contacts', { params }),
  get: (id: string) => api.get<Contact>(`/contacts/${id}`),
  create: (data: { whatsapp_number: string; display_name?: string; status?: string }) =>
    api.post<Contact>('/contacts', data),
  update: (id: string, data: Partial<Contact>) =>
    api.patch<Contact>(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  getMessages: (id: string) => api.get<Message[]>(`/contacts/${id}/messages`),
  getNotes: (id: string) => api.get<Note[]>(`/contacts/${id}/notes`),
  createNote: (id: string, body: string) =>
    api.post<Note>(`/contacts/${id}/notes`, { body }),
  updateNote: (contactId: string, noteId: string, body: string) =>
    api.patch<Note>(`/contacts/${contactId}/notes/${noteId}`, { body }),
  deleteNote: (contactId: string, noteId: string) =>
    api.delete(`/contacts/${contactId}/notes/${noteId}`),
  sendMessage: (id: string, message: string) =>
    api.post<Message>(`/contacts/${id}/messages`, { message }),
  getAIInsights: (id: string) => api.get<AIInsight[]>(`/contacts/${id}/ai-insights`),
  createReminder: (contactId: string, data: { due_at: string; note?: string }) =>
    api.post<Reminder>(`/contacts/${contactId}/reminders`, {
      contact_id: contactId,
      ...data,
    }),
};

// ──────────────────────────── WHATSAPP COMPANION BRIDGE ─────────────────────────────

export const whatsappBridgeApi = {
  getStatus: async (): Promise<{ connected: boolean; phone: string | null; name: string | null; available?: boolean }> => (await api.get('/business/whatsapp/status')).data,
  getQR: async (): Promise<{ connected: boolean; qr: string | null; qr_image: string | null; phone: string | null; available?: boolean }> => (await api.get('/business/whatsapp/qr')).data,
  resetQR: async (): Promise<{ success: boolean; message?: string }> => (await api.post('/business/whatsapp/reset')).data,
  disconnect: async (): Promise<{ success: boolean }> => (await api.post('/business/whatsapp/disconnect')).data,
  sync: async (): Promise<{ success: boolean; phone: string | null }> => {
    const data = (await api.get('/business/whatsapp/status')).data;
    return { success: data.connected, phone: data.phone };
  },
};

export const remindersApi = {
  list: (params?: { status?: string; today_only?: boolean }) =>
    api.get<Reminder[]>('/reminders', { params }),
  create: (data: { contact_id: string; due_at: string; note?: string }) =>
    api.post<Reminder>('/reminders', data),
  update: (id: string, data: Partial<Reminder>) =>
    api.patch<Reminder>(`/reminders/${id}`, data),
  complete: (id: string) => api.post(`/reminders/${id}/complete`),
  snooze: (id: string, hours?: number) =>
    api.post<Reminder>(`/reminders/${id}/snooze`, null, { params: { hours: hours ?? 24 } }),
};

// ──────────────────────────── SEARCH ─────────────────────────────

export const searchApi = {
  search: (q: string) => api.get<SearchResponse>('/search', { params: { q } }),
};

// ──────────────────────────── DEV SIMULATOR ─────────────────────────────

export const devApi = {
  simulateMessage: (data: { customer_name: string; phone: string; message: string }) =>
    api.post<SimulateMessageResponse>('/dev/simulate-message', data),
  seed: () => api.post('/dev/seed'),
  reset: () => api.delete('/dev/reset'),
  status: () => api.get('/dev/status'),
};
