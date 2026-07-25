import { useState } from 'react';
import { Settings, UserRound, BellRing, Palette, ShieldCheck, Info } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Tabs } from '@/components/common/Tabs.jsx';
import { useRipple } from '@/hooks/useInteractions.js';
import { cn } from '@/utils/cn.js';
import { ProfileSection } from '@/components/settings/ProfileSection.jsx';
import { NotificationsSection } from '@/components/settings/NotificationsSection.jsx';
import { AppearanceSection } from '@/components/settings/AppearanceSection.jsx';
import { SecuritySection } from '@/components/settings/SecuritySection.jsx';
import { AboutSection } from '@/components/settings/AboutSection.jsx';

const SECTIONS = [
  { key: 'profile', label: 'Profile', icon: UserRound, Component: ProfileSection },
  { key: 'notifications', label: 'Notifications', icon: BellRing, Component: NotificationsSection },
  { key: 'appearance', label: 'Appearance', icon: Palette, Component: AppearanceSection },
  { key: 'security', label: 'Security', icon: ShieldCheck, Component: SecuritySection },
  { key: 'about', label: 'About', icon: Info, Component: AboutSection },
];

export default function SettingsPage() {
  const [active, setActive] = useState('profile');
  const ripple = useRipple();
  const current = SECTIONS.find((s) => s.key === active) || SECTIONS[0];
  const Active = current.Component;

  return (
    <div>
      <PageHeader title="Settings" description="Your profile, alerts, appearance and account." icon={Settings} />

      {/* Compact: horizontal tab bar. */}
      <div className="xl:hidden">
        <Tabs
          tabs={SECTIONS.map((s) => ({ key: s.key, label: s.label, icon: s.icon }))}
          value={active}
          onChange={setActive}
        />
      </div>

      <div className="xl:grid xl:grid-cols-[248px_1fr] xl:gap-6 xl:items-start">
        {/* Wide: persistent section rail. */}
        <nav aria-label="Settings sections" className="hidden xl:block xl:sticky xl:top-6">
          <div className="card stagger flex flex-col gap-1 p-2">
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const isActive = key === active;
              return (
                <button
                  key={key}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActive(key)}
                  onPointerDown={ripple}
                  className={cn(
                    'press ripple flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium',
                    'transition-[background-color,color] duration-medium ease-emphasized',
                    isActive ? 'bg-brand/15 text-brand-strong' : 'text-muted hover:bg-surface-2 hover:text-content'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Detail panel — re-keyed so it animates on section change. */}
        <div key={active} className="animate-slide-up">
          <Active />
        </div>
      </div>
    </div>
  );
}
