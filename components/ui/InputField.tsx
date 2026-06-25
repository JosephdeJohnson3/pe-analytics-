interface InputFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  tooltip?: string;
}

export default function InputField({ label, value, onChange, unit, min, max, step = 0.1, tooltip }: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide" title={tooltip}>
        {label}{tooltip && <span className="ml-1 text-slate-600 cursor-help">?</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-navy-900 border border-navy-700 text-slate-100 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand"
        />
        {unit && <span className="text-slate-500 text-sm font-mono w-8 shrink-0">{unit}</span>}
      </div>
    </div>
  );
}
