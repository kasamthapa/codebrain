const baseUrl = import.meta.env.VITE_API_BASE_URL;

export const askQuestion = async (
  repoUrl: string,
  question: string,
  onChunk: (chunk: string) => void,
) => {
  const response = await fetch(`${baseUrl}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repoUrl,
      question,
    }),
  });
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const val = decoder.decode(value);

    const lines = val.split("\n\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const cleanedLine = line.slice(6);
        onChunk(cleanedLine);
      }
    }
  }
};
