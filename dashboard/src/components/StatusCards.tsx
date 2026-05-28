import type { Reading } from '../types';

interface Props { latest: Reading | null; }

export default function StatusCards({ latest }: Props) {
  const temp = latest?.temperature ?? '--';
  const hum = latest?.humidity ?? '--';
  const updated = latest ? new Date(latest.timestamp * 1000).toLocaleTimeString('zh-CN') : '--';

  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="bg-white rounded-[18px] p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <p className="text-[13px] text-[#7a7a7a] font-medium uppercase tracking-[0.5px] mb-1">温度</p>
        <p className="text-[56px] font-semibold tracking-[-1.5px] leading-none text-[#1d1d1f]">
          {temp}<span className="text-[22px] font-normal text-[#7a7a7a]">°C</span>
        </p>
        <p className="text-[13px] text-[#7a7a7a] mt-2">更新于 {updated}</p>
      </div>
      <div className="bg-white rounded-[18px] p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <p className="text-[13px] text-[#7a7a7a] font-medium uppercase tracking-[0.5px] mb-1">湿度</p>
        <p className="text-[56px] font-semibold tracking-[-1.5px] leading-none text-[#1d1d1f]">
          {hum}<span className="text-[22px] font-normal text-[#7a7a7a]">%</span>
        </p>
        <p className="text-[13px] text-[#7a7a7a] mt-2">更新于 {updated}</p>
      </div>
    </div>
  );
}
