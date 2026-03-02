// @vitest-environment jsdom
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { AppLayout } from "./AppLayout";

afterEach(cleanup);

describe("AppLayout", () => {
  it("renders children inside main", () => {
    const { getByRole } = render(<AppLayout>content</AppLayout>);
    expect(getByRole("main").textContent).toBe("content");
  });

  it("renders sidebar inside nav when provided", () => {
    const { getByRole } = render(<AppLayout sidebar={<span>nav</span>}>content</AppLayout>);
    expect(getByRole("navigation").textContent).toBe("nav");
  });

  it("omits nav element when no sidebar", () => {
    const { queryByRole } = render(<AppLayout>content</AppLayout>);
    expect(queryByRole("navigation")).toBeNull();
  });
});
