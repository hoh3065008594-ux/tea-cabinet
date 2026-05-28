import type { Reading, DeviceStatus, ApiResponse } from './types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options);
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'API request failed');
  }
  return json.data as T;
}

export async function fetchLatest(): Promise<Reading | null> {
  return request<Reading | null>('/readings/latest');
}

export async function fetchHistory(limit = 100, hours = 24): Promise<Reading[]> {
  return request<Reading[]>(`/readings?limit=${limit}&hours=${hours}`);
}

export async function fetchStatus(): Promise<DeviceStatus> {
  return request<DeviceStatus>('/status');
}

export async function sendCommand(cmd: string, value: number): Promise<void> {
  await request('/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, value }),
  });
}
