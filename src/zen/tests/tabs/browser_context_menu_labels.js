/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_context_menu_labels() {
  const TEST_PAGE = `data:text/html,<html><body><p>Hello world</p><a id="test-link" href="https://example.com">Example link</a></body></html>`;

  await BrowserTestUtils.withNewTab(TEST_PAGE, async browser => {
    // 1. Content Area Context Menu on page background
    let contextMenu = document.getElementById("contentAreaContextMenu");
    let popupShown = BrowserTestUtils.waitForEvent(contextMenu, "popupshown");

    await BrowserTestUtils.synthesizeMouseAtCenter(
      "p",
      { type: "contextmenu", button: 2 },
      browser
    );
    await popupShown;

    let backItem = document.getElementById("context-back");
    let reloadItem = document.getElementById("context-reload");
    let bookmarkItem = document.getElementById("context-bookmarkpage");

    Assert.ok(
      backItem.getAttribute("aria-label") || backItem.getAttribute("tooltiptext") || backItem.getAttribute("label"),
      "Back item should have an accessible label or tooltip"
    );
    Assert.ok(
      reloadItem.getAttribute("aria-label") || reloadItem.getAttribute("tooltiptext") || reloadItem.getAttribute("label"),
      "Reload item should have an accessible label or tooltip"
    );
    Assert.ok(
      bookmarkItem.getAttribute("aria-label") || bookmarkItem.getAttribute("tooltiptext") || bookmarkItem.getAttribute("label"),
      "Bookmark item should have an accessible label or tooltip"
    );

    let popupHidden = BrowserTestUtils.waitForEvent(contextMenu, "popuphidden");
    contextMenu.hidePopup();
    await popupHidden;

    // 2. Content Area Context Menu on link
    popupShown = BrowserTestUtils.waitForEvent(contextMenu, "popupshown");
    await BrowserTestUtils.synthesizeMouseAtCenter(
      "#test-link",
      { type: "contextmenu", button: 2 },
      browser
    );
    await popupShown;

    let openInTabItem = document.getElementById("context-openlinkintab");
    let copyLinkItem = document.getElementById("context-copylink");
    Assert.ok(openInTabItem.label && openInTabItem.label.length > 0, "Open link in new tab has non-empty label");
    Assert.ok(copyLinkItem.label && copyLinkItem.label.length > 0, "Copy link has non-empty label");

    popupHidden = BrowserTestUtils.waitForEvent(contextMenu, "popuphidden");
    contextMenu.hidePopup();
    await popupHidden;

    // 3. Tab Context Menu
    let tabContextMenu = document.getElementById("tabContextMenu");
    popupShown = BrowserTestUtils.waitForEvent(tabContextMenu, "popupshown");

    tabContextMenu.openPopup(gBrowser.selectedTab, "end_after", 0, 0, true, false);
    await popupShown;

    let reloadTabItem = document.getElementById("context_reloadTab");
    let duplicateTabItem = document.getElementById("context_duplicateTab");
    let pinTabItem = document.getElementById("context_pinTab");
    let bookmarkTabItem = document.getElementById("context_bookmarkTab");

    await document.l10n.translateFragment(tabContextMenu);

    Assert.ok(reloadTabItem.label && reloadTabItem.label.length > 0, "Reload tab has non-empty label: " + reloadTabItem.label);
    Assert.ok(duplicateTabItem.label && duplicateTabItem.label.length > 0, "Duplicate tab has non-empty label: " + duplicateTabItem.label);
    Assert.ok(pinTabItem.label && pinTabItem.label.length > 0, "Pin tab has non-empty label: " + pinTabItem.label);
    Assert.ok(bookmarkTabItem.label && bookmarkTabItem.label.length > 0, "Bookmark tab has non-empty label: " + bookmarkTabItem.label);

    popupHidden = BrowserTestUtils.waitForEvent(tabContextMenu, "popuphidden");
    tabContextMenu.hidePopup();
    await popupHidden;
  });
});
