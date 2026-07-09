import { describe, it, expect } from "vitest";
import { parseStyleFile, breakdownFiles, stemOf, pairByStem, RAW_EXTENSIONS } from "./styleFiles";

const B2 = "https://s3.us-east-005.backblazeb2.com/imagick";

describe("RAW_EXTENSIONS", () => {
  it("covers the documented RAW variants", () => {
    for (const ext of [
      "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "raf", "dng",
      "orf", "rw2", "pef", "srw", "raw", "rwl", "3fr", "fff", "iiq", "x3f",
    ]) {
      expect(RAW_EXTENSIONS.has(ext)).toBe(true);
    }
  });
});

describe("parseStyleFile", () => {
  it("extracts filename/ext/kind from a plain B2 url", () => {
    expect(parseStyleFile(`${B2}/styles/u1/s1/before/IMG_1234.CR2`)).toEqual({
      url: `${B2}/styles/u1/s1/before/IMG_1234.CR2`,
      filename: "IMG_1234.CR2",
      ext: "CR2",
      kind: "raw",
    });
  });

  it("classifies jpg/jpeg as jpeg", () => {
    expect(parseStyleFile(`${B2}/styles/u1/s1/after/a.jpg`).kind).toBe("jpeg");
    expect(parseStyleFile(`${B2}/styles/u1/s1/after/a.jpeg`).kind).toBe("jpeg");
  });

  it("classifies heic/heif as heic", () => {
    expect(parseStyleFile("a.heic").kind).toBe("heic");
    expect(parseStyleFile("a.heif").kind).toBe("heic");
  });

  it("classifies unknown extensions as other", () => {
    expect(parseStyleFile("a.psd").kind).toBe("other");
  });

  it("handles a missing extension", () => {
    const parsed = parseStyleFile("noext");
    expect(parsed.ext).toBe("");
    expect(parsed.kind).toBe("other");
  });

  it("strips query strings before extracting the filename", () => {
    expect(parseStyleFile(`${B2}/styles/u1/s1/before/photo.png?X-Amz-Signature=abc&foo=bar`)).toMatchObject({
      filename: "photo.png",
      ext: "png",
      kind: "png",
    });
  });

  it("strips a hash fragment", () => {
    expect(parseStyleFile("https://example.com/dir/photo.webp#frag").filename).toBe("photo.webp");
  });

  it("decodes URL-encoded filenames", () => {
    expect(parseStyleFile(`${B2}/styles/u1/s1/before/my%20photo%20(1).jpg`).filename).toBe("my photo (1).jpg");
  });

  it("does not throw on malformed percent-encoding", () => {
    expect(() => parseStyleFile(`${B2}/styles/u1/s1/before/bad%.jpg`)).not.toThrow();
  });

  it("handles an empty/undefined-ish url", () => {
    expect(parseStyleFile("")).toEqual({ url: "", filename: "", ext: "", kind: "other" });
  });
});

describe("breakdownFiles", () => {
  it("counts and classifies a mixed list", () => {
    const result = breakdownFiles([
      `${B2}/a/IMG_1.CR2`,
      `${B2}/a/IMG_1.jpg`,
      `${B2}/a/IMG_2.jpeg`,
      `${B2}/a/IMG_3.png`,
      `${B2}/a/IMG_4.heic`,
      null,
      undefined,
      "",
    ]);
    expect(result.total).toBe(5);
    expect(result.byKind).toEqual({ raw: 1, jpeg: 2, png: 1, heic: 1, tiff: 0, webp: 0, other: 0 });
    expect(result.files).toHaveLength(5);
  });

  it("returns a zeroed breakdown for null/empty input", () => {
    expect(breakdownFiles(null)).toEqual({
      total: 0,
      byKind: { raw: 0, jpeg: 0, png: 0, heic: 0, tiff: 0, webp: 0, other: 0 },
      files: [],
    });
    expect(breakdownFiles(undefined).total).toBe(0);
    expect(breakdownFiles([]).total).toBe(0);
  });
});

describe("stemOf", () => {
  it("lowercases and strips the extension (last dot only)", () => {
    expect(stemOf("IMG_1234.CR2")).toBe("img_1234");
    expect(stemOf("My.Photo.v2.JPG")).toBe("my.photo.v2");
  });

  it("returns the whole (lowercased) name when there is no extension", () => {
    expect(stemOf("NoExtension")).toBe("noextension");
  });
});

describe("pairByStem", () => {
  it("pairs before/after by filename stem, case-insensitively", () => {
    const before = [`${B2}/before/IMG_1.CR2`, `${B2}/before/IMG_2.CR2`];
    const after = [`${B2}/after/img_1.jpg`, `${B2}/after/IMG_3.jpg`];
    const pairs = pairByStem(before, after);

    expect(pairs).toEqual([
      { stem: "img_1", before: `${B2}/before/IMG_1.CR2`, after: `${B2}/after/img_1.jpg` },
      { stem: "img_2", before: `${B2}/before/IMG_2.CR2` },
      { stem: "img_3", after: `${B2}/after/IMG_3.jpg` },
    ]);
  });

  it("sorts numerically so img2 comes before img10", () => {
    const before = [`${B2}/b/img10.jpg`, `${B2}/b/img2.jpg`, `${B2}/b/img1.jpg`];
    const pairs = pairByStem(before, []);
    expect(pairs.map((p) => p.stem)).toEqual(["img1", "img2", "img10"]);
  });

  it("handles empty/null inputs without throwing", () => {
    expect(pairByStem(null, undefined)).toEqual([]);
    expect(pairByStem([], [])).toEqual([]);
  });
});
