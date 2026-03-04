import path from 'path';

export function isPathSafe(requestedPath: string, sessionDir: string): boolean {
  // Resolve the absolute path
  const resolved = path.resolve(sessionDir, requestedPath);

  // Check if the resolved path is within the session directory
  return resolved.startsWith(sessionDir);
}

export function validatePath(requestedPath: string, sessionDir: string): string {
  if (!isPathSafe(requestedPath, sessionDir)) {
    throw new Error('Access denied: Path outside session directory');
  }
  return path.resolve(sessionDir, requestedPath);
}
