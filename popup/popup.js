// popup.js — 插件弹出面板逻辑
(function () {
  const btnToggle = document.getElementById('btn-toggle-editor');
  const btnOpen = document.getElementById('btn-open-file');
  const btnSave = document.getElementById('btn-save-file');
  const btnSaveAs = document.getElementById('btn-save-as');
  const statusBar = document.getElementById('status-bar');
  const fileNameEl = document.getElementById('file-name');
  let isEditorActive = false;

  // 向当前 tab 发送消息
  async function sendToActiveTab(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      return chrome.tabs.sendMessage(tab.id, message);
    }
  }

  // 查询编辑器状态
  async function queryEditorState() {
    try {
      const response = await sendToActiveTab({ type: 'QUERY_STATE' });
      if (response && response.active) {
        setActiveState(true, response.fileName);
      }
    } catch (e) {
      // content script 可能未注入
    }
  }

  // 设置激活状态的 UI
  function setActiveState(active, fileName) {
    isEditorActive = active;
    if (active) {
      btnToggle.classList.add('active');
      btnToggle.querySelector('span').textContent = '关闭编辑模式';
      btnSave.disabled = false;
      btnSaveAs.disabled = false;
      statusBar.classList.add('active');
      statusBar.querySelector('.status-text').textContent = '编辑中';
      if (fileName) {
        fileNameEl.textContent = fileName;
      }
    } else {
      btnToggle.classList.remove('active');
      btnToggle.querySelector('span').textContent = '开启编辑模式';
      btnSave.disabled = true;
      btnSaveAs.disabled = true;
      statusBar.classList.remove('active');
      statusBar.querySelector('.status-text').textContent = '编辑器未激活';
      fileNameEl.textContent = '';
    }
  }

  // 切换编辑模式
  btnToggle.addEventListener('click', async () => {
    try {
      const response = await sendToActiveTab({
        type: isEditorActive ? 'DISABLE_EDITOR' : 'ENABLE_EDITOR'
      });
      if (response && response.success) {
        setActiveState(!isEditorActive);
      }
    } catch (e) {
      // 如果 content script 未注入，尝试手动注入
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'utils/html-serializer.js',
            'utils/file-manager.js',
            'content/history.js',
            'content/selector.js',
            'content/drag-move.js',
            'content/resize.js',
            'content/text-edit.js',
            'content/table-edit.js',
            'content/image-handler.js',
            'content/align-guide.js',
            'content/toolbar.js',
            'content/insert-panel.js',
            'content/context-menu.js',
            'content/page-sorter.js',
            'content/editor-core.js'
          ]
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['styles/inject.css']
        });
        setTimeout(async () => {
          const resp = await sendToActiveTab({ type: 'ENABLE_EDITOR' });
          if (resp && resp.success) {
            setActiveState(true);
          }
        }, 300);
      }
    }
  });

  // 打开文件
  btnOpen.addEventListener('click', async () => {
    await sendToActiveTab({ type: 'OPEN_FILE' });
  });

  // 保存文件
  btnSave.addEventListener('click', async () => {
    await sendToActiveTab({ type: 'SAVE_FILE' });
  });

  // 另存为
  btnSaveAs.addEventListener('click', async () => {
    await sendToActiveTab({ type: 'SAVE_FILE_AS' });
  });

  // 初始化时查询状态
  queryEditorState();
})();
