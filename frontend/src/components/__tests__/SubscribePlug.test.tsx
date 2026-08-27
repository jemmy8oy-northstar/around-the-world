import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubscribePlug } from "../SubscribePlug";
import { isPending, clearPending } from "../../youtube/pendingChannelVisit";

const CHANNEL = "https://www.youtube.com/@jemmy8oy";

describe("SubscribePlug", () => {
  beforeEach(() => clearPending());

  it("renders nothing at all when the channel url is switched off", () => {
    const { container } = render(<SubscribePlug channelUrl="" />);

    // The server's kill switch. "Hidden but present" would still put a dashed
    // card's worth of space under the join form.
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the url has not arrived yet", () => {
    const { container } = render(<SubscribePlug channelUrl={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("links straight to the channel, in a new tab", () => {
    render(<SubscribePlug channelUrl={CHANNEL} />);

    const link = screen.getByRole("link", { name: /subscribe/i });

    expect(link).toHaveAttribute("href", CHANNEL);
    expect(link).toHaveAttribute("target", "_blank");
    // Without noopener the opened tab can navigate this one — and this one is
    // mid-join, holding a session.
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("parks the tap when there is no session to attribute it to", () => {
    render(<SubscribePlug channelUrl={CHANNEL} />);

    expect(isPending()).toBe(false);
    fireEvent.click(screen.getByRole("link", { name: /subscribe/i }));

    // The join screen has no token, so the visit is cashed in after joining.
    expect(isPending()).toBe(true);
  });

  it("records immediately instead of parking when a session already exists", () => {
    const onVisit = vi.fn();
    render(<SubscribePlug channelUrl={CHANNEL} onVisit={onVisit} />);

    fireEvent.click(screen.getByRole("link", { name: /subscribe/i }));

    expect(onVisit).toHaveBeenCalledOnce();
    expect(isPending()).toBe(false);
  });
});
