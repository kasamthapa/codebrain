import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

export const fetchRepoFiles = async (
  repoUrl: string,
): Promise<Array<{ path: string; content: string; extension: string }>> => {
  //extract owner and repo name from the repoUrl
  const url = new URL(repoUrl);

  if (url.hostname !== "github.com") {
    throw new ApiError(400, "Invalid GitHub repository URL");
  }

  const [owner, repo] = url.pathname.split("/").filter(Boolean);

  if (!owner || !repo) {
    throw new ApiError(400, "Invalid GitHub repository URL");
  }
  try {
    //get array of files from git tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "User-Agent": "codebrain",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (treeResponse.ok === false) {
      throw new ApiError(
        treeResponse.status,
        "Repository not found or inaccessible",
      );
    }
    const treeData = await treeResponse.json();
    if (treeData.truncated === true) {
      throw new ApiError(422, "Repository is too large to process");
    }
    //filtering only blob and only required types
    const filteredData = treeData.tree.filter(
      (d: any) => d.type === "blob" && shouldIncludeFile(d.path),
    );
    const resultArray: Array<{
      path: string;
      content: string;
      extension: string;
    }> = [];
    // Note: rate limit tracking has a known race condition in parallel requests.
    // Values may be slightly stale. Acceptable for current scale.
    let remainingRequest = 5000;
    let resetTime = 0;
    for (let i = 0; i < filteredData.length; i += 10) {
      if (remainingRequest < 50) {
        await new Promise((resolve) => setTimeout(resolve, resetTime));
      }
      const chunk = filteredData.slice(i, i + 10);
      await Promise.all(
        chunk.map(async (item: any) => {
          const sha = item.sha;

          const blobResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`,
            {
              headers: {
                Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                "User-Agent": "codebrain",
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
            },
          );

          remainingRequest = Number(
            blobResponse.headers.get("x-ratelimit-remaining"),
          );
          resetTime =
            Number(blobResponse.headers.get("x-ratelimit-reset")) * 1000 -
            Date.now();

          const blobData = await blobResponse.json();
          const rawData = Buffer.from(blobData.content, "base64").toString(
            "utf-8",
          );
          const parts = item.path.split(".");
          const returnObject = {
            path: item.path,
            content: rawData,
            extension: parts.length > 1 ? parts.pop() : "",
          };
          resultArray.push(returnObject);
        }),
      );
    }
    return resultArray;
  } catch (e: any) {
    if (e instanceof ApiError) {
      throw e;
    }
    throw new ApiError(502, "Failed to fetch repository contents");
  }
};

function shouldIncludeFile(path: string): boolean {
  const ignoredFolders = [
    "node_modules/",
    "dist/",
    "build/",
    ".git/",
    ".next/",
    "coverage/",
    ".cache/",
    "vendor/",
  ];
  const ignoredFiles = ["package-lock.json", "yarn.lock"];
  const invalidExtension = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".ico",
    ".svg",
    ".pdf",
    ".zip",
    ".mp4",
    ".woff",
    ".ttf",
  ];
  const isIgnoredFolder = ignoredFolders.some(
    (folder) => path.startsWith(folder) || path.endsWith(folder),
  );
  const isIgnoredFile = ignoredFiles.some(
    (file) => path === file || path.endsWith("/" + file),
  );
  if (isIgnoredFile || isIgnoredFolder) return false;
  const hasInValidExtension = invalidExtension.some((ext) =>
    path.endsWith(ext),
  );
  if (hasInValidExtension) return false;
  return true;
}
