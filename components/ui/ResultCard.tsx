type Variant = 'neutral' | 'positive' | 'warning' | 'danger';

interface ResultCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: Variant;
}

const borderColor: Record<Variant, string> = {
  neutral: 'border-navy-700',
  positive: 'border-emerald-500',
  warning: 'border-yellow-500',
  danger: 'border-red-500',
};

export default function ResultCard({ label, value, sub, variant = 'neutral' }: ResultCardProps) {
  return (
    <div className={`bg-navy-800 rounded-lg p-4 border-l-4 ${borderColor[variant]} border border-navy-700`}>
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-mono font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
