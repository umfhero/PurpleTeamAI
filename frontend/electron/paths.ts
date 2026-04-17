/**
 * Shared path utilities for PurpleTeam Suite.
 * 
 * In development, data lives alongside the project (process.cwd()).
 * In production (packaged), data lives in the OS-specific userData directory
 * and bundled resources live in process.resourcesPath.
 * 
 * This module centralises all path resolution so the rest of the codebase
 * doesn't need to worry about dev vs production differences.
 */

import { app } from 'electron'
import path from 'node:path'

/**
 * Whether the app is running as a packaged binary.
 */
export function isPackaged(): boolean {
  return app.isPackaged
}

/**
 * Root directory for user data (scans, reports, metrics, etc.).
 * - Dev:        <project>/data
 * - Packaged:   <userData>/data   (e.g. %APPDATA%/purpleteam-suite/data on Windows)
 */
export function getDataDir(): string {
  if (isPackaged()) {
    return path.join(app.getPath('userData'), 'data')
  }
  return path.join(process.cwd(), 'data')
}

/**
 * Directory where scan result JSONs are stored.
 */
export function getScansDir(): string {
  return path.join(getDataDir(), 'scans')
}

/**
 * Path to the hallucination-metrics.json file.
 */
export function getMetricsPath(): string {
  return path.join(getDataDir(), 'hallucination-metrics.json')
}

/**
 * Resolve a bundled resource file (lives alongside the app in extraResources).
 * - Dev:        <project>/<filename>
 * - Packaged:   <resourcesPath>/<filename>
 */
export function getResourcePath(filename: string): string {
  if (isPackaged()) {
    return path.join(process.resourcesPath, filename)
  }
  return path.join(process.cwd(), filename)
}

/**
 * Path to the allowed-targets.json config file.
 */
export function getAllowedTargetsPath(): string {
  return getResourcePath('allowed-targets.json')
}

/**
 * Path to the .env file containing API keys.
 */
export function getEnvPath(): string {
  if (isPackaged()) {
    return path.join(process.resourcesPath, '.env')
  }
  // In dev, .env is at the frontend project root (one level up from electron/)
  // but dotenv is called from main.ts which resolved it relative to __dirname
  // Use the existing approach from main.ts
  return path.join(process.cwd(), '.env')
}
