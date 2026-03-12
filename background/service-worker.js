// service-worker.js — Chrome 插件后台服务
// Manifest V3 使用 Service Worker 而非 background page

// 安装时设置
chrome.runtime.onInstalled.addListener(() => {
  console.log('[HTML Visual Editor] 插件已安装');

  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'toggle-editor',
    title: '切换 HTML 可视化编辑模式',
    contexts: ['page']
  });
});

// 右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'toggle-editor' && tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_EDITOR' });
    } catch (e) {
      // content script 未加载，先注入
      await injectContentScripts(tab.id);
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: 'ENABLE_EDITOR' }).catch(() => {});
      }, 300);
    }
  }
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EDITOR_STATE_CHANGED') {
    // 可以更新 badge 等
    const text = message.active ? 'ON' : '';
    const color = message.active ? '#22c55e' : '#94a3b8';
    if (sender.tab) {
      chrome.action.setBadgeText({ text, tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color, tabId: sender.tab.id });
    }
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    if (sender.tab) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
    }
  }

  // 转发选中/取消选中消息到 side panel（side panel 无法直接收到 content script 的消息）
  if (message.type === 'HVE_ELEMENT_SELECTED' || message.type === 'HVE_ELEMENT_DESELECTED') {
    // 使用 chrome.runtime.sendMessage 转发给扩展内其他页面（如 side panel）
    chrome.runtime.sendMessage(message).catch(() => {
      // side panel 可能未打开，忽略错误
    });
  }

  return false;
});

// 注入 content scripts
async function injectContentScripts(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['styles/inject.css']
    });
    await chrome.scripting.executeScript({
      target: { tabId },
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
  } catch (e) {
    console.error('[HTML Visual Editor] 注入 content scripts 失败:', e);
  }
}

// 快捷键支持
chrome.commands?.onCommand?.addListener(async (command) => {
  if (command === 'toggle-editor') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_EDITOR' });
      } catch (e) {
        await injectContentScripts(tab.id);
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: 'ENABLE_EDITOR' }).catch(() => {});
        }, 300);
      }
    }
  }
});
