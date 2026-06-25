interface ToolShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function ToolShell({ title, description, children }: ToolShellProps) {
  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-slate-400 mt-1 text-sm">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
