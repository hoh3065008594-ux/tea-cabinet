import { useEffect, useState, useCallback } from 'react';
import type { Reading, DailySummary, DeviceStatus } from './types';
import { fetchLatest, fetchHistory, fetchStatus, fetchDailySummary } from './api';
import Hero from './components/Hero';
import StatusCards from './components/StatusCards';
import MiniChart from './components/MiniChart';
import InfoBar from './components/InfoBar';
import HistoryChart from './components/HistoryChart';
import DailyChart from './components/DailyChart';
import CommandRow from './components/CommandRow';

export default function App() {
  const [latest, setLatest] = useState<Reading | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [daily, setDaily] = useState<DailySummary[]>([]);
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [status, setStatus] = useState<DeviceStatus>({
    online: false, lastHeartbeat: null, rssi: null, interval: 30, uptime: 0,
  });

  const poll = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([fetchLatest(), fetchStatus()]);
      if (r) setLatest(r);
      setStatus(s);
    } catch {
      // API unavailable, keep last known state
    }
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    if (range === '7d') {
      fetchDailySummary(7).then(setDaily).catch(() => {});
    } else {
      fetchHistory(288, 24).then(setHistory).catch(() => {});
    }
  }, [range]);

  return (
    <div className="min-h-screen">
      <Hero online={status.online} device="tea-cabinet-01" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-5 relative z-10">
        <StatusCards latest={latest} />
        <div className="bg-white rounded-[18px] p-6 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <p className="text-[13px] text-[#7a7a7a] font-medium mb-3">实时趋势</p>
          <MiniChart data={history.slice(0, 20)} />
        </div>
        <InfoBar status={status} />
        <div className="bg-white rounded-[18px] p-6 mb-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[17px] font-medium">{range === '7d' ? '7 天趋势' : '24 小时趋势'}</h3>
            <div className="flex bg-[#f0f0f0] rounded-lg p-0.5 gap-0.5">
              <button onClick={() => setRange('24h')} className={`text-[12px] px-3 py-1 rounded-md transition-colors ${range === '24h' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#7a7a7a]'}`}>24小时</button>
              <button onClick={() => setRange('7d')} className={`text-[12px] px-3 py-1 rounded-md transition-colors ${range === '7d' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#7a7a7a]'}`}>7天</button>
            </div>
          </div>
          {range === '7d' ? <DailyChart data={daily} /> : <HistoryChart data={history} />}
          <CommandRow currentInterval={status.interval} onSuccess={(v) => setStatus(s => ({ ...s, interval: v }))} />
        </div>
      </div>
    </div>
  );
}
