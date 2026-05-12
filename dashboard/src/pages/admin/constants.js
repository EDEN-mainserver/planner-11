export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export const USERS_KEY = "eden_users_v1";
export const igKey = (u) => `eden_ig_${u}_v1`;
export const threadsKey = (u) => `eden_threads_${u}_v1`;
export const fullAutoKey = (u) => `eden_fullauto_${u}_v1`;
