chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "listGroups") {
        chrome.tabGroups.query({}, (groups) => {
            sendResponse({ groups: groups });
        });
        return true;
    } else if (request.action === "takeSnapshot") {
        takeSnapshot(request.groupIds, request.name, sendResponse);
        return true;
    } else if (request.action === "restoreSnapshot") {
        restoreSnapshot(request.snapshotIndex, sendResponse);
        return true;
    } else if (request.action === "deleteSnapshot") {
        deleteSnapshot(request.snapshotIndex, sendResponse);
        return true;
    } else if (request.action === "renameSnapshot") {
        renameSnapshot(request.snapshotIndex, request.newName, sendResponse);
        return true;
    }
});

function takeSnapshot(groupIds, name, callback) {
    chrome.tabGroups.query({}, (allGroups) => {
      const selectedGroups = allGroups.filter(group => groupIds.includes(group.id));
      
      const snapshotPromises = selectedGroups.map(group => 
        new Promise((resolve) => {
          chrome.tabs.query({groupId: group.id}, (tabs) => {
            resolve({
              title: group.title,
              color: group.color,
              tabs: tabs.map(tab => ({ url: tab.url, title: tab.title }))
            });
          });
        })
      );
  
      Promise.all(snapshotPromises).then(groupSnapshots => {
        chrome.storage.local.get(['snapshots'], (result) => {
          const snapshots = result.snapshots || [];
          snapshots.push({name: name, groups: groupSnapshots});
          chrome.storage.local.set({snapshots: snapshots}, callback);
        });
      });
    });
  }

function restoreSnapshot(snapshotIndex, callback) {
    chrome.storage.local.get(['snapshots'], (result) => {
        const snapshots = result.snapshots || [];
        const snapshot = snapshots[snapshotIndex];

        if (!snapshot) {
            callback({ error: "Snapshot not found" });
            return;
        }

        chrome.windows.getCurrent({ populate: true }, (currentWindow) => {
            // Get all existing groups
            chrome.tabGroups.query({ windowId: currentWindow.id }, (existingGroups) => {
                // Create a set of tab IDs to close (tabs in existing groups)
                const tabIdsToClose = [];
                const groupsToClose = existingGroups.filter(existingGroup =>
                    snapshot.groups.some(group => group.title === existingGroup.title));

                const tabIdsToClosePromises = groupsToClose.map(group => {
                    return new Promise((resolve) => {
                        chrome.tabs.query({ groupId: group.id }, (tabs) => {
                            tabs.forEach(tab => tabIdsToClose.push(tab.id));
                            resolve();
                        });
                    });
                });

                // Close tabs in existing groups
                Promise.all(tabIdsToClosePromises).then(() => {
                    chrome.tabs.remove(tabIdsToClose, () => {
                        // Create new tabs for the snapshot
                        const createTabPromises = snapshot.groups.flatMap(group =>
                            group.tabs.map(tabInfo =>
                                new Promise((resolve) => {
                                    chrome.tabs.create({ windowId: currentWindow.id, url: tabInfo.url }, (tab) => {
                                        resolve(tab.id);
                                    });
                                })
                            )
                        );

                        Promise.all(createTabPromises).then(newTabIds => {
                            // Group the new tabs
                            let currentIndex = 0;
                            snapshot.groups.forEach(group => {
                                const groupSize = group.tabs.length;
                                const groupTabIds = newTabIds.slice(currentIndex, currentIndex + groupSize);
                                chrome.tabs.group({ tabIds: groupTabIds }, (groupId) => {
                                    chrome.tabGroups.update(groupId, { title: group.title, color: group.color });
                                });
                                currentIndex += groupSize;
                            });

                            callback({ success: true });
                        });
                    });
                });
            });
        });
    });
}

function deleteSnapshot(snapshotIndex, callback) {
    chrome.storage.local.get(['snapshots'], (result) => {
        let snapshots = result.snapshots || [];
        if (snapshotIndex >= 0 && snapshotIndex < snapshots.length) {
            snapshots.splice(snapshotIndex, 1);
            chrome.storage.local.set({ snapshots: snapshots }, () => {
                callback({ success: true });
            });
        } else {
            callback({ error: "Invalid snapshot index" });
        }
    });
}

function renameSnapshot(snapshotIndex, newName, callback) {
    chrome.storage.local.get(['snapshots'], (result) => {
        let snapshots = result.snapshots || [];
        if (snapshotIndex >= 0 && snapshotIndex < snapshots.length) {
            snapshots[snapshotIndex].name = newName;
            chrome.storage.local.set({ snapshots: snapshots }, () => {
                callback({ success: true });
            });
        } else {
            callback({ error: "Invalid snapshot index" });
        }
    });
}