/* utils/pageMover.js
 *
 * Handles the core logic of modifying GSettings and syncing the UI
 * to move application grid pages.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GLib from "gi://GLib";

export class PageMover {
  constructor(logger, appDisplay) {
    this._logger = logger;
    this._appDisplay = appDisplay;
    this._pageManager = appDisplay._pageManager;

    this._isMoving = false;
    this._targetPageIndex = null;
    this._rearrangedSignalId = null;
  }

  /**
   * Disconnects any active signal listeners.
   * Called when the extension is disabled or the overview is hidden.
   */
  destroy() {
    if (this._rearrangedSignalId && this._appDisplay) {
      try {
        this._appDisplay.disconnect(this._rearrangedSignalId);
      } catch (e) {
        // Suppress errors if object is already gone
      }
    }
    this._rearrangedSignalId = null;
    this._isMoving = false;
    this._targetPageIndex = null;
  }

  /**
   * Helper to ensure position values are GVariants before saving.
   * This is necessary because the PageManager.pages (setter)
   * expects GVariant values.
   */
  _normalizePages(pages) {
    pages.forEach((pageData) => {
      for (const appId in pageData) {
        const properties = pageData[appId];
        const positionValue = properties.position;

        if (typeof positionValue === "number") {
          properties.position = new GLib.Variant("i", positionValue);
        }
      }
    });
  }

  /**
   * Executes the stable page move logic.
   * @param {number} currentPageIndex - The page to move.
   * @param {number} newPageIndex - The target index for the page.
   */
  _executeSingleMove(currentPageIndex, newPageIndex) {
    if (!this._appDisplay || this._isMoving) {
      this._logger.debug("Move already in progress, aborting.");
      return;
    }

    this._logger.debug(
      `Move requested: ${currentPageIndex} -> ${newPageIndex}`,
    );

    this._isMoving = true;
    this._targetPageIndex = newPageIndex;

    // 1. Listen for the 'view-loaded' signal on the AppDisplay.
    // This fires once _redisplay() is complete.
    this._rearrangedSignalId = this._appDisplay.connect("view-loaded", () => {
      // Check if we are still waiting
      if (this._targetPageIndex === null || !this._appDisplay) {
        this._logger.warn(
          "'view-loaded' received, but state is already cleared.",
        );
        if (this._rearrangedSignalId && this._appDisplay) {
          this._appDisplay.disconnect(this._rearrangedSignalId);
          this._rearrangedSignalId = null;
        }
        return;
      }

      this._logger.debug(
        `'view-loaded' received. Disconnecting listener and queueing navigation to ${this._targetPageIndex}.`,
      );

      // Disconnect immediately to avoid double signals
      if (this._rearrangedSignalId && this._appDisplay) {
        this._appDisplay.disconnect(this._rearrangedSignalId);
        this._rearrangedSignalId = null;
      }

      // Queue the navigation to run as soon as the UI thread is idle
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        if (!this._appDisplay || this._targetPageIndex === null) {
          this._logger.warn("State changed before idle navigation could run.");
          this._isMoving = false;
          return GLib.SOURCE_REMOVE;
        }

        try {
          this._logger.debug(`Idle: Navigating to ${this._targetPageIndex}`);
          // Call the high-level goToPage function to sync grid AND arrows
          this._appDisplay.goToPage(this._targetPageIndex, false);
        } catch (e) {
          this._logger.error("Error during idle navigation/sync", e);
        } finally {
          this._logger.debug("Idle: Cleaning up state.");
          this._targetPageIndex = null;
          this._isMoving = false; // Release lock
        }

        return GLib.SOURCE_REMOVE; // Stop
      });
    });

    // 2. Perform the data manipulation
    try {
      // Get the JS array (getter unpacks it)
      let pagesJS = this._pageManager.pages;

      // Perform logic on the JS array
      const pageToMove = pagesJS.splice(currentPageIndex, 1)[0];
      pagesJS.splice(newPageIndex, 0, pageToMove);

      // Normalize numbers back to GVariants
      this._normalizePages(pagesJS);

      // Save the JS array (setter packs it)
      this._pageManager.pages = pagesJS;
      this._logger.debug(
        "GSettings save successful. Manually triggering redisplay.",
      );

      // 3. Force _redisplay(), which will fire 'view-loaded'.
      this._appDisplay._redisplay();
    } catch (e) {
      this._logger.error("GSettings save/redisplay failed (runtime error)", e);
      // Reset EVERYTHING if GSettings fails
      if (this._rearrangedSignalId && this._appDisplay) {
        this._appDisplay.disconnect(this._rearrangedSignalId);
        this._rearrangedSignalId = null;
      }
      this._targetPageIndex = null;
      this._isMoving = false; // Release lock
    }
  }

  // --- PUBLIC API ---

  movePageLeft() {
    if (!this._appDisplay) return;
    let grid = this._appDisplay._grid;
    let currentPageIndex = grid.currentPage;

    if (currentPageIndex > 0) {
      this._executeSingleMove(currentPageIndex, currentPageIndex - 1);
    }
  }

  movePageRight() {
    if (!this._appDisplay) return;
    let grid = this._appDisplay._grid;
    let currentPageIndex = grid.currentPage;
    let numPages = grid.nPages;

    if (currentPageIndex < numPages - 1) {
      this._executeSingleMove(currentPageIndex, currentPageIndex + 1);
    }
  }

  moveToFirstPage() {
    if (!this._appDisplay) return;
    let grid = this._appDisplay._grid;
    let currentPageIndex = grid.currentPage;

    if (currentPageIndex > 0) {
      const targetIndex = 0;
      this._executeSingleMove(currentPageIndex, targetIndex);
    }
  }

  moveToLastPage() {
    if (!this._appDisplay) return;
    let grid = this._appDisplay._grid;
    let currentPageIndex = grid.currentPage;
    let numPages = grid.nPages;
    let lastIndex = numPages - 1;

    if (currentPageIndex < lastIndex) {
      this._executeSingleMove(currentPageIndex, lastIndex);
    }
  }
}
