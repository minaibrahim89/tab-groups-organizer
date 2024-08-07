let selectedGroups = new Set();

function updateGroupList() {
  chrome.runtime.sendMessage({action: "listGroups"}, (response) => {
    const groupList = document.getElementById('groupList');
    groupList.innerHTML = '<h3>Current Tab Groups:</h3>';
    response.groups.forEach(group => {
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
      });
      groupDiv.appendChild(checkbox);
      groupDiv.appendChild(document.createTextNode(` ${group.title} (${group.color})`));
      groupList.appendChild(groupDiv);
    });
  });
}

function updateSnapshotList() {
  chrome.storage.local.get(['snapshots'], (result) => {
    const snapshots = result.snapshots || [];
    const snapshotList = document.getElementById('snapshotList');
    snapshotList.innerHTML = '<h3>Saved Snapshots:</h3>';
    snapshots.forEach((snapshot, index) => {
      const snapshotDiv = document.createElement('div');
      snapshotDiv.className = 'snapshot-item';
      
      const infoDiv = document.createElement('div');
      const totalTabs = snapshot.groups.reduce((sum, group) => sum + group.tabs.length, 0);
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = snapshot.name || `Snapshot ${index + 1}`;
      nameSpan.className = 'snapshot-name';
      infoDiv.appendChild(nameSpan);
      
      infoDiv.appendChild(document.createTextNode(` (${snapshot.groups.length} groups, ${totalTabs} tabs)`));
      snapshotDiv.appendChild(infoDiv);
      
      const buttonsDiv = document.createElement('div');
      const renameButton = document.createElement('button');
      renameButton.innerHTML = '<i class="material-icons">edit</i>';
      renameButton.title = 'Rename';
      renameButton.addEventListener('click', () => {
        const newName = prompt('Enter new name for the snapshot:', snapshot.name || `Snapshot ${index + 1}`);
        if (newName !== null) {
          chrome.runtime.sendMessage({action: "renameSnapshot", snapshotIndex: index, newName: newName}, () => {
            updateSnapshotList();
          });
        }
      });
      buttonsDiv.appendChild(renameButton);
      
      const restoreButton = document.createElement('button');
      restoreButton.innerHTML = '<i class="material-icons">restore</i>';
      restoreButton.title = 'Restore';
      restoreButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({action: "restoreSnapshot", snapshotIndex: index});
      });
      buttonsDiv.appendChild(restoreButton);
      
      const deleteButton = document.createElement('button');
      deleteButton.innerHTML = '<i class="material-icons">delete</i>';
      deleteButton.title = 'Delete';
      deleteButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this snapshot?')) {
          chrome.runtime.sendMessage({action: "deleteSnapshot", snapshotIndex: index}, () => {
            updateSnapshotList();
          });
        }
      });
      buttonsDiv.appendChild(deleteButton);
      snapshotDiv.appendChild(buttonsDiv);      
      snapshotList.appendChild(snapshotDiv);
    });
  });
}

document.getElementById('takeSnapshot').addEventListener('click', () => {
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

document.addEventListener('DOMContentLoaded', () => {
  updateGroupList();
  updateSnapshotList();
});