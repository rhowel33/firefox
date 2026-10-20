/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_PAGE =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.com"
  ) + "dummy_page.html";

// Navigating an iframe clones the top level entry, and removing the iframe
// later merges the clone with the original. The user interaction recorded on
// the original must survive the merge, otherwise going back skips the page.
add_task(async function test_removed_iframe_keeps_user_interaction() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.navigation.requireUserInteraction", true]],
  });

  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_PAGE + "?entry=0"
  );
  let browser = tab.linkedBrowser;
  let sessionHistory = browser.browsingContext.sessionHistory;

  await followLink(TEST_PAGE + "?entry=1");

  info("Adding user interaction for entry=1");
  await BrowserTestUtils.synthesizeMouse(
    "body",
    0,
    0,
    {},
    browser.browsingContext,
    true
  );

  await SpecialPowers.spawn(
    browser,
    [TEST_PAGE + "?sub_entry=0"],
    async function (url) {
      let iframe = content.document.createElement("iframe");
      iframe.id = "frame1";
      let loaded = new Promise(resolve =>
        iframe.addEventListener("load", resolve, { once: true })
      );
      iframe.src = url;
      content.document.body.appendChild(iframe);
      await loaded;
    }
  );

  await followLink(TEST_PAGE + "?sub_entry=1", "frame1");

  is(sessionHistory.count, 3, "The iframe navigation added an entry");
  ok(
    sessionHistory.getEntryAtIndex(1).hasUserInteraction,
    "The original entry has user interaction"
  );
  ok(
    !sessionHistory.getEntryAtIndex(2).hasUserInteraction,
    "The entry added by the iframe navigation has no user interaction"
  );

  await SpecialPowers.spawn(browser, [], function () {
    content.document.getElementById("frame1").remove();
  });
  await TestUtils.waitForCondition(
    () => sessionHistory.count == 2,
    "Waiting for the duplicate entry to be removed"
  );

  ok(
    sessionHistory.getEntryAtIndex(1).hasUserInteraction,
    "The merged entry kept the user interaction"
  );

  await followLink(TEST_PAGE + "?entry=2");

  assertBackForwardState(true, false);
  await goBack(TEST_PAGE + "?entry=1");

  BrowserTestUtils.removeTab(tab);
});
