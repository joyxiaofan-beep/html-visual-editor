// file-manager.js — 文件读写管理（File System Access API）
window.HVE_FileManager = (function () {
  let fileHandle = null;
  let dirHandle = null;

  /**
   * 打开本地 HTML 文件
   */
  async function openFile() {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'HTML Files',
          accept: { 'text/html': ['.html', '.htm'] }
        }],
        multiple: false
      });
      fileHandle = handle;
      const file = await handle.getFile();
      const text = await file.text();

      // 获取目录句柄（用于保存图片等资源）
      // 注意：需要用户额外授权
      return { content: text, name: file.name, handle };
    } catch (e) {
      if (e.name === 'AbortError') return null; // 用户取消
      console.error('[HVE] 打开文件失败:', e);
      return null;
    }
  }

  /**
   * 保存到当前文件
   */
  async function saveFile(content) {
    if (!fileHandle) {
      return saveFileAs(content);
    }
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      console.error('[HVE] 保存文件失败:', e);
      // 降级：用下载方式保存
      return downloadFile(content, fileHandle.name || 'edited.html');
    }
  }

  /**
   * 另存为
   */
  async function saveFileAs(content) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileHandle ? fileHandle.name : 'edited.html',
        types: [{
          description: 'HTML Files',
          accept: { 'text/html': ['.html', '.htm'] }
        }]
      });
      fileHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      console.error('[HVE] 另存为失败:', e);
      return downloadFile(content, 'edited.html');
    }
  }

  /**
   * 降级：通过下载方式保存
   */
  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * 保存图片到 assets 目录
   */
  async function saveImageToAssets(dataUrl, filename) {
    // 如果有目录句柄，保存为本地文件
    if (dirHandle) {
      try {
        let assetsDir;
        try {
          assetsDir = await dirHandle.getDirectoryHandle('assets', { create: true });
        } catch {
          assetsDir = dirHandle;
        }
        const imgHandle = await assetsDir.getFileHandle(filename, { create: true });
        const writable = await imgHandle.createWritable();
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await writable.write(blob);
        await writable.close();
        return './assets/' + filename;
      } catch (e) {
        console.warn('[HVE] 保存图片到本地失败，使用 base64:', e);
      }
    }
    // 降级：返回 base64 data URL
    return dataUrl;
  }

  function hasFileHandle() { return fileHandle !== null; }
  function getFileName() { return fileHandle ? fileHandle.name : null; }

  return { openFile, saveFile, saveFileAs, saveImageToAssets, hasFileHandle, getFileName, downloadFile };
})();
