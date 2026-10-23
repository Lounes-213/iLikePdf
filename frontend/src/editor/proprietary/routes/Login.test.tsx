import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "@app/routes/Login";
import { useGoogleButton } from "@app/components/account/useGoogleButton";

vi.mock("@app/components/account/useGoogleButton", () => ({
  useGoogleButton: vi.fn(() => ({
    containerRef: { current: null },
    clientId: "test-client-id",
    ready: true,
  })),
}));

vi.mock("@app/services/authWorker", () => ({
  isAuthConfigured: vi.fn(() => true),
}));

describe("Login (Google-only)", () => {
  it("has no email or password fields", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /sign in to ilikepdf/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(useGoogleButton).toHaveBeenCalled();
  });
});
