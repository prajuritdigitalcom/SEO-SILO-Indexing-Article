import React from 'react';
import { Layers, FileOutput, History, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppView } from '../types.ts';

interface SidebarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const [imgError, setImgError] = React.useState(false);

  const navItems = [
    {
      id: 'generate' as const,
      label: 'Generate',
      icon: Layers,
      description: 'Input Bahan & Parameter Topik',
    },
    {
      id: 'output' as const,
      label: 'Hasil',
      icon: FileOutput,
      description: 'Output Level 1 & Level 2 Architecture',
    },
    {
      id: 'history' as const,
      label: 'Riwayat',
      icon: History,
      description: 'Tersimpan & Rekam Prompt History',
    },
    {
      id: 'settings' as const,
      label: 'Pengaturan',
      icon: Settings,
      description: 'Gemini API Key Pool & Config',
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#F1DDE2] text-[#1F1720]">
      {/* Brand & Logo Header */}
      <div className={`h-16 px-4 flex items-center justify-between border-b border-[#F1DDE2] ${collapsed ? 'px-2 justify-center' : ''}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          {!imgError ? (
            <img
              src="https://i.ibb.co.com/wr0x733r/prajurit-digital.jpg"
              alt="Prajurit Digital Logo"
              onError={() => setImgError(true)}
              className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-[#F1DDE2]"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#FE4C6F] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              PD
            </div>
          )}

          {!collapsed && (
            <div className="truncate">
              <h1 className="font-bold text-sm text-[#1F1720] leading-tight truncate">
                Prajurit Digital
              </h1>
              <p className="text-[11px] text-[#6F6670] font-medium truncate">
                SILO & SEO Architect
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1.5 text-[#6F6670] hover:text-[#FE4C6F] hover:bg-[#FFE8EE] rounded-lg transition-colors flex-shrink-0"
          title={collapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                setMobileOpen(false);
              }}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all text-left ${
                isActive
                  ? 'bg-[#FE4C6F] text-white shadow-xs'
                  : 'text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F]'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
              {!collapsed && (
                <div className="flex-1 truncate">
                  <div className="leading-none">{item.label}</div>
                  <div className={`text-[11px] mt-1 font-normal truncate ${isActive ? 'text-pink-100' : 'text-[#6F6670]'}`}>
                    {item.description}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Copyright */}
      {!collapsed ? (
        <div className="p-3 border-t border-[#F1DDE2] text-center">
          <p className="text-[11px] text-[#6F6670] font-medium">
            © 2026 Karya Prajurit Digital.
          </p>
        </div>
      ) : (
        <div className="p-2 border-t border-[#F1DDE2] text-center">
          <span
            className="text-[10px] text-[#6F6670] font-bold"
            title="© 2026 Karya Prajurit Digital."
          >
            © 2026
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block h-screen sticky top-0 transition-all duration-300 z-20 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 w-72 z-50 transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
