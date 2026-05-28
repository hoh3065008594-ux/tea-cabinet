import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { Reading } from '../types';

interface Props { data: Reading[]; }

export default function MiniChart({ data }: Props) {
  const chartData = data.map(r => ({ t: r.temperature })).reverse();
  return (
    <div className="h-[72px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="t" stroke="#0066cc" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
