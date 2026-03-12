// context-menu.js — 通用右键菜单（任何选中元素都可右键操作）
window.HVE_ContextMenu = (function () {
  let menu = null;
  let isActive = false;
  let copiedStyle = null; // 存储复制的样式

  function activate() {
    isActive = true;
    document.addEventListener('contextmenu', onContextMenu, true);
  }

  function deactivate() {
    isActive = false;
    document.removeEventListener('contextmenu', onContextMenu, true);
    hideMenu();
  }

  function onContextMenu(e) {
    if (!isActive) return;
    if (!window.HVE_Core || !window.HVE_Core.getState()) return;

    // 不拦截编辑器自身元素的右键
    if (window.HVE_Selector && window.HVE_Selector.isEditorElement(e.target)) return;

    // 表格单元格交给 table-edit.js 的专用菜单处理
    if (e.target.closest('td, th') && e.target.closest('table') && window.HVE_TableEdit) return;

    const selector = window.HVE_Selector;
    if (!selector) return;

    // 查找目标元素
    let target = e.target;
    const selected = selector.getSelected();
    const selectedEls = selector.getSelectedElements();

    // 如果右键目标在已选中元素内，使用选中的元素
    if (selected && (selected.contains(target) || target === selected)) {
      target = selected;
    } else if (selectedEls.length > 0) {
      for (const sel of selectedEls) {
        if (sel.contains(target) || target === sel) {
          target = sel;
          break;
        }
      }
    }

    // 检查是否可选择
    if (!selector.isSelectable(target)) return;

    e.preventDefault();
    e.stopPropagation();

    // 确保元素被选中
    if (!selectedEls.includes(target)) {
      selector.select(target);
    }

    showMenu(e.clientX, e.clientY, target);
  }

  function showMenu(x, y, target) {
    hideMenu();

    menu = document.createElement('div');
    menu.setAttribute('data-hve-editor', 'true');
    menu.setAttribute('data-hve-context-menu', 'true');

    const isLocked = target.hasAttribute('data-hve-locked');
    const selectedEls = window.HVE_Selector?.getSelectedElements() || [];
    const isMulti = selectedEls.length > 1;

    const items = [];

    // === 基础操作 ===
    if (!isMulti) {
      items.push({
        icon: '✏️', label: '编辑文本', shortcut: '双击',
        action: () => {
          if (window.HVE_TextEdit) window.HVE_TextEdit.startEditingElement(target);
        },
        disabled: isLocked
      });
    }

    items.push({
      icon: '📋', label: '复制元素', shortcut: '⌘D',
      action: () => duplicateElements(isMulti ? selectedEls : [target])
    });

    items.push({ divider: true });

    // === 样式操作 ===
    items.push({
      icon: '🎨', label: '复制样式', shortcut: '⌘⇧C',
      action: () => copyStyle(target)
    });

    items.push({
      icon: '🖌️', label: '粘贴样式', shortcut: '⌘⇧V',
      action: () => pasteStyle(isMulti ? selectedEls : [target]),
      disabled: !copiedStyle
    });

    items.push({
      icon: '🧹', label: '清除样式',
      action: () => clearInlineStyle(isMulti ? selectedEls : [target])
    });

    items.push({ divider: true });

    // === 层级操作 ===
    if (!isMulti) {
      items.push({
        icon: '⬆️', label: '上移一层',
        action: () => moveElement(target, 'up'),
        disabled: !target.previousElementSibling
      });
      items.push({
        icon: '⬇️', label: '下移一层',
        action: () => moveElement(target, 'down'),
        disabled: !target.nextElementSibling
      });
      items.push({
        icon: '⏫', label: '移到最前',
        action: () => moveElement(target, 'first'),
        disabled: !target.previousElementSibling
      });
      items.push({
        icon: '⏬', label: '移到最后',
        action: () => moveElement(target, 'last'),
        disabled: !target.nextElementSibling
      });
    }

    items.push({ divider: true });

    // === 锁定 ===
    items.push({
      icon: isLocked ? '🔓' : '🔒',
      label: isLocked ? '解锁元素' : '锁定元素',
      action: () => toggleLock(isMulti ? selectedEls : [target])
    });

    // === 组合 ===
    if (isMulti) {
      items.push({
        icon: '🔗', label: '组合', shortcut: '⌘G',
        action: () => {
          if (window.HVE_Core && window.HVE_Core.groupElements) {
            window.HVE_Core.groupElements(selectedEls);
          }
        }
      });
    }

    if (!isMulti && target.hasAttribute('data-hve-group')) {
      items.push({
        icon: '🔓', label: '取消组合', shortcut: '⌘⇧G',
        action: () => {
          if (window.HVE_Core && window.HVE_Core.ungroupElement) {
            window.HVE_Core.ungroupElement(target);
          }
        }
      });
    }

    items.push({ divider: true });

    // === 删除 ===
    items.push({
      icon: '🗑️', label: isMulti ? `删除 ${selectedEls.length} 个元素` : '删除元素',
      shortcut: 'Del',
      danger: true,
      action: () => deleteElements(isMulti ? selectedEls : [target]),
      disabled: isLocked
    });

    // 渲染菜单
    items.forEach(item => {
      if (item.divider) {
        const d = document.createElement('div');
        d.className = 'hve-cm-divider';
        menu.appendChild(d);
        return;
      }
      const el = document.createElement('div');
      el.className = 'hve-cm-item' + (item.danger ? ' danger' : '') + (item.disabled ? ' disabled' : '');
      el.innerHTML = `
        <span class="hve-cm-icon">${item.icon}</span>
        <span>${item.label}</span>
        ${item.shortcut ? `<span class="hve-cm-shortcut">${item.shortcut}</span>` : ''}
      `;
      if (!item.disabled) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          item.action();
          hideMenu();
        });
      }
      menu.appendChild(el);
    });

    // 定位
    const menuWidth = 220;
    const menuHeight = items.length * 36;
    const posX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
    const posY = y + menuHeight > window.innerHeight ? Math.max(8, y - menuHeight) : y;

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';

    document.body.appendChild(menu);

    // 点击其他地方关闭
    setTimeout(() => {
      document.addEventListener('mousedown', onOutsideClick);
    }, 0);
  }

  function onOutsideClick(e) {
    if (menu && !menu.contains(e.target)) {
      hideMenu();
    }
  }

  function hideMenu() {
    document.removeEventListener('mousedown', onOutsideClick);
    if (menu && menu.parentNode) menu.remove();
    menu = null;
  }

  // === 操作实现 ===

  function copyStyle(el) {
    if (!el) return;
    const cs = getComputedStyle(el);
    copiedStyle = {};
    // 复制常用样式属性
    const props = [
      'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
      'fontStyle', 'textDecoration', 'textAlign', 'lineHeight', 'letterSpacing',
      'borderRadius', 'border', 'boxShadow', 'opacity', 'padding',
      'margin', 'background', 'textShadow'
    ];
    props.forEach(p => {
      copiedStyle[p] = cs[p];
    });
    if (window.HVE_Core) window.HVE_Core.showToast('样式已复制 ✓', 'success');
  }

  function pasteStyle(elements) {
    if (!copiedStyle || elements.length === 0) return;
    elements.forEach(el => {
      // 记录历史
      if (window.HVE_History) {
        const before = {};
        const after = {};
        Object.keys(copiedStyle).forEach(p => {
          before[p] = el.style[p] || '';
          after[p] = copiedStyle[p];
        });
        window.HVE_History.record({
          type: 'style', element: el,
          before: { style: before },
          after: { style: after },
          description: '粘贴样式'
        });
      }
      Object.entries(copiedStyle).forEach(([p, v]) => {
        el.style[p] = v;
      });
    });
    if (window.HVE_Core) window.HVE_Core.showToast('样式已粘贴 ✓', 'success');
  }

  function clearInlineStyle(elements) {
    elements.forEach(el => {
      if (window.HVE_History) {
        window.HVE_History.record({
          type: 'attribute', element: el,
          before: { attributes: { style: el.getAttribute('style') } },
          after: { attributes: { style: '' } },
          description: '清除样式'
        });
      }
      el.removeAttribute('style');
    });
    if (window.HVE_Core) window.HVE_Core.showToast('样式已清除', 'info');
  }

  function moveElement(el, direction) {
    if (!el || !el.parentNode) return;
    const parent = el.parentNode;

    // 记录历史（移动前保存位置信息）
    const prevSibling = el.previousElementSibling;
    const nextSibling = el.nextElementSibling;
    const beforeInfo = {
      parentSelector: window.HVE_History?.getUniqueSelector(parent),
      prevSiblingSelector: prevSibling ? window.HVE_History?.getUniqueSelector(prevSibling) : null,
      nextSiblingSelector: nextSibling ? window.HVE_History?.getUniqueSelector(nextSibling) : null,
      index: Array.from(parent.children).indexOf(el)
    };

    switch (direction) {
      case 'up':
        if (el.previousElementSibling) {
          parent.insertBefore(el, el.previousElementSibling);
        }
        break;
      case 'down':
        if (el.nextElementSibling) {
          parent.insertBefore(el.nextElementSibling, el);
        }
        break;
      case 'first':
        parent.insertBefore(el, parent.firstElementChild);
        break;
      case 'last':
        parent.appendChild(el);
        break;
    }

    // 记录层级调整历史
    if (window.HVE_History) {
      const afterPrev = el.previousElementSibling;
      const afterNext = el.nextElementSibling;
      window.HVE_History.record({
        type: 'move-order', element: el,
        before: beforeInfo,
        after: {
          parentSelector: window.HVE_History.getUniqueSelector(parent),
          prevSiblingSelector: afterPrev ? window.HVE_History.getUniqueSelector(afterPrev) : null,
          nextSiblingSelector: afterNext ? window.HVE_History.getUniqueSelector(afterNext) : null,
          index: Array.from(parent.children).indexOf(el)
        },
        description: `层级调整: ${direction}`
      });
    }

    if (window.HVE_Resize) window.HVE_Resize.attachTo(el);
    if (window.HVE_Toolbar) window.HVE_Toolbar.show(el);
  }

  function toggleLock(elements) {
    elements.forEach(el => {
      if (el.hasAttribute('data-hve-locked')) {
        el.removeAttribute('data-hve-locked');
      } else {
        el.setAttribute('data-hve-locked', 'true');
      }
    });
    const locked = elements[0]?.hasAttribute('data-hve-locked');
    if (window.HVE_Core) {
      window.HVE_Core.showToast(locked ? '元素已锁定 🔒' : '元素已解锁 🔓', 'info');
    }
  }

  function duplicateElements(elements) {
    const newEls = [];
    elements.forEach(el => {
      const clone = el.cloneNode(true);
      clone.removeAttribute('data-hve-selected');
      clone.removeAttribute('data-hve-multi-selected');
      clone.removeAttribute('data-hve-id');
      el.parentNode.insertBefore(clone, el.nextSibling);
      newEls.push(clone);
      if (window.HVE_History) {
        window.HVE_History.record({
          type: 'dom', element: clone,
          before: { action: 'insert' },
          after: { action: 'insert', html: clone.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(clone.parentElement) },
          description: '复制元素'
        });
      }
    });
    if (window.HVE_Selector) {
      window.HVE_Selector.deselectAll();
      newEls.forEach(el => window.HVE_Selector.addToSelection(el));
    }
  }

  function deleteElements(elements) {
    elements.forEach(el => {
      if (el.hasAttribute('data-hve-locked')) return;
      if (window.HVE_History) {
        window.HVE_History.record({
          type: 'dom', element: el,
          before: { action: 'remove', html: el.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(el.parentElement) },
          after: { action: 'remove' },
          description: '删除元素'
        });
      }
      el.remove();
    });
    if (window.HVE_Selector) window.HVE_Selector.deselectAll();
  }

  // 公开复制/粘贴样式方法（供快捷键调用）
  function getCopiedStyle() { return copiedStyle; }

  return {
    activate, deactivate, hideMenu,
    copyStyle, pasteStyle, getCopiedStyle,
    toggleLock
  };
})();
