// table-edit.js — 表格编辑（Claude 风格右键菜单）
window.HVE_TableEdit = (function () {
  let isActive = false;
  let activeTable = null;
  let tableMenu = null;

  function activate() {
    isActive = true;
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('click', onDocClick, true);
  }

  function deactivate() {
    isActive = false;
    document.removeEventListener('contextmenu', onContextMenu, true);
    document.removeEventListener('click', onDocClick, true);
    hideMenu();
  }

  function onContextMenu(e) {
    if (!isActive) return;
    const td = e.target.closest('td, th');
    const table = e.target.closest('table');
    if (!td || !table) return;
    if (window.HVE_Selector && window.HVE_Selector.isEditorElement(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    activeTable = table;
    showMenu(e.clientX, e.clientY, td, table);
  }

  function onDocClick(e) {
    if (tableMenu && !tableMenu.contains(e.target)) hideMenu();
  }

  function showMenu(x, y, cell, table) {
    hideMenu();
    tableMenu = document.createElement('div');
    tableMenu.setAttribute('data-hve-editor', 'true');
    tableMenu.setAttribute('data-hve-context-menu', 'true');
    tableMenu.style.left = x + 'px';
    tableMenu.style.top = y + 'px';

    const items = [
      { icon: '⬜', label: '选中整个表格', action: () => selectWholeTable(table) },
      { divider: true },
      { icon: '↑', label: '上方插入行', action: () => insertRow(cell, 'before') },
      { icon: '↓', label: '下方插入行', action: () => insertRow(cell, 'after') },
      { icon: '←', label: '左侧插入列', action: () => insertCol(cell, 'before') },
      { icon: '→', label: '右侧插入列', action: () => insertCol(cell, 'after') },
      { divider: true },
      { icon: '✕', label: '删除当前行', action: () => deleteRow(cell), danger: true },
      { icon: '✕', label: '删除当前列', action: () => deleteCol(cell), danger: true },
      { divider: true },
      { icon: '🎨', label: '切换表格样式', action: () => cycleTableStyle(table) },
    ];

    items.forEach(item => {
      if (item.divider) {
        const d = document.createElement('div');
        d.className = 'hve-cm-divider';
        tableMenu.appendChild(d);
        return;
      }
      const el = document.createElement('div');
      el.className = 'hve-cm-item' + (item.danger ? ' danger' : '');
      el.innerHTML = `<span class="hve-cm-icon">${item.icon}</span>${item.label}`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        hideMenu();
      });
      tableMenu.appendChild(el);
    });

    document.body.appendChild(tableMenu);
    const rect = tableMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) tableMenu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) tableMenu.style.top = (window.innerHeight - rect.height - 8) + 'px';
  }

  function hideMenu() {
    if (tableMenu && tableMenu.parentNode) tableMenu.parentNode.removeChild(tableMenu);
    tableMenu = null;
  }

  function selectWholeTable(table) {
    if (!table) return;
    // 使用 selector 选中整个 table 元素
    if (window.HVE_Selector) {
      window.HVE_Selector.select(table);
    }
    // 附着 resize 手柄
    if (window.HVE_Resize) {
      window.HVE_Resize.attachTo(table);
    }
    // 显示工具栏
    if (window.HVE_Toolbar) {
      window.HVE_Toolbar.show(table);
    }
    if (window.HVE_Core) {
      window.HVE_Core.showToast('已选中整个表格 — 可拖拽调整大小', 'info');
    }
  }

  function getCellIndex(cell) {
    return { col: cell.cellIndex };
  }

  function insertRow(cell, position) {
    const table = cell.closest('table');
    const beforeHTML = table.outerHTML; // 操作前保存
    const tr = cell.parentElement;
    const section = tr.parentElement; // thead, tbody, tfoot 或 table
    const colCount = tr.cells.length;

    // 在 tr 所在的 section 内操作，而非整个 table
    const newRow = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      // 如果所在 section 是 thead，创建 th；否则创建 td
      const isHeaderSection = section.tagName === 'THEAD';
      const newCell = document.createElement(isHeaderSection ? 'th' : 'td');
      newCell.textContent = '';
      if (isHeaderSection) {
        // 复制第一个 th 的样式
        const refCell = tr.cells[0];
        if (refCell) newCell.style.cssText = refCell.style.cssText;
      } else {
        newCell.style.padding = cell.style.padding || '10px 16px';
        newCell.style.borderBottom = cell.style.borderBottom || '1px solid #F0EDE8';
        // 复制 td 的基础样式
        if (cell.style.cssText) newCell.style.cssText = cell.style.cssText;
        newCell.textContent = '';
      }
      newRow.appendChild(newCell);
    }

    if (position === 'before') {
      section.insertBefore(newRow, tr);
    } else {
      section.insertBefore(newRow, tr.nextSibling);
    }

    recordTableChange(table, '插入行', beforeHTML);
    if (window.HVE_Core) window.HVE_Core.showToast('已插入行 ✓', 'success');
  }

  function insertCol(cell, position) {
    const table = cell.closest('table');
    const beforeHTML = table.outerHTML; // 操作前保存
    const { col } = getCellIndex(cell);
    const insertIdx = position === 'before' ? col : col + 1;

    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      const isHeader = row.parentElement.tagName === 'THEAD';

      if (isHeader) {
        // 在 header 行中插入 th
        const th = document.createElement('th');
        th.textContent = '新列';
        // 复制同行第一个 th 的样式
        const refTh = row.cells[0];
        if (refTh) {
          th.style.cssText = refTh.style.cssText;
        } else {
          th.style.cssText = 'padding:12px 16px;background:#F5F2ED;text-align:left;font-weight:600;border-bottom:2px solid #E8E5E0;color:#5D534A;';
        }
        // 复制 class
        if (refTh && refTh.className) th.className = refTh.className;
        // 手动插入到正确位置
        if (insertIdx >= row.cells.length) {
          row.appendChild(th);
        } else {
          row.insertBefore(th, row.cells[insertIdx]);
        }
      } else {
        // 在 body 行中插入 td
        const td = document.createElement('td');
        td.textContent = '';
        // 复制同行第一个 td 的样式
        const refTd = row.cells[0];
        if (refTd) {
          td.style.cssText = refTd.style.cssText;
        } else {
          td.style.cssText = 'padding:10px 16px;border-bottom:1px solid #F0EDE8;';
        }
        td.textContent = '';
        if (insertIdx >= row.cells.length) {
          row.appendChild(td);
        } else {
          row.insertBefore(td, row.cells[insertIdx]);
        }
      }
    }
    recordTableChange(table, '插入列', beforeHTML);
    if (window.HVE_Core) window.HVE_Core.showToast('已插入列 ✓', 'success');
  }

  function deleteRow(cell) {
    const table = cell.closest('table');
    const tr = cell.parentElement;
    const section = tr.parentElement;
    if (table.rows.length <= 1) {
      if (window.HVE_Core) window.HVE_Core.showToast('无法删除最后一行', 'info');
      return;
    }
    const beforeHTML = table.outerHTML; // 操作前保存
    section.removeChild(tr);
    recordTableChange(table, '删除行', beforeHTML);
    if (window.HVE_Core) window.HVE_Core.showToast('已删除行 ✓', 'success');
  }

  function deleteCol(cell) {
    const table = cell.closest('table');
    const { col } = getCellIndex(cell);
    if (table.rows[0].cells.length <= 1) {
      if (window.HVE_Core) window.HVE_Core.showToast('无法删除最后一列', 'info');
      return;
    }
    const beforeHTML = table.outerHTML; // 操作前保存
    for (let r = table.rows.length - 1; r >= 0; r--) {
      const row = table.rows[r];
      if (col < row.cells.length) {
        row.removeChild(row.cells[col]);
      }
    }
    recordTableChange(table, '删除列', beforeHTML);
    if (window.HVE_Core) window.HVE_Core.showToast('已删除列 ✓', 'success');
  }

  function cycleTableStyle(table) {
    const beforeHTML = table.outerHTML; // 操作前保存
    const styleIdx = parseInt(table.getAttribute('data-hve-style-idx') || '0');
    const next = (styleIdx + 1) % 4;
    table.setAttribute('data-hve-style-idx', next.toString());

    const ths = table.querySelectorAll('th');
    const tds = table.querySelectorAll('td');
    const trs = table.querySelectorAll('tbody tr');

    switch (next) {
      case 0: // default
        table.style.cssText = 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;';
        ths.forEach(th => th.style.cssText = 'padding:12px 16px;background:#F5F2ED;text-align:left;font-weight:600;border-bottom:2px solid #E8E5E0;color:#5D534A;');
        tds.forEach(td => td.style.cssText = 'padding:10px 16px;border-bottom:1px solid #F0EDE8;color:#2D2B28;');
        trs.forEach(tr => tr.style.background = '');
        break;
      case 1: // striped
        table.style.cssText = 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;';
        ths.forEach(th => th.style.cssText = 'padding:12px 16px;background:#D97706;color:white;text-align:left;font-weight:600;');
        tds.forEach(td => td.style.cssText = 'padding:10px 16px;border-bottom:1px solid #F0EDE8;color:#2D2B28;');
        trs.forEach((tr, i) => tr.style.background = i % 2 ? '#FAF9F7' : '');
        break;
      case 2: // bordered
        table.style.cssText = 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;border:1px solid #E8E5E0;';
        ths.forEach(th => th.style.cssText = 'padding:12px 16px;background:#FAF9F7;text-align:left;font-weight:600;border:1px solid #E8E5E0;color:#5D534A;');
        tds.forEach(td => td.style.cssText = 'padding:10px 16px;border:1px solid #E8E5E0;color:#2D2B28;');
        trs.forEach(tr => tr.style.background = '');
        break;
      case 3: // minimal
        table.style.cssText = 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;';
        ths.forEach(th => th.style.cssText = 'padding:12px 16px;text-align:left;font-weight:600;border-bottom:2px solid #2D2B28;color:#2D2B28;');
        tds.forEach(td => td.style.cssText = 'padding:10px 16px;border-bottom:1px solid #F0EDE8;color:#5D534A;');
        trs.forEach(tr => tr.style.background = '');
        break;
    }
    recordTableChange(table, '切换表格样式', beforeHTML);
  }

  function recordTableChange(table, desc, beforeOuterHTML) {
    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'content', element: table,
        before: { outerHTML: beforeOuterHTML },
        after: { outerHTML: table.outerHTML },
        description: desc
      });
    }
  }

  function insertNewTable(rows, cols, targetEl) {
    if (window.HVE_InsertPanel) {
      return window.HVE_InsertPanel.showTableDialog(targetEl);
    }
    // fallback
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const th = document.createElement('th');
      th.textContent = '表头 ' + (c + 1);
      th.style.cssText = 'padding:12px 16px;background:#F5F2ED;text-align:left;font-weight:600;border-bottom:2px solid #E8E5E0;color:#5D534A;';
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows - 1; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.textContent = '';
        td.style.cssText = 'padding:10px 16px;border-bottom:1px solid #F0EDE8;';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    if (targetEl && targetEl.parentNode) {
      targetEl.parentNode.insertBefore(table, targetEl.nextSibling);
    } else {
      document.body.appendChild(table);
    }
    return table;
  }

  return { activate, deactivate, insertNewTable };
})();
