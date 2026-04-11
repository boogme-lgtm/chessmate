import { Link } from "wouter";

/**
 * Minimal site footer — shared across public pages. Includes legal links
 * and copyright. Homepage can still render its own branded footer if needed;
 * this one is for browse/detail/auth pages.
 */
export default function Footer() {
  return (
    <footer className="border-t border-border/50 py-10 mt-16">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png"
              alt="BooGMe"
              className="h-6 w-auto"
              loading="lazy"
            />
          </div>
          <nav className="flex items-center gap-6" aria-label="Footer">
            <Link
              href="/privacy"
              className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <a
              href="mailto:hello@boogme.com"
              className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </nav>
          <p className="text-sm font-light text-muted-foreground">
            © 2026 BooGMe. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
