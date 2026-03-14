import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          {/* Ink droplet icon */}
          <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C12 2 5 10 5 15a7 7 0 0014 0C19 10 12 2 12 2z" />
          </svg>
          <h1 className="text-xl font-bold tracking-tight">Ink Flow</h1>
          <span className="text-xs text-gray-500 ml-1 mt-1">Printer Maintenance Tracker</span>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
