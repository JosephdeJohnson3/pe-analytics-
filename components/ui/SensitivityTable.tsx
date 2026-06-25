interface SensitivityTableProps {
  rowHeaders: string[];
  colHeaders: string[];
  data: number[][];           // [rowIndex][colIndex]
  formatValue: (v: number) => string;
  colorFn: (v: number) => string;  // returns tailwind bg class
  rowLabel: string;
  colLabel: string;
}

export default function SensitivityTable({
  rowHeaders, colHeaders, data, formatValue, colorFn, rowLabel, colLabel
}: SensitivityTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-mono border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs text-slate-500 pb-2 pr-3">
              {rowLabel} ↓ / {colLabel} →
            </th>
            {colHeaders.map(h => (
              <th key={h} className="text-center text-xs text-slate-400 pb-2 px-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri}>
              <td className="text-xs text-slate-400 pr-3 py-1 whitespace-nowrap">{rowHeaders[ri]}</td>
              {row.map((val, ci) => (
                <td key={ci} className={`text-center py-1 px-2 rounded ${colorFn(val)} text-white font-medium`}>
                  {formatValue(val)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
