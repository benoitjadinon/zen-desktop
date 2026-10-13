// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/* eslint-disable consistent-return */

import { ZenLittleArc } from "resource:///modules/zen/littlearc/ZenLittleArc.sys.mjs";

export class ZenGlanceParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    switch (message.name) {
      case "ZenGlance:OpenGlance": {
        this.openGlance(this.browsingContext.topChromeWindow, message.data);
        break;
      }
      case "ZenGlance:CloseGlance": {
        // Explicitly allowlist fields from content; never forward
        // skipPermitUnload or other privileged flags.
        const { noAnimation, setNewID, hasFocused } = message.data ?? {};
        this.browsingContext.topChromeWindow.gZenGlanceManager.closeGlance({
          onTabClose: true,
          noAnimation: !!noAnimation,
          setNewID: typeof setNewID === "string" ? setNewID : null,
          hasFocused: !!hasFocused,
        });
        break;
      }
      case "ZenGlance:OpenLittleArc": {
        this.openLittleArc(this.browsingContext.topChromeWindow, message.data);
        break;
      }
      case "ZenGlance:RecordLinkClickData": {
        this.browsingContext.topChromeWindow.gZenGlanceManager.lastLinkClickData =
          message.data;
        break;
      }
      default:
        console.warn(`[glance]: Unknown message: ${message.name}`);
    }
  }

  openLittleArc(window, { url, triggeringPrincipal }) {
    let uri;
    try {
      uri = Services.io.newURI(url);
    } catch (e) {
      return;
    }
    if (ZenLittleArc.shouldHandle(uri, window)) {
      ZenLittleArc.open(uri.spec, {
        openerWindow: window,
        triggeringPrincipal,
        userContextId: this.browsingContext.originAttributes.userContextId,
      });
    } else {
      window.openLinkIn(uri.spec, "current", { triggeringPrincipal });
    }
  }

  openGlance(window, data) {
    return window.gZenGlanceManager.openGlance(data);
  }
}
