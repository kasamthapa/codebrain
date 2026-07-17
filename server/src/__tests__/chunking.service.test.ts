import { describe, test, expect } from "vitest";
import { chunkCode } from "../services/chunking.service";

describe("services.chunkingService", () => {
  test.each([
    ["/src/services/code.py", "py"],
    ["/src/services/code.cs", "cs"],
    ["/src/services/code.c", "c"],
  ])("returns an empty array for invalid file types", (filePath, extension) => {
    const validCode = "const x = 5;";
    expect(chunkCode(validCode, filePath, extension)).toEqual([]);
  });

  test("returns a single grouped chunk for all import types in a file", () => {
    const content = `import { useState } from "react";\nimport axios from "axios"`;
    expect(chunkCode(content, "/src/services/code.ts", "ts")).toEqual([
      {
        content: content,
        filePath: "/src/services/code.ts",
        startLine: 1,
        endLine: 2,
        type: "import",
        extension: "ts",
      },
    ]);
  });

  test("returns a function type chunk for FunctionDeclartion node type", () => {
    const content = `function myFunction() {
  return true}`;
    expect(chunkCode(content, "/src/services/code.ts", "ts")).toEqual([
      {
        content: content,
        filePath: "/src/services/code.ts",
        startLine: 1,
        endLine: 2,
        type: "function",
        extension: "ts",
      },
    ]);
  });

  test.each([`function(){let x = 5;`, `()=>{let h=5}`])(
    "returns an empty array for invalid/broken syntax",
    (content) => {
      expect(chunkCode(content, "/src/services/code.ts", "ts")).toEqual([]);
    },
  );
  test("returns chunks with zero import-type for file wiht no imports", () => {
    const content = `function myFunction() {
    return true}
    export const a = 5;
    `;
    expect(chunkCode(content, "/src/services/code.ts", "ts")).toEqual([
      {
        content: `function myFunction() {
    return true}`,
        filePath: "/src/services/code.ts",
        startLine: 1,
        endLine: 2,
        type: "function",
        extension: "ts",
      },
      {
        content: `export const a = 5;`,
        filePath: "/src/services/code.ts",
        startLine: 3,
        endLine: 3,
        type: "other",
        extension: "ts",
      },
    ]);
  });
});
