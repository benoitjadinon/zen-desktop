/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenLittleArc } = ChromeUtils.importESModule(
  "resource:///modules/zen/littlearc/ZenLittleArc.sys.mjs"
);

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.little-arc.enabled", true],
      ["zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed", false],
    ],
  });
});

add_task(async function test_promote_little_arc_preserves_container_and_workspace() {
  const initialTabsCount = gBrowser.tabs.length;
  const activeWorkspace = gZenWorkspaces.getActiveWorkspace();
  ok(activeWorkspace, "There is an active workspace");

  // Open a Little Arc window with default container (userContextId 0)
  const littleWin = ZenLittleArc.open("https://example.com/source", {
    openerWindow: window,
    userContextId: 0,
    fromExternal: true,
  });

  await BrowserTestUtils.waitForEvent(littleWin, "load");
  await BrowserTestUtils.browserLoaded(littleWin.gBrowser.selectedBrowser);

  const sourceTab = littleWin.gBrowser.selectedTab;
  is(sourceTab.userContextId, 0, "Little Arc tab is in default container (userContextId 0)");
  ok(!sourceTab.hasAttribute("usercontextid"), "Default container has no usercontextid attribute");

  // Promote the Little Arc tab to the main window
  const targetWin = await ZenLittleArc.promote(littleWin);
  is(targetWin, window, "Promoted into the main window");

  const adoptedTab = gBrowser.selectedTab;
  ok(adoptedTab, "Adopted tab exists and is selected");

  // Verify container is preserved
  is(adoptedTab.userContextId, 0, "Promoted tab preserved default container (userContextId 0)");
  ok(!adoptedTab.hasAttribute("usercontextid"), "Promoted tab has no usercontextid attribute");

  // Verify DOM placement inside active workspace container
  const wsElement = gZenWorkspaces.activeWorkspaceElement;
  ok(
    wsElement?.tabsContainer?.contains(adoptedTab),
    "Promoted tab is inside the active workspace's tabsContainer"
  );

  // Verify selection and docshell activation
  is(gBrowser.selectedTab, adoptedTab, "Promoted tab is the selected tab");
  ok(adoptedTab.linkedBrowser.docShellIsActive, "Promoted tab's docshell is active");

  // Verify the tab is included in gBrowser.tabs
  ok(gBrowser.tabs.includes(adoptedTab), "Promoted tab is included in gBrowser.tabs");

  // Clean up
  await BrowserTestUtils.removeTab(adoptedTab);
  is(gBrowser.tabs.length, initialTabsCount, "Tab count restored to initial count");
});
