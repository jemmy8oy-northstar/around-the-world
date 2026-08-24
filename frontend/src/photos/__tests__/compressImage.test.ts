import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressImage } from "../compressImage";

function fakeFile(size: number): File {
  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** jsdom has no canvas or createImageBitmap, so both are stubbed. */
function stubCanvas(outputSize: number) {
  const toBlob = vi.fn((cb: (b: Blob | null) => void) => {
    const blob = new Blob(["y"]);
    Object.defineProperty(blob, "size", { value: outputSize });
    cb(blob);
  });

  vi.spyOn(document, "createElement").mockImplementation(
    () =>
      ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob,
      }) as unknown as HTMLCanvasElement,
  );

  return toBlob;
}

describe("compressImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })),
    );
  });

  it("returns the compressed blob when it is smaller", async () => {
    stubCanvas(200_000);
    const result = await compressImage(fakeFile(5_000_000));

    expect(result.size).toBe(200_000);
  });

  it("keeps the original when re-encoding would make it bigger", async () => {
    stubCanvas(90_000);
    const original = fakeFile(40_000);

    // Re-encoding an already-small photo can inflate it; uploading the larger
    // one would be strictly worse.
    expect(await compressImage(original)).toBe(original);
  });

  it("falls back to the original file if anything throws", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("unsupported");
      }),
    );
    const original = fakeFile(5_000_000);

    // A slow upload beats not being able to post at all.
    expect(await compressImage(original)).toBe(original);
  });

  it("falls back when no 2d context is available", async () => {
    vi.spyOn(document, "createElement").mockImplementation(
      () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
    );
    const original = fakeFile(5_000_000);

    expect(await compressImage(original)).toBe(original);
  });
});
