import type { Reading, DeviceStatus, ApiResponse } from './types';

const BASE = '/api';

export async function fetchLatest(): Promise<Reading | null> {
  const res = await fetch(`${BASE}/readings/latest`);
  const json: ApiResponse<Reading | null> = await res.json();
  return json.data;
}

export async function fetchHistory(limit = 100, hours = 24): Promise<Reading[]> {
  const res = await fetch(`${BASE}/readings?limit=${limit}&hours=${hours}`);
  const json: ApiResponse<Reading[]> = await res.json();
  return json.data;
}

export async function fetchStatus(): Promise<DeviceStatus> {
  const res = await fetch(`${BASE}/status`);
  const json: ApiResponse<DeviceStatus> = await res.json();
  return json.data;
}

export async function sendCommand(cmd: string, value: number): Promise<void> {
  await fetch(`${BASE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, value }),
  });
}
