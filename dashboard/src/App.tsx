import { useEffect, useState, useCallback } from 'react';
import type { Reading, DeviceStatus } from './types';
import { fetchLatest, fetchHistory, fetchStatus } from './api';
import Hero from './components/Hero';
import StatusCards from './components/StatusCards';
import MiniChart from './components/MiniChart';
import InfoBar from './components/InfoBar';
import HistoryChart from './components/HistoryChart';
import CommandRow from './components/CommandRow';

export default function App() {
  const [latest, setLatest] = useState<Reading | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
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
    fetchHistory(500, 168).then(setHistory).catch(() => {});
  }, []);

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
          <h3 className="text-[17px] font-medium mb-4">7 天趋势</h3>
          <HistoryChart data={history} />
          <CommandRow currentInterval={status.interval} onSuccess={(v) => setStatus(s => ({ ...s, interval: v }))} />
        </div>
      </div>
    </div>
  );
}
