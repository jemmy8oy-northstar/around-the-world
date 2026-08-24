const MAX_EDGE = 1600;
const QUALITY = 0.8;

/**
 * Shrinks a phone photo before upload.
 *
 * A modern phone shoots 3–5MB. On pub wifi at 11pm that is the difference
 * between the app working and the app being abandoned, and it costs a canvas
 * draw. The server still enforces its own type and size limits — this is a UX
 * measure, not a security control.
 *
 * Falls back to the original file if anything goes wrong: a slightly slow upload
 * beats not being able to post at all.
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );

    // Re-encoding a small photo can make it bigger; keep whichever is smaller.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
