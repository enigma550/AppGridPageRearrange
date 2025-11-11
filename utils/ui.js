/* utils/ui.js
 *
 * UI creator for the extension.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import St from "gi://St";

/**
 * Creates a PopupBaseMenuItem containing a horizontally arranged box
 * with an array of buttons (acting as a unified menu item row).
 *
 * @param {Array<Object>} configs - Array of button configs { label, action }
 * @param {PopupMenu.PopupMenu} menu - The menu to close on click
 * @returns {PopupMenu.PopupBaseMenuItem} - The menu item containing the button row
 */
export function createHorizontalButtonRow(configs, menu) {
  let baseItem = new PopupMenu.PopupBaseMenuItem({
    activate: false,
    hover: false,
    reactive: false,
  });

  let box = new St.BoxLayout({
    x_expand: true,
    style_class: "popup-menu-item-button-box",
    reactive: false,
  });

  let createButton = (config) => {
    let button = new St.Button({
      label: config.label,
      can_focus: true,
      x_expand: true,
      style_class: "button icon-button menu-action-button",
    });
    button.connect("clicked", () => {
      menu.close();
      config.action();
    });
    return button;
  };

  if (!configs) {
    configs = [];
  }
  configs.forEach((config) => {
    box.add_child(createButton(config));
  });

  baseItem.actor.add_child(box);
  baseItem.actor.reactive = false;

  return baseItem;
}
