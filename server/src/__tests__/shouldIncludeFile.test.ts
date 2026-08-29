import { describe, test, expect } from "vitest";
import { shouldIncludeFile } from "../utils/shouldIncludeFile";

describe("shouldIncludeFile function", () => {
  test("returns false for ignored folder", () => {
    expect(shouldIncludeFile("build/index.js")).toEqual(false);
  });
  test("returns false for ignored files", () => {
    expect(shouldIncludeFile("package-lock.json")).toEqual(false);
  });
  test("returns false for invalid extension", () => {
    expect(shouldIncludeFile("/client/public/profile.png")).toEqual(false);
  });
  test("returns true for valid file", () => {
    expect(
      shouldIncludeFile("/server/src/services/github.services.ts"),
    ).toEqual(true);
  });
});
