// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenTabTreeLinkParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name !== "ZenTabTreeLink:Modifiers") {
      return;
    }
    const browser = this.browsingContext.top.embedderElement;
    const tree = browser?.ownerGlobal?.gZenTabTree;
    if (!tree) {
      return;
    }
    const { ctrlKey, shiftKey, altKey, metaKey, button } = message.data ?? {};
    tree.recordLinkModifiers(browser, {
      ctrlKey: !!ctrlKey,
      shiftKey: !!shiftKey,
      altKey: !!altKey,
      metaKey: !!metaKey,
      button: Number(button) || 0,
    });
  }
}
