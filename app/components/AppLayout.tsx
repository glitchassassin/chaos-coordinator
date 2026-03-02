import { useState } from "react";

interface AppLayoutProps {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Root layout component.
 * A persistent header holds the sidebar toggle button.
 * Below it: optional 240px sidebar (togglable) + fluid main.
 * No animations — sidebar shows/hides instantly.
 */
export function AppLayout({ sidebar, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const hasSidebar = sidebar != null;

  return (
    <div className="app-layout">
      {hasSidebar && (
        <header className="app-header">
          <button
            type="button"
            className="app-sidebar-toggle"
            onClick={() => { setSidebarOpen((o) => !o); }}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
        </header>
      )}
      <div className={`app-body${sidebarOpen && hasSidebar ? " sidebar-open" : ""}`}>
        {sidebarOpen && hasSidebar && (
          <nav className="app-sidebar">{sidebar}</nav>
        )}
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
