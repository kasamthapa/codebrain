export function shouldIncludeFile(path: string): boolean {
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
