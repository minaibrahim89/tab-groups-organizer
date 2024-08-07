let selectedGroups = new Set();

function updateGroupList() {
  chrome.runtime.sendMessage({ action: "listGroups" }, (response) => {
    const groupList = document.getElementById('groupList');
    groupList.innerHTML = '<h3>Current Tab Groups:</h3>';

    response.groups.forEach(group => {
      const groupDiv = createGroupDiv(group);
      groupList.appendChild(groupDiv);
    });
  });
}

function createGroupDiv(group) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'group-item';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = group.id;
  checkbox.checked = selectedGroups.has(group.id);
  checkbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      selectedGroups.add(group.id);
    } else {
      selectedGroups.delete(group.id);
    }

    getTakeSnapshotButton().disabled = !anyGroupCheckBoxChecked();
  });

  groupDiv.appendChild(checkbox);
  groupDiv.appendChild(document.createTextNode(` ${group.title} (${group.color})`));

  return groupDiv;
}

function anyGroupCheckBoxChecked() {
  const allCheckBoxes = Array.from(document.querySelectorAll('div.group-item > input[type=checkbox]'));

  return allCheckBoxes.some(chk => chk.checked);
}

function updateSnapshotList() {
  chrome.storage.local.get(['snapshots'], (result) => {
    const snapshots = result.snapshots || [];
    const snapshotList = document.getElementById('snapshotList');
    snapshotList.innerHTML = '<h3>Saved Snapshots:</h3>';

    snapshots.forEach((snapshot, index) => {
      const snapshotDiv = createSnapshotDiv(snapshot, index);
      snapshotList.appendChild(snapshotDiv);
    });
  });
}

function createSnapshotDiv(snapshot, index) {
  const snapshotDiv = document.createElement('div');
  snapshotDiv.className = 'snapshot-item';

  const infoDiv = document.createElement('div');
  infoDiv.title = snapshot.groups.map(group => `${group.title} (${group.tabs.length} tabs)`).join('\n');

  const totalTabs = snapshot.groups.reduce((sum, group) => sum + group.tabs.length, 0);

  const nameSpan = document.createElement('span');
  nameSpan.textContent = snapshot.name || `Snapshot ${index + 1}`;
  nameSpan.className = 'snapshot-name';
  infoDiv.appendChild(nameSpan);

  infoDiv.appendChild(document.createTextNode(` (${snapshot.groups.length} groups, ${totalTabs} tabs)`));
  snapshotDiv.appendChild(infoDiv);

  const buttonsDiv = createSnapshotButtons(snapshot, index);
  snapshotDiv.appendChild(buttonsDiv);

  return snapshotDiv;
}

function createSnapshotButtons(snapshot, index) {
  const buttonsDiv = document.createElement('div');

  const renameButton = createButton('edit', 'Rename', () => {
    const newName = prompt('Enter new name for the snapshot:', snapshot.name || `Snapshot ${index + 1}`);
    if (newName !== null) {
      chrome.runtime.sendMessage({ action: "renameSnapshot", snapshotIndex: index, newName: newName }, updateSnapshotList);
    }
  });
  buttonsDiv.appendChild(renameButton);

  const restoreButton = createButton('restore', 'Restore', () => {
    chrome.runtime.sendMessage({ action: "restoreSnapshot", snapshotIndex: index });
  });
  buttonsDiv.appendChild(restoreButton);

  const restoreOpenButton = createButton('merge_type', 'Merge with open tab groups', () => {
    chrome.runtime.sendMessage({ action: "restoreOpenFromSnapshot", snapshotIndex: index });
  });
  buttonsDiv.appendChild(restoreOpenButton);

  const deleteButton = createButton('delete', 'Delete', () => {
    if (confirm('Are you sure you want to delete this snapshot?')) {
      chrome.runtime.sendMessage({ action: "deleteSnapshot", snapshotIndex: index }, updateSnapshotList);
    }
  });
  buttonsDiv.appendChild(deleteButton);

  return buttonsDiv;
}

function createButton(icon, title, onClick) {
  const button = document.createElement('button');
  button.innerHTML = `<i class="material-icons">${icon}</i>`;
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

getTakeSnapshotButton().addEventListener('click', () => {
  const snapshotName = prompt('Enter a name for this snapshot:', `Snapshot ${new Date().toLocaleString()}`);
  if (snapshotName !== null) {
    chrome.runtime.sendMessage({
      action: "takeSnapshot",
      groupIds: Array.from(selectedGroups),
      name: snapshotName
    }, () => {
      updateSnapshotList();
    });
  }
});

function getTakeSnapshotButton() {
  return document.getElementById('takeSnapshot');
}

document.addEventListener('DOMContentLoaded', () => {
  updateGroupList();
  updateSnapshotList();
});