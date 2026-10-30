
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(auth)/login/page";

const { mockPush, mockPost } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/lib/axios", () => ({
  default: { post: mockPost },
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the login form", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: "Connexion" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Se connecter" }),
    ).toBeInTheDocument();
  });

  it("shows required-field errors when submitted empty", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("L'e-mail est obligatoire"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Le mot de passe est obligatoire"),
    ).toBeInTheDocument();

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("vous@exemple.com"),
      "not-an-email",
    );

    await user.type(
      screen.getByPlaceholderText("••••••••"),
      "password123",
    );

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("Format d'e-mail invalide"),
    ).toBeInTheDocument();

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than eight characters", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("vous@exemple.com"),
      "user@example.com",
    );

    await user.type(
      screen.getByPlaceholderText("••••••••"),
      "short",
    );

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("Minimum 8 caractères"),
    ).toBeInTheDocument();

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const password = screen.getByPlaceholderText("••••••••");

    expect(password).toHaveAttribute("type", "password");

    await user.click(password.parentElement!.querySelector("button")!);
    expect(password).toHaveAttribute("type", "text");

    await user.click(password.parentElement!.querySelector("button")!);
    expect(password).toHaveAttribute("type", "password");
  });

  it("stores the user data and redirects after successful login", async () => {
    const user = userEvent.setup();

    mockPost.mockResolvedValueOnce({
      data: {
        access_token: "test-token",
        user: {
          id: "user-123",
          prenom: "Houssem",
          nom: "Ezzeddine",
          email: "user@example.com",
          role: "ADMIN",
        },
      },
    });

    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("vous@exemple.com"),
      "user@example.com",
    );

    await user.type(
      screen.getByPlaceholderText("••••••••"),
      "password123",
    );

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/auth/login", {
        email: "user@example.com",
        password: "password123",
      });

      expect(mockPush).toHaveBeenCalledWith("/dashboard/new");
    });

    expect(localStorage.getItem("access_token")).toBe("test-token");
    expect(localStorage.getItem("user_role")).toBe("ADMIN");
    expect(localStorage.getItem("user_name")).toBe("Houssem Ezzeddine");
    expect(localStorage.getItem("user_id")).toBe("user-123");
  });

  it("displays an error when login fails", async () => {
    const user = userEvent.setup();

    mockPost.mockRejectedValueOnce(new Error("Invalid credentials"));

    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("vous@exemple.com"),
      "user@example.com",
    );

    await user.type(
      screen.getByPlaceholderText("••••••••"),
      "password123",
    );

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("E-mail ou mot de passe invalide"),
    ).toBeInTheDocument();

    expect(mockPush).not.toHaveBeenCalled();
  });
});
