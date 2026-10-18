/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_getContextIdIfNeeded_no_container_and_inherited() {
  await gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.force-container-workspace", true]],
  });

  const originalCache = gZenWorkspaces._workspaceCache;
  const originalActive = gZenWorkspaces.activeWorkspace;

  gZenWorkspaces._workspaceCache = [
    { uuid: "ws-main", name: "Space", containerTabId: 1 },
    { uuid: "ws-ai", name: "AI", containerTabId: 0 },
    { uuid: "ws-trading", name: "Trading", containerTabId: 6 },
  ];
  gZenWorkspaces.activeWorkspace = "ws-main";

  try {
    Assert.deepEqual(
      gZenWorkspaces.getContextIdIfNeeded(0, false, null, false),
      [0, false, undefined],
      "userContextId 0 (no container) never forces a switch to the containerTabId 0 space"
    );

    Assert.deepEqual(
      gZenWorkspaces.getContextIdIfNeeded(0, false, null, true),
      [0, false, undefined],
      "A link clicked inside a userContextId 0 tab stays in the current space"
    );

    Assert.deepEqual(
      gZenWorkspaces.getContextIdIfNeeded(6, false, null, true),
      [6, false, undefined],
      "A link inheriting its opener tab's container stays in the current space"
    );

    Assert.deepEqual(
      gZenWorkspaces.getContextIdIfNeeded(6, false, null, false),
      [6, true, "ws-trading"],
      "Explicitly opening a container tab still switches to that container's space"
    );

    Assert.deepEqual(
      gZenWorkspaces.getContextIdIfNeeded(NaN, false, null, false),
      [1, true, undefined],
      "NaN userContextId falls back to the active space's default container"
    );
  } finally {
    gZenWorkspaces._workspaceCache = originalCache;
    gZenWorkspaces.activeWorkspace = originalActive;
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_target_blank_link_stays_in_active_space() {
  await gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.force-container-workspace", true]],
  });

  const initialWorkspace = gZenWorkspaces.getActiveWorkspace();
  let mainWorkspace;
  let aiWorkspace;
  let openerTab;
  let openedTab;

  try {
    mainWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
      "Main Space",
      undefined,
      false,
      1
    );
    aiWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
      "AI Space",
      undefined,
      false,
      0
    );

    // Ensure no other workspace has containerTabId === 0 so AI Space is the
    // sole no-container workspace.
    const savedInitialContainer = initialWorkspace.containerTabId;
    initialWorkspace.containerTabId = 1;

    try {
      await gZenWorkspaces.changeWorkspace(mainWorkspace);

      openerTab = BrowserTestUtils.addTab(
        gBrowser,
        "https://example.com/",
        {
          userContextId: 0,
          skipAnimation: true,
        }
      );
      gBrowser.selectedTab = openerTab;
      await BrowserTestUtils.browserLoaded(openerTab.linkedBrowser);

      const newTabPromise = BrowserTestUtils.waitForNewTab(
        gBrowser,
        "https://example.org/",
        true
      );

      await SpecialPowers.spawn(openerTab.linkedBrowser, [], () => {
        const a = content.document.createElement("a");
        a.href = "https://example.org/";
        a.target = "_blank";
        a.textContent = "external link";
        content.document.body.appendChild(a);
        a.click();
      });

      openedTab = await newTabPromise;

      Assert.equal(
        gZenWorkspaces.activeWorkspace,
        mainWorkspace.uuid,
        "Clicking a target=_blank link inside a no-container tab keeps the current space active"
      );
      Assert.equal(
        openedTab.getAttribute("zen-workspace-id"),
        mainWorkspace.uuid,
        "The new tab opens in the active space, not in the no-container AI space"
      );
    } finally {
      initialWorkspace.containerTabId = savedInitialContainer;
    }
  } finally {
    if (openedTab) {
      BrowserTestUtils.removeTab(openedTab);
    }
    if (openerTab) {
      BrowserTestUtils.removeTab(openerTab);
    }
    await gZenWorkspaces.changeWorkspace(initialWorkspace);
    if (mainWorkspace) {
      await gZenWorkspaces.removeWorkspace(mainWorkspace.uuid);
    }
    if (aiWorkspace) {
      await gZenWorkspaces.removeWorkspace(aiWorkspace.uuid);
    }
    await SpecialPowers.popPrefEnv();
  }
});
