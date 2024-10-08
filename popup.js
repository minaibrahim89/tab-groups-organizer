let selectedGroups = new Set();
let selectedSnapshots = new Set();

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
  checkbox.id = group.id;
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

  const label = document.createElement('label');
  label.for = group.id;
  label.className = group.color;
  label.innerText = `${group.title}`;
  label.addEventListener('click', () => {
    groupDiv.querySelector('input[type=checkbox]').click();
  });
  groupDiv.appendChild(checkbox);
  groupDiv.appendChild(label);

  return groupDiv;
}

function anyGroupCheckBoxChecked() {
  const allCheckBoxes = Array.from(document.querySelectorAll('div.group-item > input[type=checkbox]'));

  return allCheckBoxes.some(chk => chk.checked);
}

function updateSnapshotList() {
  selectedSnapshots.clear();
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

  const totalTabs = snapshot.groups.reduce((sum, group) => sum + group.tabs.length, 0);

  const leftDiv = document.createElement('div');
  leftDiv.className = 'snapshot-item-left';
  leftDiv.title = snapshot.groups.map(group => `${group.title} (${group.tabs.length} tabs)`).join('\n');

  const checkbox = createSnapshotCheckbox(index);
  leftDiv.appendChild(checkbox);

  const infoDiv = createInfoDiv(snapshot, index, totalTabs);
  infoDiv.addEventListener('click', () => {
    checkbox.click();
  });
  leftDiv.appendChild(infoDiv);
  snapshotDiv.appendChild(leftDiv);

  const buttonsDiv = createSnapshotButtons(snapshot, index);
  snapshotDiv.appendChild(buttonsDiv);

  return snapshotDiv;
}

function createSnapshotCheckbox(index) {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = selectedSnapshots.has(index);
  checkbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      selectedSnapshots.add(index);
    } else {
      selectedSnapshots.delete(index);
    }
    getExportButton().disabled = !anySnapshotCheckBoxChecked();
  });
  return checkbox;
}

function createInfoDiv(snapshot, index, totalTabs) {
  const infoDiv = document.createElement('div');
  infoDiv.className = 'snapshot-info';
  
  const nameSpan = document.createElement('span');
  nameSpan.textContent = snapshot.name || `Snapshot ${index + 1}`;
  nameSpan.className = 'snapshot-name';
  infoDiv.appendChild(nameSpan);  

  infoDiv.appendChild(document.createTextNode(` (${snapshot.groups.length} groups, ${totalTabs} tabs)`));
  return infoDiv;
}

function anySnapshotCheckBoxChecked() {
  const allCheckBoxes = Array.from(document.querySelectorAll('div.snapshot-item-left > input[type=checkbox]'));

  return allCheckBoxes.some(chk => chk.checked);
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

  const closeButton = createButton('close', 'Close open tab groups from that snapshot', () => {
    if (confirm('Are you sure you want to close all open tab groups from this snapshot?')) {
      chrome.runtime.sendMessage({ action: "closeSnapshot", snapshotIndex: index });
    }
  });
  buttonsDiv.appendChild(closeButton);

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

getExportButton().addEventListener('click', () => {
  chrome.runtime.sendMessage({
    action: "exportSnapshots",
    snapshotIndices: Array.from(selectedSnapshots)
  }, (response) => {
    if (response.success) {
      const blob = new Blob([JSON.stringify(response.snapshots, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tab_group_snapshots.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert('Failed to export snapshots.');
    }
  });
});

document.getElementById('importSnapshots').addEventListener('click', () => {
  getImportInput().value = '';
  document.getElementById('importInput').click();
});

getImportInput().addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSnapshots = JSON.parse(e.target.result);
        chrome.runtime.sendMessage({
          action: "importSnapshots",
          snapshots: importedSnapshots
        }, (response) => {
          if (response.success) {
            alert('Snapshots imported successfully.');
            updateSnapshotList();
          } else {
            alert('Failed to import snapshots.');
          }
        });
      } catch (error) {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  }
});

function getImportInput() {
  return document.getElementById('importInput');
}

function getTakeSnapshotButton() {
  return document.getElementById('takeSnapshot');
}

function getExportButton() {
  return document.getElementById('exportSnapshots');
}

document.addEventListener('DOMContentLoaded', () => {
  updateGroupList();
  updateSnapshotList();
});