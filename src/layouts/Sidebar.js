import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { icons } from "../components/icons";

function Chevron({ open }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </svg>
  );
}

function NavItem({ item, showLabels, onMobileClose, nested = false }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={item.label}
      onClick={() => {
        if (window.innerWidth < 1024) onMobileClose();
      }}
      className={({ isActive }) =>
        `group flex items-center rounded-2xl py-1.5 text-sm font-medium transition ${
          showLabels ? "gap-3 px-2" : "justify-center px-1"
        } ${nested && showLabels ? "ml-2" : ""} ${
          isActive
            ? nested
              ? "bg-brand-blue/25 text-white"
              : "bg-brand-blue text-white shadow-[0_8px_20px_rgba(4,114,223,0.4)]"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex shrink-0 items-center justify-center rounded-[13px] shadow-md ${
              nested ? "h-8 w-8" : "h-10 w-10"
            } ${isActive ? "bg-white/20" : "bg-white/12"}`}
          >
            {icons[item.icon] || icons.layers}
          </span>
          {showLabels ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
        </>
      )}
    </NavLink>
  );
}

function NavGroup({ item, showLabels, onMobileClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const closeTimer = useRef(null);
  const childActive = item.children.some(
    (child) =>
      location.pathname === child.to || location.pathname.startsWith(`${child.to}/`)
  );
  const [accordionOpen, setAccordionOpen] = useState(childActive);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  // Collapse submenu when another top-level route is active
  useEffect(() => {
    setAccordionOpen(childActive);
    setFlyoutOpen(false);
  }, [childActive, location.pathname]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const iconsOnly = !showLabels;

  const openFlyout = () => {
    if (!iconsOnly) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFlyoutOpen(true);
  };

  const scheduleCloseFlyout = () => {
    if (!iconsOnly) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), 280);
  };

  return (
    <div
      className="relative space-y-0.5"
      onMouseEnter={openFlyout}
      onMouseLeave={scheduleCloseFlyout}
    >
      <button
        type="button"
        title={item.label}
        onClick={() => {
          if (showLabels) setAccordionOpen((value) => !value);
        }}
        className={`group flex w-full items-center rounded-2xl py-1.5 text-sm font-medium transition ${
          showLabels ? "gap-3 px-2" : "justify-center px-1"
        } ${
          childActive || flyoutOpen
            ? "bg-brand-blue/20 text-white"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] shadow-md ${
            childActive || flyoutOpen ? "bg-brand-blue text-white" : "bg-white/12"
          }`}
        >
          {icons[item.icon] || icons.flow}
        </span>
        {showLabels ? (
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate">{item.label}</span>
            <Chevron open={accordionOpen} />
          </span>
        ) : null}
      </button>

      {showLabels && accordionOpen
        ? item.children.map((child) => (
            <NavItem
              key={child.key}
              item={child}
              showLabels={showLabels}
              onMobileClose={onMobileClose}
              nested
            />
          ))
        : null}

      {iconsOnly && flyoutOpen ? (
        <div
          className="absolute left-full top-0 z-50 pl-2"
          onMouseEnter={openFlyout}
          onMouseLeave={scheduleCloseFlyout}
        >
          <div className="nav-flyout w-56 overflow-hidden rounded-2xl p-2">
            <p className="nav-flyout-title px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
              {item.label}
            </p>
            {item.children.map((child) => {
              const active =
                location.pathname === child.to || location.pathname.startsWith(`${child.to}/`);
              return (
                <button
                  key={child.key}
                  type="button"
                  className={`nav-flyout-item flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition ${
                    active ? "is-active" : ""
                  }`}
                  onClick={() => {
                    navigate(child.to);
                    setFlyoutOpen(false);
                    if (window.innerWidth < 1024) onMobileClose();
                  }}
                >
                  <span className="nav-flyout-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]">
                    {icons[child.icon] || icons.layers}
                  </span>
                  <span className="truncate">{child.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Sidebar({ items, pinned, onTogglePin, visible, mobileOpen, onMobileClose }) {
  const showLabels = pinned || mobileOpen;

  if (!visible && !mobileOpen) return null;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-brand-navy/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-label="Close menu"
        />
      ) : null}

      <aside
        className={`mac-dock fixed z-40 flex flex-col overflow-visible text-white ${
          pinned ? "is-pinned" : "is-icons"
        } ${mobileOpen ? "is-open" : "is-closed"}`}
      >
        <div
          className={`hidden items-center p-2.5 lg:flex ${
            showLabels ? "justify-between gap-2" : "justify-center"
          }`}
        >
          <button
            type="button"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] transition ${
              pinned ? "bg-brand-blue text-white" : "bg-white/12 text-white/80 hover:bg-white/18"
            }`}
            onClick={onTogglePin}
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin navigation" : "Pin navigation"}
            title={pinned ? "Unpin menu" : "Pin menu"}
          >
            {icons.menu}
          </button>
          {showLabels ? (
            <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
              Menu
            </span>
          ) : null}
        </div>

        <nav className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-visible px-2.5 pb-2.5">
          {items.map((item) =>
            item.children?.length ? (
              <NavGroup
                key={item.key}
                item={item}
                showLabels={showLabels}
                onMobileClose={onMobileClose}
              />
            ) : (
              <NavItem
                key={item.key}
                item={item}
                showLabels={showLabels}
                onMobileClose={onMobileClose}
              />
            )
          )}
        </nav>
      </aside>
    </>
  );
}
