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
    } else if (request.action === "restoreOpenFromSnapshot") {
        restoreOpenFromSnapshot(request.snapshotIndex, sendResponse);
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
                chrome.tabs.query({ groupId: group.id }, (tabs) => {
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
                snapshots.push({ name: name, groups: groupSnapshots });
                chrome.storage.local.set({ snapshots: snapshots }, callback);
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
            chrome.tabGroups.query({ windowId: currentWindow.id }, (existingGroups) => {
                const groupsToClose = getGroupsToClose(existingGroups, snapshot);

                createTabsForSnapshot(snapshot, currentWindow, () => {
                    closeTabsInGroups(groupsToClose, callback);
                });
            });
        });
    });
}

function getGroupsToClose(existingGroups, snapshot) {
    return existingGroups.filter(existingGroup =>
        snapshot.groups.some(group => group.title === existingGroup.title));
}

function closeTabsInGroups(groupsToClose, callback) {
    const tabIdsToClose = [];
    const tabIdsToClosePromises = groupsToClose.map(group =>
        new Promise((resolve) => {
            chrome.tabs.query({ groupId: group.id }, (tabs) => {
                tabs.forEach(tab => tabIdsToClose.push(tab.id));
                resolve();
            });
        })
    );

    Promise.all(tabIdsToClosePromises).then(() => {
        chrome.tabs.remove(tabIdsToClose, callback({ success: true }));
    });
}

function createTabsForSnapshot(snapshot, currentWindow, callback) {
    const createTabPromises = snapshot.groups.flatMap(group =>
        createTabsForSnapshotGroup(group, currentWindow)
    );

    Promise.all(createTabPromises).then(newTabIds => {
        groupNewTabs(snapshot, newTabIds);
        callback({ success: true });
    });
}

function createTabsForSnapshotGroup(group, currentWindow) {
    return group.tabs.map(tabInfo => new Promise((resolve) => {
        chrome.tabs.create({ windowId: currentWindow.id, url: tabInfo.url }, (tab) => {
            resolve(tab.id);
        });
    })
    );
}

function groupNewTabs(snapshot, newTabIds) {
    let currentIndex = 0;
    snapshot.groups.forEach(group => {
        const groupSize = group.tabs.length;
        const groupTabIds = newTabIds.slice(currentIndex, currentIndex + groupSize);
        addTabsToGroup(groupTabIds, group);
        currentIndex += groupSize;
    });
}

function addTabsToGroup(tabIds, group, callback) {
    chrome.tabs.group({ tabIds: tabIds, groupId: group.id }, (groupId) => {
        chrome.tabGroups.update(groupId, { title: group.title, color: group.color }, callback);
    });
}

function restoreOpenFromSnapshot(snapshotIndex, callback) {
    chrome.storage.local.get(['snapshots'], (result) => {
        const snapshots = result.snapshots || [];
        const snapshot = snapshots[snapshotIndex];

        if (!snapshot) {
            callback({ error: "Snapshot not found" });
            return;
        }

        chrome.windows.getCurrent({ populate: true }, (currentWindow) => {
            chrome.tabGroups.query({ windowId: currentWindow.id }, (existingGroups) => {
                const existingGroupsToRestore = getMatchingOpenGroups(existingGroups, snapshot);
                restoreGroups(existingGroupsToRestore, snapshot, currentWindow, callback);
            });
        });
    });
}

function getMatchingOpenGroups(existingGroups, snapshot) {
    return existingGroups.filter(existingGroup =>
        snapshot.groups.find(snapshotGroup =>
            snapshotGroup.title === existingGroup.title
            && snapshotGroup.color === existingGroup.color))
}

function restoreGroups(existingGroupsToRestore, snapshot, currentWindow, callback) {
    const tabRestorePromises = [];
    existingGroupsToRestore.forEach(existingGroup => {
        const tabRestorePromise = chrome.tabs.query({ groupId: existingGroup.id }, (tabsToClose) => {
            const snapshotGroup = snapshot.groups.filter(g => g.title === existingGroup.title && g.color === existingGroup.color)[0];

            Promise.all(createTabsForSnapshotGroup(snapshotGroup, currentWindow)).then(newTabIds => {
                addTabsToGroup(newTabIds, existingGroup, () => {
                    chrome.tabs.remove(tabsToClose.map(tab => tab.id));
                });
            });
        });

        tabRestorePromises.push(tabRestorePromise);
    });

    Promise.all(tabRestorePromises).then(() => callback({ success: true }));
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