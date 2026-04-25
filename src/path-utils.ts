import path from 'path'
import fs from 'fs'

export class PathTraversalViolation extends Error {
  constructor(message = 'Security Violation: Path traversal attempt blocked') {
    super(message)
    this.name = 'PathTraversalViolation'
  }
}

// Validate path components don't contain dangerous characters or patterns
function validatePathComponents(virtualPath: string): void {
  // Check for null bytes or control characters
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(virtualPath)) {
    throw new PathTraversalViolation('Invalid path: contains control characters')
  }

  // Check for newlines (could be used in path traversal via log injection, etc.)
  if (/[\r\n]/.test(virtualPath)) {
    throw new PathTraversalViolation('Invalid path: contains newline characters')
  }
}

export function resolveSecurePhysicalPath(
  virtualPath: string,
  hostWorkspaceDir: string,
): string {
  // Validate input path first
  validatePathComponents(virtualPath)

  // Validate hostWorkspaceDir too (should never contain dangerous chars)
  if (!hostWorkspaceDir || typeof hostWorkspaceDir !== 'string') {
    throw new PathTraversalViolation('Invalid workspace directory')
  }

  // Strip the /workspace prefix if present
  const relativePath = virtualPath.replace(/^\/workspace\/?/, '')
  // Resolve to physical path
  const physicalPath = path.resolve(hostWorkspaceDir, relativePath)

  // Check if file exists - if so, resolve symlinks
  if (fs.existsSync(physicalPath)) {
    const realPath = fs.realpathSync(physicalPath)
    if (!realPath.startsWith(hostWorkspaceDir)) {
      throw new PathTraversalViolation()
    }
    return realPath
  }

  // For new files, verify parent directory is within workspace
  const parentDir = path.dirname(physicalPath)
  const realParentDir = fs.realpathSync(parentDir)
  if (!realParentDir.startsWith(hostWorkspaceDir)) {
    throw new PathTraversalViolation()
  }
  return physicalPath
}
