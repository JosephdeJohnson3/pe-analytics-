'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/exit-irr', label: 'Exit IRR' },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-navy-700 bg-navy-900 px-6 py-4 flex items-center gap-8">
      <span className="text-brand font-mono font-bold tracking-tight text-lg">PE Analytics</span>
      <div className="flex gap-6">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm font-medium transition-colors ${
              pathname === l.href
                ? 'text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
