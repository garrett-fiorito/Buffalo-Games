import { Bird, CircleDollarSign, CircleDot, Landmark, Rocket, Sparkles } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

type SiteLayoutProps = {
  children: ReactNode;
};

export function SiteLayout({ children }: SiteLayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className={`site-shell${isHome ? " site-shell--home" : ""}`}>
      <header className="site-header" aria-label="Site header">
        <Link className="brand-mark" to="/" aria-label="Black Buffalo Games home">
          <span className="brand-icon" aria-hidden="true">
            <BuffaloGlyph />
          </span>
          <span>
            <span className="brand-title">Black Buffalo</span>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
            <Landmark size={17} aria-hidden="true" />
            Lobby
          </NavLink>
          <NavLink
            to="/games/blackjack"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Sparkles size={17} aria-hidden="true" />
            Blackjack
          </NavLink>
          <NavLink
            to="/games/billiards"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <CircleDot size={17} aria-hidden="true" />
            Billiards
          </NavLink>
          <NavLink
            to="/games/flappy-buffalo"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Bird size={17} aria-hidden="true" />
            Flappy
          </NavLink>
          <NavLink
            to="/games/brave-buffalo"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Rocket size={17} aria-hidden="true" />
            Brave Buffalo
          </NavLink>
          <NavLink
            to="/games/roulette"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <CircleDollarSign size={17} aria-hidden="true" />
            Roulette
          </NavLink>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function BuffaloGlyph() {
  return (
    <svg className="buffalo-glyph" viewBox="0 0 128 82" role="img" aria-label="Buffalo profile">
      <path
        className="buffalo-glyph__body"
        d="M8 43c6-7 13-10 22-10 5-13 17-22 34-25 16-2 29 2 38 12 7 1 12 5 15 11l10-8c-1 10-7 17-17 20-1 8-5 14-12 18-9 6-22 8-39 7-15-1-27-4-36-10-8-1-15-5-21-12l6-3Z"
        fill="currentColor"
      />
      <path
        className="buffalo-glyph__mane"
        d="M29 34c5-12 16-20 34-23-6 6-8 15-6 26-11 4-21 4-28-3Z"
        fill="var(--color-bg)"
      />
      <path
        className="buffalo-glyph__legs"
        d="M33 58h10l-2 19H30l3-19Zm29 3h10l2 16H63l-1-16Zm31-5h9l-1 21H91l2-21Z"
        fill="currentColor"
      />
      <path
        className="buffalo-glyph__horn"
        d="M103 21c9-8 17-10 25-7-6 2-10 6-13 12l-10 6-2-11Z"
        fill="var(--color-cream)"
      />
      <circle cx="97" cy="30" r="2.8" fill="var(--color-cream)" />
    </svg>
  );
}
