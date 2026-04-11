import { useEffect } from "react";

/**
 * Lightweight client-side document.title setter for per-page SEO in an SPA.
 * Restores the previous title on unmount so navigation doesn't leak stale
 * titles. No react-helmet dependency required.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
