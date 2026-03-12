// html-serializer.js — 将编辑后的 DOM 序列化为干净的 HTML
window.HVE_Serializer = (function () {

  /**
   * 序列化当前页面为干净的 HTML 字符串
   * 移除所有编辑器注入的元素和属性
   */
  function serialize() {
    const docClone = document.documentElement.cloneNode(true);
    cleanNode(docClone);
    // 美化缩进
    const html = '<!DOCTYPE html>\n' + docClone.outerHTML;
    return html;
  }

  function cleanNode(node) {
    // 移除编辑器注入的元素
    const editorElements = node.querySelectorAll('[data-hve-editor]');
    editorElements.forEach(el => el.remove());

    // 移除编辑器相关属性
    const allElements = node.querySelectorAll('*');
    allElements.forEach(el => {
      // 先检查 contenteditable 标记（必须在删除 data-hve-* 之前）
      const hadEditableMarker = el.hasAttribute('data-hve-contenteditable');

      // 移除 data-hve-* 属性
      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        if (attr.name.startsWith('data-hve-')) {
          el.removeAttribute(attr.name);
        }
      });

      // 移除编辑器添加的 contenteditable（仅移除有标记的）
      if (hadEditableMarker) {
        el.removeAttribute('contenteditable');
      }
    });

    // 移除编辑器注入的 style 和 script
    const injectedStyles = node.querySelectorAll('style[data-hve-injected]');
    injectedStyles.forEach(el => el.remove());

    return node;
  }

  return { serialize, cleanNode };
})();
