import { Chunk } from "./chunk.type";

export interface EmbeddedChunk extends Chunk {
  embedding: number[];
}
