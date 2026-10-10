'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CategoryRow } from '@/lib/data/compliance';
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '@/lib/compliance-meta';

export function CategoryChart({ data }: { data: CategoryRow[] }) {
  if (data.length === 0) return null;
  return (
    <div style={{ height: data.length * 34 + 48 }} aria-label="Requirements by category and status" role="img">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#D3D9DC" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="category" width={140} tick={{ fontSize: 12 }} />
          <Tooltip cursor={{ fill: '#F2F4F3' }} />
          {STATUS_ORDER.map((s) => (
            <Bar key={s} dataKey={s} name={STATUS_LABEL[s]} stackId="a" fill={STATUS_COLOR[s]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
