// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Reports the modifier keys held while the user activates something in a page,
 * so the tab tree can tell "open this link as a child" (plain click) from
 * "open it at the opener's level" (modifier held). The parent process only
 * learns about a link-opened tab after the fact, by which time the keys are
 * long gone.
 */
export class ZenTabTreeLinkChild extends JSWindowActorChild {
  handleEvent(event) {
    // Only real user input counts; scripts can dispatch synthetic clicks.
    if (!event.isTrusted) {
      return;
    }
    this.sendAsyncMessage("ZenTabTreeLink:Modifiers", {
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      button: event.button ?? 0,
    });
  }
}
