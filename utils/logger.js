/* utils/logger.js
 *
 * Logger class with extension name prefix.
 * Uses console.* methods as recommended for GNOME Shell.
 *
 * Adheres to "minimal logging" by default (INFO level).
 * Automatically switches to DEBUG level if SHELL_DEBUG env var is set.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GLib from "gi://GLib";

// --- Log Level Setup ---
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

/**
 * Check for SHELL_DEBUG environment variable.
 * This is the standard way to enable debug logging in GNOME Shell.
 */
function _getLogLevel() {
  const debugMode = !!GLib.getenv("SHELL_DEBUG");
  return debugMode ? LogLevel.DEBUG : LogLevel.INFO;
}

const currentLogLevel = _getLogLevel();

// --- Prefix Setup ---
// Module-level variable to cache the prefix.
let _prefix = null;

/**
 * Gets or initializes the log prefix.
 * @param {object | null} metadata - The extension metadata object.
 */
function _getPrefix(metadata = null) {
  // 1. If cache exists, return it.
  if (_prefix) {
    return _prefix;
  }

  // 2. If no cache, try to initialize it from metadata.
  if (metadata) {
    try {
      _prefix = `[${metadata.name}]`;
      return _prefix;
    } catch (e) {
      console.error("Failed to get extension metadata for logger", e);
      _prefix = "[UNKNOWN EXTENSION]";
      return _prefix;
    }
  }

  // 3. Failsafe if logger is called without initialization
  return "[UNINITIALIZED LOGGER]";
}

export class Logger {
  /**
   * @param {object} metadata - The extension's metadata object.
   */
  constructor(metadata) {
    // Initialize the prefix cache when the logger is created.
    _getPrefix(metadata);
  }

  /**
   * Logs debug messages.
   * Only shown if SHELL_DEBUG is set.
   * Uses console.log() to ensure visibility in default journalctl.
   * @param {string} message The log message
   * @param  {...any} data Optional data to log
   */
  debug(message, ...data) {
    if (currentLogLevel < LogLevel.DEBUG) {
      return;
    }
    if (data.length > 0) {
      // Use console.log for DEBUG level
      console.log(`${_getPrefix()}: (DEBUG) ${message}`, ...data);
    } else {
      console.log(`${_getPrefix()}: (DEBUG) ${message}`);
    }
  }

  /**
   * Logs info messages.
   * Uses console.log() to ensure visibility in default journalctl.
   * @param {string} message The log message
   */
  info(message) {
    if (currentLogLevel < LogLevel.INFO) {
      return;
    }
    // Use console.log for INFO level
    console.log(`${_getPrefix()}: (INFO) ${message}`);
  }

  /**
   * Logs warnings.
   * @param {string} message The log message
   */
  warn(message) {
    if (currentLogLevel < LogLevel.WARN) {
      return;
    }
    console.warn(`${_getPrefix()}: (WARN) ${message}`);
  }

  /**
   * Logs critical errors.
   * @param {string} message The log message
   * @param {Error | null | undefined} [errorObject] Optional error
   */
  error(message, errorObject = null) {
    if (currentLogLevel < LogLevel.ERROR) {
      return;
    }

    const errorMessage = errorObject
      ? `${message} | Error: ${errorObject.message || errorObject}`
      : message;
    console.error(`${_getPrefix()}: (ERROR) ${errorMessage}`);

    // Optionally log the stack if available
    if (errorObject?.stack) {
      console.error(errorObject.stack);
    }
  }
}
