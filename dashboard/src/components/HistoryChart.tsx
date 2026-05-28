import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { Reading } from '../types';

interface Props { data: Reading[]; }

export default function HistoryChart({ data }: Props) {
  const chartData = data
    .map(r => ({
      time: new Date(r.timestamp * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      temp: r.temperature,
      hum: r.humidity,
    }))
    .reverse();

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#7a7a7a' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#7a7a7a' }} width={36} />
          <Tooltip />
          <Line type="monotone" dataKey="temp" stroke="#0066cc" strokeWidth={2} dot={false} name="温度" />
          <Line type="monotone" dataKey="hum" stroke="#34c759" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="湿度" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
