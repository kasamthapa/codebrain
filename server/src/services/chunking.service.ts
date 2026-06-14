import { Chunk } from "../types/chunk.type";
import { parse } from "@typescript-eslint/parser";

export const chunkCode = (
  content: string,
  filePath: string,
  extension: string,
): Chunk[] => {
  try {
    if (
      extension !== "ts" &&
      extension !== "tsx" &&
      extension !== "js" &&
      extension !== "jsx"
    )
      return [];
    const ast = parse(content, {
      jsx: true,
    });
    const chunkArray: Chunk[] = [];
    //collecting imporDeclartion nodes and making a separate chunk
    const importNodes = ast.body.filter(
      (node) => node.type === "ImportDeclaration",
    );
    if (importNodes.length > 0) {
      const importTypeContent = importNodes
        .map((node) => content.slice(node.range[0], node.range[1]))
        .join("\n");
      const importTypeChunk: Chunk = {
        content: importTypeContent,
        filePath,
        startLine: importNodes[0].loc.start.line,
        endLine: importNodes[importNodes.length - 1].loc.end.line,
        type: "import",
        extension,
      };
      chunkArray.push(importTypeChunk);
    }

    for (const node of ast.body) {
      if (node.type === "ExportNamedDeclaration") {
        chunkArray.push({
          content: content.slice(node.range[0], node.range[1]),
          filePath,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          type: getChunkType(node),
          extension,
        });
      }
      if (node.type === "FunctionDeclaration") {
        chunkArray.push({
          content: content.slice(node.range[0], node.range[1]),
          filePath,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          type: "function",
          extension,
        });
      }
      if (node.type === "ExportDefaultDeclaration") {
        chunkArray.push({
          content: content.slice(node.range[0], node.range[1]),
          filePath,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          type:
            node.declaration.type === "FunctionDeclaration"
              ? "function"
              : node.declaration.type === "ClassDeclaration"
                ? "class"
                : "other",
          extension,
        });
      }
      if (node.type === "VariableDeclaration") {
        if (!node.declarations[0].init) continue;
        const isFunction =
          node.declarations[0].init.type === "ArrowFunctionExpression" ||
          node.declarations[0].init.type === "FunctionExpression";

        chunkArray.push({
          content: content.slice(node.range[0], node.range[1]),
          filePath,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          type: isFunction ? "function" : "other",
          extension,
        });
      }
    }

    return chunkArray;
  } catch (e: any) {
    console.warn(`Failed to chunk file ${filePath}:`, e.message);
    return [];
  }
};

//function to get type of declaration
function getChunkType(
  node: any,
): "function" | "class" | "import" | "type" | "other" {
  if (!node.declaration) return "other";
  if (node.declaration.type === "FunctionDeclaration") return "function";
  if (node.declaration.type === "ClassDeclaration") return "class";
  if (node.declaration.type === "TSInterfaceDeclaration") return "type";
  if (node.declaration.type === "TSTypeAliasDeclaration") return "type";
  if (node.declaration.type === "VariableDeclaration") {
    if (!node.declaration.declarations[0].init) return "other";
    if (
      node.declaration.declarations[0].init.type ===
        "ArrowFunctionExpression" ||
      node.declaration.declarations[0].init.type === "FunctionExpression"
    ) {
      return "function";
    } else {
      return "other";
    }
  } else {
    return "other";
  }
}
