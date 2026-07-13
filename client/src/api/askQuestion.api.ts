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
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      if (event.startsWith("data: ")) {
        const cleanedEvent = event.slice(6);
        console.log(cleanedEvent);
        const parsed = JSON.parse(cleanedEvent);
        onChunk(parsed);
      }
    }
  }
};
