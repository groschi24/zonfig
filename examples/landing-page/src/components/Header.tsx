import type { SiteConfig } from "@/config";
import { LogoIcon } from "./Logo";

interface HeaderProps {
  config: SiteConfig;
}

export function Header({ config }: HeaderProps) {
  return (
    <header className="header">
      <div className="container header-inner">
        <a href="/" className="logo">
          <LogoIcon size={36} />
          {/* {config.site.name} */}
        </a>

        <nav className="nav">
          <a href="#problem" className="nav-link">
            Why
          </a>
          <a href="#how-it-works" className="nav-link">
            How it works
          </a>
          <a href="#features" className="nav-link">
            Features
          </a>
          <a href="/docs" className="nav-link">
            Docs
          </a>
          <a
            href={config.site.github}
            className="nav-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a href="/docs/quick-start" className="btn btn-primary btn-sm">
            Get Started
          </a>
        </nav>
      </div>
    </header>
  );
}
