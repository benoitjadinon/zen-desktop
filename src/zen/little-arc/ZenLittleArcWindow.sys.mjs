// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenLittleArc: "resource:///modules/zen/littlearc/ZenLittleArc.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "closeOnBlur",
  "zen.little-arc.close-on-blur",
  true,
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "closeDelay",
  "zen.little-arc.close-delay",
  800
);

/**
 * Per-window part of the little arc. It does nothing in regular windows. In a
 * little window it adds the minimal chrome (close and maximize buttons) and
 * closes the window as soon as it loses focus.
 */
export class ZenLittleArcWindow extends ZenUIComponent {
  #pointerSeen = false;
  #leaving = false;
  #blurTimer = null;
  #title = null;

  init() {
    if (!lazy.ZenLittleArc.isLittleWindow(this.window)) {
      return;
    }
    this.#buildChrome();
    this.listenBrowserTabsProgress();
    this.addEventListener("activate");
    this.addEventListener("deactivate");
    this.addEventListener("TabAttrModified");
    this.addEventListener("keydown");
    this.addEventListener("mouseover", { capture: true });
    this.addEventListener("mousemove", { capture: true });
    this.window.focus();
  }

  uninit() {
    this.window.clearTimeout(this.#blurTimer);
  }

  #buildChrome() {
    const bar = this.window.MozXULElement.parseXULToFragment(`
      <hbox id="zen-little-arc-bar" align="center">
        <toolbarbutton id="zen-little-arc-close"
                       class="zen-little-arc-button"
                       data-l10n-id="zen-little-arc-close"/>
        <label id="zen-little-arc-title" flex="1" crop="end"/>
        <toolbarbutton id="zen-little-arc-maximize"
                       class="zen-little-arc-button"
                       data-l10n-id="zen-little-arc-maximize"/>
      </hbox>
    `).firstElementChild;
    bar
      .querySelector("#zen-little-arc-close")
      .addEventListener("command", () => this.close());
    bar
      .querySelector("#zen-little-arc-maximize")
      .addEventListener("command", () => this.maximize());
    this.#title = bar.querySelector("#zen-little-arc-title");
    this.document.getElementById("zen-main-app-wrapper").prepend(bar);
  }

  #updateTitle() {
    const browser = this.window.gBrowser.selectedBrowser;
    let host = "";
    try {
      host = browser.currentURI.host.replace(/^www\./, "");
    } catch (e) {
      host = browser.currentURI?.spec ?? "";
    }
    this.#title.value = host;
    this.#title.tooltipText = browser.currentURI?.spec ?? "";
  }

  close() {
    this.#leaving = true;
    this.window.BrowserCommands.tryToCloseWindow();
    // The page may have vetoed the close, in which case we stay.
    this.#leaving = false;
  }

  async maximize() {
    if (this.#leaving) {
      return;
    }
    this.#leaving = true;
    const target = await lazy.ZenLittleArc.promote(this.window);
    if (!target) {
      this.#leaving = false;
      return;
    }
    // The tab has been moved out, which normally closes this window by itself.
    if (!this.window.closed) {
      this.window.close();
    }
  }

  onLocationChange(aBrowser, aWebProgress) {
    if (
      aWebProgress.isTopLevel &&
      aBrowser == this.window.gBrowser.selectedBrowser
    ) {
      this.#updateTitle();
    }
  }

  on_TabAttrModified() {
    this.#updateTitle();
  }

  on_keydown(event) {
    if (event.key == "Escape" && !event.defaultPrevented) {
      this.close();
    }
  }

  on_mouseover() {
    this.#pointerSeen = true;
  }

  on_mousemove() {
    this.#pointerSeen = true;
  }

  on_activate() {
    this.window.clearTimeout(this.#blurTimer);
  }

  on_deactivate() {
    // Only start closing once the pointer has been over the window, so that a
    // window the user never got to (or that was opened out of reach) stays.
    if (!this.#pointerSeen || this.#leaving || !lazy.closeOnBlur) {
      return;
    }
    this.window.clearTimeout(this.#blurTimer);
    this.#blurTimer = this.window.setTimeout(
      () => this.#closeIfStillBlurred(),
      lazy.closeDelay,
    );
  }

  #closeIfStillBlurred() {
    const win = this.window;
    if (win.closed || this.#leaving) {
      return;
    }
    const active = Services.focus.activeWindow;
    if (
      active == win ||
      active?.opener == win ||
      win.windowUtils.isInModalState() ||
      win.document.querySelector("panel[panelopen], menupopup[state='open']")
    ) {
      return;
    }
    this.close();
  }
}
