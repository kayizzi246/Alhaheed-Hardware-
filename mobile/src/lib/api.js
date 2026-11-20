import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'http://localhost:4000';

const TOKEN_KEY = 'alhadeed.token';
const USER_KEY = 'alhadeed.user';

let memoryToken = null;

export async function saveSession(token, user) {
  memoryToken = token;
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function loadSession() {
  const pairs = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
  const token = pairs[0][1];
  memoryToken = token;
  try {
    return { token, user: pairs[1][1] ? JSON.parse(pairs[1][1]) : null };
  } catch {
    return { token: null, user: null };
  }
}

export async function clearSession() {
  memoryToken = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export const getToken = () => memoryToken;

/** Thrown on any non-2xx response so screens can show err.message. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    await clearSession();
    onUnauthorized?.();
    throw new ApiError('Your session has expired, please sign in again', 401);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data;
}
