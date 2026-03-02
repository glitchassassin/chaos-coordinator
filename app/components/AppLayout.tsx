interface AppLayoutProps {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Root layout component.
 * Mobile: single column stacked (sidebar on top).
 * Desktop (≥768px): 240px sidebar + fluid main.
 * Visual grouping via borders only — no background fills.
 */
export function AppLayout({ sidebar, children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      {sidebar != null && <nav className="app-sidebar">{sidebar}</nav>}
      <main className="app-main">{children}</main>
    </div>
  );
}
