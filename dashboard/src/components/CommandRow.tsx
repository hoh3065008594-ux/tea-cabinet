import { useState } from 'react';
import { sendCommand } from '../api';

interface Props { currentInterval: number; }

export default function CommandRow({ currentInterval }: Props) {
  const [value, setValue] = useState(currentInterval);

  const handleSubmit = async () => {
    try {
      await sendCommand('set_interval', value);
    } catch (e) {
      console.error('Command failed:', e);
    }
  };

  return (
    <div className="flex gap-2 items-center mt-5 pt-4 border-t border-[#f0f0f0]">
      <label className="text-[13px] text-[#7a7a7a]">修改上报间隔:</label>
      <input
        type="number"
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        min={5}
        max={3600}
        className="bg-[#f5f5f7] border border-[#e0e0e0] rounded-[10px] text-[#1d1d1f] py-2 px-3 text-sm w-14 text-center font-mono focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_3px_rgba(0,102,204,0.15)]"
      />
      <span className="text-[13px] text-[#7a7a7a]">秒</span>
      <button
        onClick={handleSubmit}
        className="bg-[#0066cc] text-white border-0 rounded-[20px] py-2 px-5 text-[13px] font-medium cursor-pointer hover:bg-[#0071e3] transition-colors"
      >
        下发指令
      </button>
    </div>
  );
}
