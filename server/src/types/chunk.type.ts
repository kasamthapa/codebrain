export interface Chunk {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  type: "function" | "class" | "import" | "type" | "other";
  extension: string;
}
