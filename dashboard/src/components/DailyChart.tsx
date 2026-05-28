import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { DailySummary } from '../types';

interface Props { data: DailySummary[]; }

export default function DailyChart({ data }: Props) {
  const chartData = data.map(d => ({
    day: d.day,
    '最高温度': d.temp_max,
    '最低温度': d.temp_min,
    '最高时湿度': d.hum_at_max,
    '最低时湿度': d.hum_at_min,
  }));

  if (chartData.length === 0) {
    return <p className="text-center text-[#7a7a7a] text-sm py-10">暂无数据</p>;
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#7a7a7a' }} />
          <YAxis yAxisId="temp" tick={{ fontSize: 11, fill: '#7a7a7a' }} width={36} unit="°C" />
          <YAxis yAxisId="hum" orientation="right" tick={{ fontSize: 11, fill: '#7a7a7a' }} width={30} unit="%" />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line yAxisId="temp" type="monotone" dataKey="最高温度" stroke="#e03131" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="temp" type="monotone" dataKey="最低温度" stroke="#0066cc" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="hum" type="monotone" dataKey="最高时湿度" stroke="#e03131" strokeWidth={1} strokeDasharray="4 4" dot={false} />
          <Line yAxisId="hum" type="monotone" dataKey="最低时湿度" stroke="#0066cc" strokeWidth={1} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
