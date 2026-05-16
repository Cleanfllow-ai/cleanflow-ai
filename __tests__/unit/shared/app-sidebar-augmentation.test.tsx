/**
 * Bug 6 — Augmentation nav item in sidebar.
 *
 * Asserts the AppSidebar renders a link to /augmentation labelled "Augmentation".
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Stub next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ prefetch: jest.fn() }),
}));

// Stub next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock("@/modules/auth", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { name: "Tester", email: "t@t.com" } }),
}));

jest.mock("@/shared/store/store", () => ({
  useAppSelector: () => [],
}));

jest.mock("@/modules/files/store/filesSlice", () => ({
  selectFiles: jest.fn(),
}));

// Dynamic import used for ChatDrawer — stub it
jest.mock("@/modules/chat/components/chat-drawer", () => ({
  ChatDrawer: () => null,
}));

import { AppSidebar } from "@/shared/layout/app-sidebar";

describe("AppSidebar — Augmentation nav item", () => {
  it("renders an Augmentation link pointing to /augmentation", () => {
    render(<AppSidebar />);
    const link = screen.getByRole("link", { name: /augmentation/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/augmentation");
  });

  it("Augmentation link appears between Data Catalog and Jobs", () => {
    render(<AppSidebar />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    const catalogIdx = hrefs.indexOf("/files");
    const augIdx = hrefs.indexOf("/augmentation");
    const jobsIdx = hrefs.indexOf("/jobs");
    expect(augIdx).toBeGreaterThan(catalogIdx);
    expect(augIdx).toBeLessThan(jobsIdx);
  });
});
