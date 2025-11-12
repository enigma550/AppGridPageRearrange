/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import St from "gi://St";
import GLib from "gi://GLib";
import { PageMover } from "./utils/pageMover.js";
import { createHorizontalButtonRow } from "./utils/ui.js";

export default class AppGridPageRearrangeExtension extends Extension {
  constructor(metadata) {
    // Per GNOME guidelines, the constructor should ONLY call super
    // and store static data (like metadata).
    // All object instantiation and signal connections must be in enable().
    super(metadata);

    // Store metadata (this is allowed by guidelines as static data)
    this._metadata = metadata;

    // All other properties are intentionally left undefined
    // and will be created in enable().
  }

  /**
   * Enables the extension, initializes menu and listeners.
   */
  enable() {
    // 1. Announce extension enabled
    this.getLogger().log("Extension enabled.");

    // 2. Instantiate all class properties
    this._pageIndicators = null;
    this._appDisplay = null;
    this._pageMover = null;
    this._rightClickSignalId = null;
    this._rightClickAppDisplaySignalId = null;

    // 3. Instantiate Menu components
    this._menuManager = new PopupMenu.PopupMenuManager(Main.overview);
    this._menu = new PopupMenu.PopupMenu(Main.overview, 0.5, St.Side.TOP);
    this._menuManager.addMenu(this._menu);
    Main.uiGroup.add_child(this._menu.actor);
    this._menu.actor.visible = false;

    // 4. Define button actions.
    const buttonConfigs = [
      { label: "First", action: () => this._pageMover?.moveToFirstPage() },
      { label: "<-", action: () => this._pageMover?.movePageLeft() },
      { label: "->", action: () => this._pageMover?.movePageRight() },
      { label: "Last", action: () => this._pageMover?.moveToLastPage() },
    ];
    let navigationRow = createHorizontalButtonRow(buttonConfigs, this._menu);
    this._menu.addMenuItem(navigationRow);

    // 5. Connect signals
    this._overviewShowSignalId = Main.overview.connect("showing", () =>
      this._onOverviewShown(),
    );
    this._overviewHideSignalId = Main.overview.connect("hiding", () =>
      this._onOverviewHidden(),
    );
  }

  /**
   * Attempts to find the AppDisplay component upon overview shown.
   */
  _onOverviewShown() {
    if (this._appDisplay) {
      return;
    }

    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      let appDisplay = null;
      const controls = Main.overview._overview?._controls;

      if (controls) {
        appDisplay = controls._appDisplay;
      }

      if (!appDisplay) {
        appDisplay =
          Main.overview.controls?.appDisplay || Main.overview.dash?.appDisplay;
      }

      if (appDisplay) {
        this._appDisplay = appDisplay;
        // 6. Instantiate PageMover now that we have appDisplay
        this._pageMover = new PageMover(this.getLogger(), this._appDisplay);
        this._initializeAppDisplayListeners();
      }
      return GLib.SOURCE_REMOVE;
    });
  }

  /**
   * Initializes listeners on AppDisplay and PageIndicators once found.
   */
  _initializeAppDisplayListeners() {
    this._pageIndicators =
      this._appDisplay._pageIndicators ||
      Main.overview.controls?.pageIndicators ||
      this._appDisplay;

    this._menu.sourceActor = this._pageIndicators;

    this._pageIndicators.reactive = true;
    this._appDisplay.reactive = true;

    this._rightClickSignalId = this._pageIndicators.connect(
      "button-press-event",
      (actor, event) => {
        if (event.get_button() === 3) {
          this._menu.open(true);
          return true;
        }
        return false;
      },
    );

    this._rightClickAppDisplaySignalId = this._appDisplay.connect(
      "button-press-event",
      (actor, event) => {
        if (
          this._menu.isOpen &&
          (event.get_button() === 1 || event.get_button() === 3)
        ) {
          this._menu.close();
          return true;
        }
        return false;
      },
    );
  }

  /**
   * Cleans up listeners when overview is hidden.
   */
  _onOverviewHidden() {
    // Use optional chaining (?.) in case overview is hidden
    // before _appDisplay was ever found.
    this._menu?.close();

    if (!this._appDisplay) {
      return;
    }

    if (this._rightClickSignalId && this._pageIndicators) {
      this._pageIndicators.disconnect(this._rightClickSignalId);
    }
    if (this._rightClickAppDisplaySignalId && this._appDisplay) {
      this._appDisplay.disconnect(this._rightClickAppDisplaySignalId);
    }

    // Clean up PageMover
    this._pageMover?.destroy();
    this._pageMover = null;

    this._pageIndicators = null;
    this._appDisplay = null;
    this._rightClickSignalId = null;
    this._rightClickAppDisplaySignalId = null;
  }

  /**
   * Disables the extension and clears global references.
   */
  disable() {
    this.getLogger().log("Extension disabled.");

    // Disconnect signals
    if (this._overviewShowSignalId) {
      Main.overview.disconnect(this._overviewShowSignalId);
      this._overviewShowSignalId = null;
    }
    if (this._overviewHideSignalId) {
      Main.overview.disconnect(this._overviewHideSignalId);
      this._overviewHideSignalId = null;
    }

    // Clean up all objects
    this._onOverviewHidden();

    // Destroy menu
    this._menu?.destroy();
    this._menu = null;
    this._menuManager = null; // No destroy() method exists in PopupMenu.PopupMenuManager class, just null it.
  }
}
