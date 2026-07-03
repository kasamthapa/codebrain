import type { IndexResponse } from "../types/indexRepo.types";
import api from "./axiosInstance";

export const indexRepo = async (repoUrl: string): Promise<IndexResponse> => {
  const response = await api.post(`/index`, { repoUrl });
  return response.data;
};
