export interface DailySummary {
  day: string;
  temp_max: number;
  hum_at_max: number;
  temp_min: number;
  hum_at_min: number;
}

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
  data?: T;
  error?: string;
}
