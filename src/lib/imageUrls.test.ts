import { describe, it, expect } from "vitest";
import {
  parseB2Url,
  getThumbnailUrl,
  getPreviewUrl,
  getEditedUrl,
  getEditedThumbnailUrl,
  getEditedPreviewUrl,
} from "./imageUrls";

// Stored URLs (in the DB) use the S3 host; the browser is served from the CDN.
const B2 = "https://s3.us-east-005.backblazeb2.com/imagick";
const CDN = "https://cdn.imagick.ai";
const original = `${B2}/galleries/user-1/gal-1/photo.JPG`;

describe("parseB2Url", () => {
  it("splits basePath, filename and extension out of a stored S3 URL", () => {
    expect(parseB2Url(original)).toEqual({
      basePath: "galleries/user-1/gal-1",
      filename: "photo",
      extension: "JPG",
    });
  });

  it("parses a CDN URL to the same bucket-relative key", () => {
    expect(parseB2Url(`${CDN}/galleries/user-1/gal-1/photo.JPG`)).toEqual({
      basePath: "galleries/user-1/gal-1",
      filename: "photo",
      extension: "JPG",
    });
  });

  it("parses a native friendly download URL (/file/imagick/...)", () => {
    expect(parseB2Url("https://f005.backblazeb2.com/file/imagick/galleries/user-1/gal-1/photo.JPG")).toEqual({
      basePath: "galleries/user-1/gal-1",
      filename: "photo",
      extension: "JPG",
    });
  });

  it("returns null for empty input", () => {
    expect(parseB2Url("")).toBeNull();
  });
});

describe("getThumbnailUrl", () => {
  it("rewrites a stored original to a CDN thumbnail webp", () => {
    expect(getThumbnailUrl(original)).toBe(
      `${CDN}/galleries/user-1/gal-1/thumbnail/photo_reduced_thumbnail.webp`,
    );
  });

  it("is idempotent on an already-derived thumbnail URL", () => {
    const thumb = `${CDN}/galleries/user-1/gal-1/thumbnail/photo_reduced_thumbnail.webp`;
    expect(getThumbnailUrl(thumb)).toBe(thumb);
  });

  it("normalises a compressed URL back to a thumbnail", () => {
    const compressed = `${B2}/galleries/user-1/gal-1/compressed/photo_reduced.webp`;
    expect(getThumbnailUrl(compressed)).toBe(
      `${CDN}/galleries/user-1/gal-1/thumbnail/photo_reduced_thumbnail.webp`,
    );
  });

  it("passes through empty strings without throwing", () => {
    expect(getThumbnailUrl("")).toBe("");
  });
});

describe("getPreviewUrl", () => {
  it("rewrites a stored original to a CDN compressed webp", () => {
    expect(getPreviewUrl(original)).toBe(
      `${CDN}/galleries/user-1/gal-1/compressed/photo_reduced.webp`,
    );
  });

  it("is idempotent on an already-derived preview URL", () => {
    const preview = `${CDN}/galleries/user-1/gal-1/compressed/photo_reduced.webp`;
    expect(getPreviewUrl(preview)).toBe(preview);
  });
});

describe("getEditedUrl variants", () => {
  it("places the styleId before the filename for the original edit", () => {
    expect(getEditedUrl(original, "style-x")).toBe(
      `${CDN}/galleries/user-1/gal-1/style-x/photo.jpeg`,
    );
  });

  it("derives an edited thumbnail URL", () => {
    expect(getEditedThumbnailUrl(original, "style-x")).toBe(
      `${CDN}/galleries/user-1/gal-1/style-x/thumbnail/photo_reduced_thumbnail.webp`,
    );
  });

  it("derives an edited preview URL", () => {
    expect(getEditedPreviewUrl(original, "style-x")).toBe(
      `${CDN}/galleries/user-1/gal-1/style-x/compressed/photo_reduced.webp`,
    );
  });
});
