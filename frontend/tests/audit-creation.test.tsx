
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import NewAuditPage from "@/app/dashboard/new/page";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("Nouvel audit page", () => {
  beforeEach(() => {
    mockPush.mockReset();
    localStorage.clear();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the URL field, CMS selector, and Continue button", () => {
    render(<NewAuditPage />);

    expect(
      screen.getByRole("heading", { name: "Nouvel audit" }),
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText("https://exemple.com"),
    ).toBeInTheDocument();

    expect(screen.getByRole("combobox")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Continuer" }),
    ).toBeInTheDocument();
  });

  it("rejects an empty URL and stays on the first step", () => {
    render(<NewAuditPage />);

    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

    expect(screen.getByText("URL obligatoire")).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText("https://exemple.com"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Analyses techniques"),
    ).not.toBeInTheDocument();
  });

  it("rejects a malformed URL", () => {
    render(<NewAuditPage />);

    fireEvent.change(screen.getByPlaceholderText("https://exemple.com"), {
      target: { value: "not-a-valid-url" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

    expect(
      screen.getByText("URL invalide (ex: https://exemple.com)"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Analyses techniques"),
    ).not.toBeInTheDocument();
  });


  it("advances to the analysis step when the URL is valid", () => {
    render(<NewAuditPage />);

    fireEvent.change(screen.getByPlaceholderText("https://exemple.com"), {
      target: { value: "https://example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

    expect(screen.getByText("Analyses techniques")).toBeInTheDocument();
    expect(screen.getByText("SEO technique")).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
  });

  it("allows the CMS to be selected manually", () => {
    render(<NewAuditPage />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "WordPress" },
    });

    expect(screen.getByRole("combobox")).toHaveValue("WordPress");
  });

  it("does not navigate away just by opening the page", () => {
    render(<NewAuditPage />);

    expect(mockPush).not.toHaveBeenCalled();
  });
});
