import React from 'react';
import { Menu, Key, Lock } from 'lucide-react';
import { AppView, KeyPoolStats } from '../types.ts';

interface HeaderProps {
  currentView: AppView;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  keyStats?: KeyPoolStats;
  onOpenSettings: () => void;
  onLockApp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setMobileOpen,
  keyStats,
  onOpenSettings,
  onLockApp,
}) => {
  const titles: Record<AppView, string> = {
    generate: 'Generate — Input Bahan Konten',
    output: 'Hasil — Output Level 1 & Level 2 Architecture',
    history: 'Riwayat Arsitektur & Prompt',
    settings: 'Pengaturan & Gemini API Key Pool',
  };

  return (
    <header className="h-16 sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-[#F1DDE2] px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2 text-[#6F6670] hover:text-[#FE4C6F] hover:bg-[#FFE8EE] rounded-lg transition-colors"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base font-bold text-[#1F1720]">
            {titles[currentView]}
          </h2>
          <p className="text-xs text-[#6F6670] hidden sm:block">
            Prajurit Digital • Research → Architecture → Select → Prompt → Produce
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* API Key Pool Status Badge */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#F1DDE2] bg-[#FFF9FA] hover:bg-[#FFE8EE] text-xs font-medium text-[#1F1720] transition-colors"
          title="Kelola Gemini API Key Pool"
        >
          <Key className="w-3.5 h-3.5 text-[#FE4C6F]" />
          <span className="hidden sm:inline">API Key Pool:</span>
          {keyStats ? (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${
                keyStats.readyKeys > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : keyStats.hasSystemFallback
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {keyStats.readyKeys > 0
                ? `${keyStats.readyKeys} Key Siap`
                : keyStats.hasSystemFallback
                ? 'System Key'
                : 'Key Kosong'}
            </span>
          ) : (
            <span className="text-[#6F6670]">Checking...</span>
          )}
        </button>

        {/* Lock App Button */}
        {onLockApp && (
          <button
            onClick={onLockApp}
            className="p-2 text-[#6F6670] hover:text-[#FE4C6F] hover:bg-[#FFE8EE] rounded-lg border border-[#F1DDE2] bg-[#FFF9FA] transition-colors"
            title="Kunci Akses Aplikasi"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
