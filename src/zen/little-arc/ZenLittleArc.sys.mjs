// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AppConstants: "resource://gre/modules/AppConstants.sys.mjs",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  SessionStore: "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "enabled",
  "zen.little-arc.enabled",
  true,
);
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "externalLinks",
  "zen.little-arc.external-links",
  true,
);
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "width",
  "zen.little-arc.width",
  960,
);
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "height",
  "zen.little-arc.height",
  720,
);

/**
 * Opens links in a "little arc": a small, temporary browser window with
 * minimal chrome that closes when it loses focus and can be promoted to a
 * regular tab of a full browser window.
 */
export const ZenLittleArc = {
  isLittleWindow(win) {
    return !!win?.document?.documentElement?.hasAttribute("zen-little-arc");
  },

  /**
   * @param {nsIURI} uri - The URI to open
   * @param {Window} win - The browser window the link would open in
   * @param {object} [options]
   * @param {boolean} [options.external] - Whether the link comes from outside the browser
   * @returns {boolean} Whether the link should open in a little window
   */
  shouldHandle(uri, win, { external = false } = {}) {
    return (
      lazy.enabled &&
      (!external || lazy.externalLinks) &&
      !!uri &&
      (uri.schemeIs("http") || uri.schemeIs("https")) &&
      !!win?.toolbar?.visible &&
      !this.isLittleWindow(win)
    );
  },

  /**
   * @param {nsIURI} uri - The URI the browser was launched with
   * @returns {boolean} Whether it should open in a little window once the
   *   regular window is up
   */
  shouldHandleOnStartup(uri) {
    return (
      lazy.enabled &&
      lazy.externalLinks &&
      !lazy.PrivateBrowsingUtils.permanentPrivateBrowsing &&
      !!uri &&
      (uri.schemeIs("http") || uri.schemeIs("https"))
    );
  },

  /**
   * Opens a URL in a new little window.
   *
   * @param {string} spec - The URL to load
   * @param {object} options
   * @param {Window} [options.openerWindow] - The browser window the link comes from, if any
   * @param {nsIPrincipal} [options.triggeringPrincipal]
   * @param {nsIReferrerInfo} [options.referrerInfo]
   * @param {number} [options.userContextId]
   * @param {boolean} [options.fromExternal]
   * @returns {Window} The new window
   */
  open(
    spec,
    {
      openerWindow = null,
      triggeringPrincipal = null,
      referrerInfo = null,
      userContextId = 0,
      fromExternal = false,
    },
  ) {
    const isPrivate =
      !!openerWindow && lazy.PrivateBrowsingUtils.isWindowPrivate(openerWindow);
    let features = "chrome,dialog=no,popup,resizable,close";
    if (openerWindow) {
      const width = Math.min(lazy.width, openerWindow.screen.availWidth);
      const height = Math.min(lazy.height, openerWindow.screen.availHeight);
      const left = Math.round(
        openerWindow.screenX + (openerWindow.outerWidth - width) / 2,
      );
      const top = Math.round(
        openerWindow.screenY + (openerWindow.outerHeight - height) / 2,
      );
      features += `,width=${width},height=${height},left=${left},top=${top}`;
    } else {
      features += `,width=${lazy.width},height=${lazy.height},centerscreen`;
    }
    features += isPrivate ? ",private" : ",non-private";
    if (openerWindow && lazy.AppConstants.platform == "linux") {
      // Makes tiling compositors float the window above its parent.
      features += ",dependent";
    }

    const args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    const wuri = Cc["@mozilla.org/supports-string;1"].createInstance(
      Ci.nsISupportsString,
    );
    wuri.data = spec;
    const extraOptions = Cc["@mozilla.org/hash-property-bag;1"].createInstance(
      Ci.nsIWritablePropertyBag2,
    );
    extraOptions.setPropertyAsBool("zen-little-arc", true);
    extraOptions.setPropertyAsBool("fromExternal", fromExternal);
    const allowThirdPartyFixup = Cc[
      "@mozilla.org/supports-PRBool;1"
    ].createInstance(Ci.nsISupportsPRBool);
    allowThirdPartyFixup.data = false;
    const userContextIdSupports = Cc[
      "@mozilla.org/supports-PRUint32;1"
    ].createInstance(Ci.nsISupportsPRUint32);
    userContextIdSupports.data = userContextId;

    args.appendElement(wuri);
    args.appendElement(extraOptions);
    args.appendElement(referrerInfo);
    args.appendElement(null); // postData
    args.appendElement(allowThirdPartyFixup);
    args.appendElement(userContextIdSupports);
    args.appendElement(null); // originPrincipal
    args.appendElement(null); // originStoragePrincipal
    args.appendElement(
      triggeringPrincipal ??
        Services.scriptSecurityManager.getSystemPrincipal(),
    );
    args.appendElement(null); // allowInheritPrincipal
    args.appendElement(null); // policyContainer

    const win = Services.ww.openWindow(
      openerWindow,
      lazy.AppConstants.BROWSER_CHROME_URL,
      null,
      features,
      args,
    );
    win._zenStartupSyncFlag = "unsynced";
    return win;
  },

  /**
   * Promotes the page of a little window to a regular tab of a full browser
   * window, keeping its state by moving the tab rather than reloading it. If
   * no full window is open, one is started first so that the session is
   * restored around the tab.
   *
   * @param {Window} littleWindow
   * @returns {Promise<Window|null>} The window that now holds the tab
   */
  async promote(littleWindow) {
    const tab = littleWindow.gBrowser.selectedTab;
    const isPrivate = lazy.PrivateBrowsingUtils.isWindowPrivate(littleWindow);
    let target = lazy.BrowserWindowTracker.getTopWindow({
      private: isPrivate,
    });

    if (!target) {
      target = await this.openFullWindow(littleWindow, isPrivate);
    }
    const adopted =
      !littleWindow.closed &&
      target.gBrowser.adoptTab(tab, { tabIndex: Infinity, selectTab: true });
    if (!adopted) {
      return null;
    }
    // The promoted page is a standalone tab, not a child of whatever tab was
    // selected (or last) in the target window: keep it at the end, at root.
    target.gZenTabTree?.detachTab(adopted);
    target.focus();
    return target;
  },

  async openFullWindow(littleWindow, isPrivate) {
    const started = Promise.withResolvers();
    const observer = {
      observe: (subject, topic) => {
        if (subject.toolbar?.visible) {
          Services.obs.removeObserver(observer, topic);
          started.resolve(subject);
        }
      },
    };
    Services.obs.addObserver(observer, "browser-delayed-startup-finished");
    lazy.BrowserWindowTracker.openWindow({
      private: isPrivate,
      openerWindow: littleWindow,
    });
    const win = await started.promise;
    await lazy.SessionStore.promiseAllWindowsRestored;
    return win;
  },
};
