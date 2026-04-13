// text-edit.js — 文本编辑（支持富文本格式）
window.HVE_TextEdit = (function () {
  let isActive = false;
  let editingElement = null;
  let originalContent = '';

  function activate() {
    isActive = true;
    document.addEventListener('dblclick', onDoubleClick, true);
    document.addEventListener('keydown', onGlobalKeyDown, true);
  }

  function deactivate() {
    isActive = false;
    document.removeEventListener('dblclick', onDoubleClick, true);
    document.removeEventListener('keydown', onGlobalKeyDown, true);
    finishEditing();
  }

  function onDoubleClick(e) {
    if (!isActive) return;
    const target = e.target;
    if (window.HVE_Selector && window.HVE_Selector.isEditorElement(target)) return;
    
    // 检查是否是容器类元素（留给 insert-panel 处理）
    const containerTags = new Set(['SECTION', 'MAIN', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'BODY']);
    if (containerTags.has(target.tagName)) return;

    // 双击 <a> 链接时弹出编辑链接对话框（而非进入文本编辑模式）
    if (target.tagName === 'A' && window.HVE_LinkDialog) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.HVE_LinkDialog.show(target);
      return;
    }
    
    if (!isTextElement(target)) return;
    e.preventDefault();
    e.stopImmediatePropagation(); // 阻止 insert-panel.js 的 dblclick 也被触发

    // 如果双击的是表格单元格，先选中它再编辑（Figma 风格：双击进入内部）
    if ((target.tagName === 'TD' || target.tagName === 'TH') && window.HVE_Selector) {
      window.HVE_Selector.select(target);
    }

    startEditing(target);
  }

  // 全局快捷键（在文本编辑中拦截格式命令）
  function onGlobalKeyDown(e) {
    if (!editingElement) return;

    // 在文本编辑中支持 Ctrl/Cmd + B/I/U
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          e.stopPropagation();
          document.execCommand('bold', false, null);
          return;
        case 'i':
          e.preventDefault();
          e.stopPropagation();
          document.execCommand('italic', false, null);
          return;
        case 'u':
          e.preventDefault();
          e.stopPropagation();
          document.execCommand('underline', false, null);
          return;
      }
    }
  }

  function isTextElement(el) {
    const textTags = new Set([
      'P','H1','H2','H3','H4','H5','H6','SPAN','A','STRONG','EM','B','I','U',
      'LI','TD','TH','LABEL','BUTTON','BLOCKQUOTE','FIGCAPTION','CITE',
      'SMALL','SUB','SUP','MARK','CODE','PRE'
    ]);
    if (textTags.has(el.tagName)) return true;
    // DIV 仅在有实际文本内容时才算文本元素（排除纯容器 DIV）
    if (el.tagName === 'DIV') {
      // 检查 DIV 是否直接包含文本内容（而不仅仅是子元素）
      const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
      const isSmallContainer = el.children.length <= 2 && el.textContent.trim().length > 0 && el.textContent.trim().length < 500;
      return hasDirectText || isSmallContainer;
    }
    return false;
  }

  function startEditing(el) {
    if (editingElement && editingElement !== el) finishEditing();
    startEditingElement(el);
  }

  function startEditingElement(el) {
    if (editingElement === el) return; // 防止重复编辑同一元素导致事件监听器泄漏
    if (editingElement && editingElement !== el) finishEditing();
    editingElement = el;
    originalContent = el.innerHTML;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-hve-editing', 'true');
    el.setAttribute('data-hve-contenteditable', 'true'); // 标记这是编辑器添加的
    el.focus();

    // 隐藏 resize 手柄
    if (window.HVE_Resize) window.HVE_Resize.detach();

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('blur', onBlur);

    // 选中全部文本
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function finishEditing() {
    if (!editingElement) return;
    const el = editingElement;
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-hve-editing');
    el.removeAttribute('data-hve-contenteditable');
    el.removeEventListener('keydown', onKeyDown);
    el.removeEventListener('blur', onBlur);

    const newContent = el.innerHTML;
    if (newContent !== originalContent && window.HVE_History) {
      window.HVE_History.record({
        type: 'content',
        element: el,
        before: { innerHTML: originalContent },
        after: { innerHTML: newContent },
        description: '编辑文本内容'
      });
    }

    // 重新附着 resize
    if (window.HVE_Resize && window.HVE_Selector && window.HVE_Selector.getSelected() === el) {
      window.HVE_Resize.attachTo(el);
    }

    editingElement = null;
    originalContent = '';
  }

  function onKeyDown(e) {
    // 空值保护：极端时序下 blur 可能先清空 editingElement
    if (!editingElement) return;

    if (e.key === 'Escape') {
      e.stopPropagation(); // 防止冒泡到 editor-core.js 的 onKeyDown
      editingElement.innerHTML = originalContent;
      finishEditing();
      return;
    }

    // ========== 回车键处理 ==========
    if (e.key === 'Enter') {
      e.stopPropagation();
      const el = editingElement;
      const isTableCell = el.tagName === 'TD' || el.tagName === 'TH';

      if (isTableCell) {
        if (e.shiftKey) {
          // Shift+Enter 在表格单元格内插入换行 <br>
          e.preventDefault();
          document.execCommand('insertLineBreak', false, null);
        } else {
          // Enter 在表格单元格 → 完成编辑并跳到下一行同列（类似 Excel）
          e.preventDefault();
          const nextCell = getNextTableRow(el);

          // 先完成当前编辑
          finishEditing();

          if (nextCell) {
            if (window.HVE_Selector) window.HVE_Selector.select(nextCell);
            setTimeout(() => startEditingElement(nextCell), 50);
          }
        }
        return;
      }

      // 非表格元素：用 insertLineBreak 插入 <br>，防止浏览器插入 <div>
      if (!e.shiftKey) {
        // 对于标题、段落等单行元素，回车直接结束编辑
        const singleLineTags = new Set(['H1','H2','H3','H4','H5','H6','LABEL','BUTTON']);
        if (singleLineTags.has(el.tagName)) {
          e.preventDefault();
          finishEditing();
          return;
        }
      }
      // 其他情况让浏览器默认处理（段落中回车插入新行）
      return;
    }

    // ========== Tab 键处理（表格单元格间跳转） ==========
    if (e.key === 'Tab') {
      const el = editingElement;
      const isTableCell = el.tagName === 'TD' || el.tagName === 'TH';
      if (isTableCell) {
        e.preventDefault();
        e.stopPropagation();

        const targetCell = e.shiftKey ? getPrevTableCell(el) : getNextTableCell(el);
        finishEditing();

        if (targetCell) {
          if (window.HVE_Selector) window.HVE_Selector.select(targetCell);
          setTimeout(() => startEditingElement(targetCell), 50);
        }
        return;
      }
    }

    // 允许事件冒泡到 onGlobalKeyDown 处理格式快捷键
    // 但阻止其他快捷键（如 Delete 删除元素）的冒泡
    if (!e.ctrlKey && !e.metaKey && e.key !== 'Escape') {
      e.stopPropagation();
    }
  }

  function onBlur(e) {
    // 检查是否点击了工具栏按钮
    const related = e.relatedTarget;
    if (related && window.HVE_Selector && window.HVE_Selector.isEditorElement(related)) return;
    setTimeout(() => {
      // 再次检查焦点是否在工具栏上
      const active = document.activeElement;
      if (active && window.HVE_Selector && window.HVE_Selector.isEditorElement(active)) return;
      finishEditing();
    }, 200);
  }

  function isEditing() { return editingElement !== null; }

  // ========== 表格导航辅助函数（正确处理 thead/tbody 边界） ==========

  /**
   * 获取表格中所有行（跨越 thead/tbody/tfoot）
   */
  function getAllTableRows(cell) {
    const table = cell.closest('table');
    if (!table) return [];
    return Array.from(table.rows); // table.rows 自动包含 thead/tbody/tfoot 中所有 tr
  }

  /**
   * 获取下一行同列的单元格（Enter 跳转）
   */
  function getNextTableRow(cell) {
    const rows = getAllTableRows(cell);
    const tr = cell.parentElement;
    const rowIdx = rows.indexOf(tr);
    const colIdx = cell.cellIndex;
    if (rowIdx < 0 || colIdx < 0) return null;

    for (let i = rowIdx + 1; i < rows.length; i++) {
      if (colIdx < rows[i].cells.length) {
        return rows[i].cells[colIdx];
      }
    }
    return null;
  }

  /**
   * 获取下一个单元格（Tab 跳转：右 → 下一行首列）
   */
  function getNextTableCell(cell) {
    const tr = cell.parentElement;
    const colIdx = cell.cellIndex;
    if (colIdx < 0) return null;

    // 同行右侧
    if (colIdx < tr.cells.length - 1) {
      return tr.cells[colIdx + 1];
    }
    // 下一行首列
    const rows = getAllTableRows(cell);
    const rowIdx = rows.indexOf(tr);
    if (rowIdx >= 0 && rowIdx < rows.length - 1) {
      const nextRow = rows[rowIdx + 1];
      if (nextRow.cells.length > 0) return nextRow.cells[0];
    }
    return null;
  }

  /**
   * 获取上一个单元格（Shift+Tab 跳转：左 → 上一行末列）
   */
  function getPrevTableCell(cell) {
    const tr = cell.parentElement;
    const colIdx = cell.cellIndex;
    if (colIdx < 0) return null;

    // 同行左侧
    if (colIdx > 0) {
      return tr.cells[colIdx - 1];
    }
    // 上一行末列
    const rows = getAllTableRows(cell);
    const rowIdx = rows.indexOf(tr);
    if (rowIdx > 0) {
      const prevRow = rows[rowIdx - 1];
      if (prevRow.cells.length > 0) return prevRow.cells[prevRow.cells.length - 1];
    }
    return null;
  }

  return { activate, deactivate, isEditing, finishEditing, startEditingElement };
})();
