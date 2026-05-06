import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

/**
 * Shared shell for the in-app legal pages. Renders a "draft / pending
 * legal review" banner on every page so we don't ship boilerplate as
 * if it were vetted.
 */
export default function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10 lg:py-16">
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex items-start gap-3 p-4 mb-8 rounded-lg border border-yellow-500/40 bg-yellow-500/5">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-500/90">
            <strong className="block">Draft — pending legal review.</strong>
            This document is provided as a starting point and has not been
            reviewed by counsel. Please consult a lawyer before relying on it.
          </div>
        </div>

        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
        </header>

        <article className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          {children}
        </article>
      </div>
    </div>
  );
}
