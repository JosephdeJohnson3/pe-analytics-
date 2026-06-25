import Link from 'next/link';

const tools = [
  {
    href: '/exit-irr',
    title: 'Exit IRR / MOIC Sensitivity',
    description: 'Model LBO returns across exit multiples and hold periods. See exactly how rising rates erode equity returns.',
    tag: 'Tool 1',
    status: 'live',
  },
  {
    href: '#',
    title: 'Secondary Transaction Pricing',
    description: 'Calculate NAV discounts in secondary transactions given rate environment, sector, leverage, and hold period.',
    tag: 'Tool 2',
    status: 'coming',
  },
  {
    href: '#',
    title: 'GP-Led Secondary / Continuation Fund',
    description: 'Model cash-out vs. roll economics for LPs in a continuation vehicle, including GP carry optionality.',
    tag: 'Tool 3',
    status: 'coming',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-4xl mx-auto pt-12">
        <p className="text-brand font-mono text-sm mb-2">Private Markets Analytics</p>
        <h1 className="text-4xl font-bold text-white mb-3">PE Analytics Suite</h1>
        <p className="text-slate-400 text-lg mb-12 max-w-2xl">
          Professional tools for private equity, secondaries, and private credit — built for the current rate environment.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tools.map(tool => (
            <Link
              key={tool.href}
              href={tool.href}
              className={`group bg-navy-800 border rounded-xl p-6 flex flex-col gap-3 transition-all ${
                tool.status === 'live'
                  ? 'border-navy-700 hover:border-brand cursor-pointer'
                  : 'border-navy-700 opacity-50 cursor-not-allowed pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500">{tool.tag}</span>
                {tool.status === 'coming' && (
                  <span className="text-xs bg-navy-700 text-slate-400 px-2 py-0.5 rounded-full">Coming soon</span>
                )}
                {tool.status === 'live' && (
                  <span className="text-xs bg-emerald-900 text-emerald-400 px-2 py-0.5 rounded-full">Live</span>
                )}
              </div>
              <h2 className="text-white font-semibold leading-snug group-hover:text-brand transition-colors">
                {tool.title}
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
