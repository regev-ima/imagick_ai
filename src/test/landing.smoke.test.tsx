import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import LandingPage from "@/pages/LandingPage";
import PricingPage from "@/pages/PricingPage";

// jsdom lacks IntersectionObserver / ResizeObserver (real browsers have them).
beforeAll(() => {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error test polyfill
  window.IntersectionObserver = IO;
  // @ts-expect-error test polyfill
  window.ResizeObserver = IO;
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("marketing pages render", () => {
  it("renders the landing hero, pricing and FAQ without crashing", () => {
    wrap(<LandingPage />);
    expect(screen.getByText("Zero presets.")).toBeInTheDocument();
    // Pricing tiers present
    expect(screen.getAllByText(/Start for free/i).length).toBeGreaterThan(0);
    // A known FAQ question is rendered
    expect(
      screen.getByText(/What exactly is Imagick\.ai\?/i),
    ).toBeInTheDocument();
  });

  it("renders the pricing page with the comparison table", () => {
    wrap(<PricingPage />);
    expect(screen.getByText(/Compare every plan/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Studio/i).length).toBeGreaterThan(0);
  });
});
