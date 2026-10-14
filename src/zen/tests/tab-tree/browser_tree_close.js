/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_close_parent_promotes_children() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.close-parent-behavior", "promote"]],
  });
  const grand = await addNormalTab();
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(parent, grand);
  gZenTabTree.nestTab(child, parent);

  BrowserTestUtils.removeTab(parent);
  await TestUtils.waitForCondition(() => !parent.isConnected);

  Assert.equal(
    gZenTabTree.getParent(child),
    grand,
    "child promoted to grandparent when parent closed"
  );

  await cleanupTabs(grand, child);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_close_parent_closes_subtree() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.close-parent-behavior", "close-subtree"]],
  });
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(child, parent);

  BrowserTestUtils.removeTab(parent);
  await TestUtils.waitForCondition(() => child.closing || !child.isConnected);
  ok(true, "descendants closed with the parent");

  await cleanupTabs(parent, child);
  await SpecialPowers.popPrefEnv();
});

// A parent must drop its twisty once its last child is fully gone. The closing
// child lingers in gBrowser.tabs (keeping its parent pointer) during its close
// animation, so the refresh has to ignore closing tabs — otherwise the twisty
// stays visible after the child is removed and no further reindex runs.
add_task(async function test_parent_drops_twisty_when_last_child_closes() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.close-parent-behavior", "promote"]],
  });
  const parent = await addNormalTab();
  const child = await addNormalTab();
  gZenTabTree.nestTab(child, parent);

  Assert.ok(
    parent.hasAttribute("zen-tree-parent"),
    "parent shows the twisty while it has a child"
  );

  BrowserTestUtils.removeTab(child);
  await TestUtils.waitForCondition(() => !child.isConnected);

  await TestUtils.waitForCondition(
    () => !parent.hasAttribute("zen-tree-parent"),
    "parent drops the twisty once its last child is gone"
  );
  Assert.ok(
    !parent.querySelector(".zen-tree-twisty"),
    "the twisty element is removed from the parent"
  );

  await cleanupTabs(parent);
  await SpecialPowers.popPrefEnv();
});

// close-subtree recurses the whole branch, not just direct children.
add_task(async function test_close_subtree_closes_grandchildren() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.close-parent-behavior", "close-subtree"]],
  });
  const a = await addNormalTab();
  const b = await addNormalTab();
  const c = await addNormalTab();
  gZenTabTree.nestTab(b, a);
  gZenTabTree.nestTab(c, b);

  BrowserTestUtils.removeTab(a);
  await TestUtils.waitForCondition(
    () => (b.closing || !b.isConnected) && (c.closing || !c.isConnected),
    "both the child and grandchild close with the subtree"
  );
  ok(true, "grandchild closed with the subtree");

  await cleanupTabs(a, b, c);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_close_tree_and_branches() {
  const root = await addNormalTab();
  const parent = await addNormalTab();
  const child = await addNormalTab();
  const grandchild = await gBrowser.addTab("about:blank", {
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  gZenTabTree.nestTab(parent, root);
  gZenTabTree.nestTab(child, parent);
  gZenTabTree.nestTab(grandchild, child);

  gZenTabTree.closeTree(parent, { includeSelf: false });
  await TestUtils.waitForCondition(
    () =>
      (child.closing || !child.isConnected) &&
      (grandchild.closing || !grandchild.isConnected)
  );
  ok(!parent.closing && parent.isConnected, "closing branches keeps the tab");
  ok(!gZenTabTree.getChildren(parent).length, "and leaves it childless");

  const kid = await addNormalTab();
  gZenTabTree.nestTab(kid, parent);
  gZenTabTree.closeTree(parent);
  await TestUtils.waitForCondition(
    () =>
      (parent.closing || !parent.isConnected) &&
      (kid.closing || !kid.isConnected)
  );
  ok(root.isConnected && !root.closing, "the tree's ancestors are untouched");

  await cleanupTabs(root);
});
