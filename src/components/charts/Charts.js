import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const palette = {
  blue: "#0472DF",
  teal: "#04A793",
};

const mixColors = [palette.blue, palette.teal, "#7EB6F0", "#6EE0D0", "#5B8CFF", "#1E4468"];

function GlassTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const title = label || payload[0]?.name;
  return (
    <div className="glass-soft rounded-2xl px-3 py-2 text-xs text-white">
      {title ? <p className="mb-1 font-medium text-white/80">{title}</p> : null}
      {payload.map((entry) => (
        <p key={entry.dataKey || entry.name} style={{ color: entry.color || entry.payload?.fill }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function DonutChart({ data }) {
  const chartData = data.filter((item) => item.value > 0);
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={3} stroke="none">
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={mixColors[index % mixColors.length]} />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OverviewBarChart({ data }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <ReBarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip content={<GlassTooltip />} />
          <Bar dataKey="value" name="Count" fill={palette.blue} radius={[8, 8, 0, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompletionRing({ percent, completed, inProgress, overdue }) {
  const size = 168;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (percent / 100) * circ;

  return (
    <div className="flex h-[280px] flex-col items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.teal}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="-mt-[7.4rem] text-center">
        <p className="text-4xl font-semibold">{percent}%</p>
        <p className="text-xs text-white/50">Overall completion</p>
      </div>
      <div className="mt-16 grid w-full grid-cols-3 gap-2 text-center text-xs text-white/65">
        <div>
          <p className="text-lg font-semibold text-brand-teal">{completed}</p>
          Completed
        </div>
        <div>
          <p className="text-lg font-semibold text-sky-200">{inProgress}</p>
          In progress
        </div>
        <div>
          <p className="text-lg font-semibold text-amber-200">{overdue}</p>
          Overdue
        </div>
      </div>
    </div>
  );
}
