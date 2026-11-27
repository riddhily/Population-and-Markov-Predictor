import {
  BarChart3,
  ChevronRight,
  FolderPlus,
  Grid3X3,
  History,
  LayoutGrid,
  PlayCircle,
  X,
} from 'lucide-react';
import type { PageId } from '../types';

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
}

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'simulation-manager', label: 'Simulation Manager', icon: FolderPlus },
  { id: 'matrix-builder', label: 'Matrix Builder', icon: Grid3X3 },
  { id: 'markov-simulator', label: 'Markov Simulator', icon: PlayCircle },
  { id: 'mathematical-analysis', label: 'Mathematical Analysis', icon: BarChart3 },
  { id: 'history-help', label: 'History & Help', icon: History },
];

export function MarkovGraphLogo() {
  return (
    <svg width="58" height="48" viewBox="0 0 64 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M32 9L50 21L43 41H21L14 21L32 9Z"
        stroke="#F5A623"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M14 21L50 21" stroke="#F5A623" strokeWidth="1.6" strokeOpacity="0.65" />
      <path d="M32 9L21 41" stroke="#F5A623" strokeWidth="1.6" strokeOpacity="0.65" />
      <circle cx="32" cy="9" r="4.5" fill="#10233F" stroke="#F5A623" strokeWidth="2.5" />
      <circle cx="50" cy="21" r="4.5" fill="#10233F" stroke="#F5A623" strokeWidth="2.5" />
      <circle cx="43" cy="41" r="4.5" fill="#10233F" stroke="#F5A623" strokeWidth="2.5" />
      <circle cx="21" cy="41" r="4.5" fill="#10233F" stroke="#F5A623" strokeWidth="2.5" />
      <circle cx="14" cy="21" r="4.5" fill="#10233F" stroke="#F5A623" strokeWidth="2.5" />
    </svg>
  );
}

export function Sidebar({
  activePage,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  collapsed,
}: SidebarProps) {
  const handleSelect = (id: PageId) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-30 bg-[#10233F]/50 backdrop-blur-[1px] lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-[#10233F] text-[#FFFCF6] transition-all duration-200 lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[76px]' : 'w-[248px]'} shrink-0 select-none shadow-lg`}
      >
        {/* Brand Header */}
        <div className="relative flex flex-col items-center px-4 pt-6 pb-5 border-b border-white/15">
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="absolute right-3 top-3 p-1.5 text-white/70 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>

          <MarkovGraphLogo />

          {!collapsed && (
            <div className="mt-2.5 text-center">
              <div className="font-serif-display text-[19px] font-bold tracking-wider text-white">
                MARKOV LAB
              </div>
              <div className="mt-1 font-serif-display italic text-[13px] leading-snug text-[#E8DFCE]">
                Population &amp;
                <br />
                Markov Predictor
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links (Exactly 6 Pages) */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center justify-between gap-2.5 rounded-lg px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#F5A623] text-[#10233F] font-semibold shadow-sm'
                    : 'text-[#F5F0E6]/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive ? 'text-[#10233F]' : 'text-[#F5A623]'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
                {isActive && !collapsed && (
                  <ChevronRight className="w-4 h-4 shrink-0 text-[#10233F]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Formula & Palette Footer */}
        {!collapsed && (
          <div className="px-5 pb-5 pt-4 border-t border-white/15 text-center">
            <div className="font-serif-display italic text-[14.5px] tracking-wide text-[#F5F0E6]">
              v(k + 1) = P &times; v(k)
            </div>
            <div className="mt-3.5 pt-3 border-t border-white/15 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#4D83A8]" />
                <span className="w-3 h-3 rounded-full bg-[#F5F0E6]" />
                <span className="w-3 h-3 rounded-full bg-[#F5A623]" />
                <span className="w-3 h-3 rounded-full bg-[#64748B]" />
              </div>
              <span className="text-[11px] tracking-wide text-[#D5CCB9]">
                Linen &middot; Navy &middot; Amber
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
