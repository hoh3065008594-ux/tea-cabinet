import type { DeviceStatus } from '../types';

interface Props { status: DeviceStatus; }

export default function InfoBar({ status }: Props) {
  return (
    <div className="flex gap-3 mb-4 flex-wrap">
      <div className="bg-white rounded-xl py-2.5 px-4 text-[13px] text-[#7a7a7a] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
        WiFi <strong className="text-[#1d1d1f] font-medium">{status.rssi ?? '--'} dBm</strong>
      </div>
      <div className="bg-white rounded-xl py-2.5 px-4 text-[13px] text-[#7a7a7a] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
        MQTT <strong className="text-[#1d1d1f] font-medium">{status.online ? '已连接' : '断开'}</strong>
      </div>
      <div className="bg-white rounded-xl py-2.5 px-4 text-[13px] text-[#7a7a7a] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
        上报间隔 <strong className="text-[#1d1d1f] font-medium">{status.interval} 秒</strong>
      </div>
    </div>
  );
}
