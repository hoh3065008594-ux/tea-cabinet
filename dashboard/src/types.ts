export interface Reading {
  temperature: number;
  humidity: number;
  timestamp: number;
  device: string;
}

export interface DeviceStatus {
  online: boolean;
  lastHeartbeat: number | null;
  rssi: number | null;
  interval: number;
  uptime: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
