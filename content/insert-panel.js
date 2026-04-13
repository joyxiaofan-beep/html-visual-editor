// insert-panel.js — 容器优先的插入面板
// 交互流程：双击空白区域 → 插入空容器 → 再往容器内粘贴/拖拽内容
window.HVE_InsertPanel = (function () {
  let isActive = false;
  let panel = null;
  let insertTarget = null; // 插入位置参考元素
  let insertPosition = null; // 'before' | 'after' | 'append'

  function activate() {
    isActive = true;
    // 不再监听单击来显示+号按钮，改为只在双击空白区域时显示+号
    document.addEventListener('dblclick', onBodyDblClick, true);
  }

  function deactivate() {
    isActive = false;
    document.removeEventListener('dblclick', onBodyDblClick, true);
    hidePanel();
    hideQuickAddButton();
  }

  let quickAddBtn = null;

  // ========== 双击空白区域 → 显示 "+" 按钮 ==========
  // 注意：单击不再显示+号，只有双击空白区域才显示

  function onBodyDblClick(e) {
    if (!isActive) return;
    if (window.HVE_Selector && window.HVE_Selector.isEditorElement(e.target)) return;
    if (window.HVE_TextEdit && window.HVE_TextEdit.isEditing()) return;
    // 如果有选中元素，说明双击的是一个元素（可能正在进入文本编辑），不显示+号
    if (window.HVE_Selector && window.HVE_Selector.isElementSelected()) return;

    const target = e.target;
    // 双击空白区域 → 显示快速添加按钮（+号）
    if (target === document.body || isContainerElement(target)) {
      // 检查是否点击在子元素的间隙中
      const clickedOnChild = getDirectChildAt(target, e.clientX, e.clientY);
      if (!clickedOnChild || target === document.body) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // 显示+号按钮
        showQuickAddButton(e.clientX, e.clientY, target);
      }
    }
  }

  // ========== 工具函数 ==========

  function isContainerElement(el) {
    const containerTags = new Set(['DIV', 'SECTION', 'MAIN', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'BODY']);
    if (containerTags.has(el.tagName)) return true;
    // 带有 display:flex 或 display:grid 的元素也算容器
    const cs = getComputedStyle(el);
    if (cs.display === 'flex' || cs.display === 'grid') return true;
    return false;
  }

  function getDirectChildAt(parent, x, y) {
    for (const child of parent.children) {
      if (child.hasAttribute('data-hve-editor')) continue;
      // 跳过隐藏元素
      if (child.offsetParent === null && child.tagName !== 'BODY') continue;
      const rect = child.getBoundingClientRect();
      // 增加 2px 容差
      if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2) {
        return child;
      }
    }
    return null;
  }

  /**
   * 计算在容器中的插入位置（before/after 哪个子元素，或 append）
   */
  function calcInsertPosition(container, y) {
    let nearestChild = null;
    let minDist = Infinity;
    for (const child of container.children) {
      if (child.hasAttribute('data-hve-editor')) continue;
      const rect = child.getBoundingClientRect();
      const dist = Math.abs(y - (rect.top + rect.height / 2));
      if (dist < minDist) {
        minDist = dist;
        nearestChild = child;
      }
    }

    if (nearestChild) {
      const rect = nearestChild.getBoundingClientRect();
      return {
        target: nearestChild,
        position: y < rect.top + rect.height / 2 ? 'before' : 'after'
      };
    }
    return { target: container, position: 'append' };
  }

  // ========== 核心：插入空容器 ==========

  /**
   * 在双击位置插入一个空的编辑容器。
   * 容器带有占位提示，用户可以：
   *   - Ctrl+V 粘贴图片到容器内
   *   - 拖拽图片到容器内
   *   - 双击容器内的占位文字进行编辑
   *   - 通过容器内的工具按钮添加内容
   */
  function insertContainerAtPosition(x, y, parentContainer) {
    const pos = calcInsertPosition(parentContainer, y);

    // 创建容器
    const container = document.createElement('div');
    container.setAttribute('data-hve-content-box', 'true');
    container.style.cssText = 'padding:24px;background:rgba(250,249,247,0.6);border:2px dashed #E8E5E0;border-radius:14px;margin:12px 0;min-height:80px;position:relative;transition:border-color 0.2s,background 0.2s;';

    // 占位提示
    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-hve-placeholder', 'true');
    placeholder.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:56px;pointer-events:none;user-select:none;';
    placeholder.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4B5A4" stroke-width="1.5" stroke-linecap="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      <span style="font:13px/1.4 'SF Pro Text',-apple-system,sans-serif;color:#B8ADA4;">粘贴图片 · 拖入文件 · 点击下方按钮添加内容</span>
    `;
    container.appendChild(placeholder);

    // 容器内工具条（在容器底部，点击可选择插入类型）
    const toolbar = document.createElement('div');
    toolbar.setAttribute('data-hve-editor', 'true');
    toolbar.setAttribute('data-hve-box-toolbar', 'true');
    toolbar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 0 0;';
    toolbar.innerHTML = `
      <button data-box-action="image" title="插入图片" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">🖼️</button>
      <button data-box-action="text" title="插入文本" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">📝</button>
      <button data-box-action="heading" title="插入标题" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">🔤</button>
      <button data-box-action="table" title="插入表格" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">📊</button>
      <button data-box-action="list" title="插入列表" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">📋</button>
      <button data-box-action="more" title="更多选项..." style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;color:#9C8E82;transition:all 0.15s;">⋯</button>
    `;
    toolbar.addEventListener('click', (e) => onBoxToolbarClick(e, container));
    container.appendChild(toolbar);

    // 执行插入
    if (pos.position === 'before') {
      pos.target.parentNode.insertBefore(container, pos.target);
    } else if (pos.position === 'after') {
      pos.target.parentNode.insertBefore(container, pos.target.nextSibling);
    } else {
      pos.target.appendChild(container);
    }

    // 记录历史
    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'dom', element: container,
        before: { action: 'insert' },
        after: { action: 'insert', html: container.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(container.parentElement) },
        description: '插入内容容器'
      });
    }

    // 选中容器
    if (window.HVE_Selector) {
      window.HVE_Selector.select(container);
    }

    if (window.HVE_Core) {
      window.HVE_Core.showToast('容器已创建 ✓ 可粘贴或拖入内容', 'success');
    }

    return container;
  }

  // ========== 容器内工具条点击 ==========

  function onBoxToolbarClick(e, container) {
    const btn = e.target.closest('[data-box-action]');
    if (!btn) return;
    e.stopPropagation();
    e.preventDefault();

    const action = btn.dataset.boxAction;

    // 移除占位提示
    removePlaceholder(container);

    switch (action) {
      case 'image': {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = (ev) => {
          const file = ev.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
              const img = createImageElement(re.target.result, file.name);
              insertIntoBox(container, img);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
        break;
      }
      case 'text': {
        const p = document.createElement('p');
        p.textContent = '在这里输入文本内容...';
        p.style.cssText = 'font-size:16px;line-height:1.7;color:#2D2B28;margin:8px 0;';
        insertIntoBox(container, p);
        // 自动进入文本编辑
        if (window.HVE_Selector) window.HVE_Selector.select(p);
        setTimeout(() => {
          if (window.HVE_TextEdit) window.HVE_TextEdit.startEditingElement(p);
        }, 100);
        break;
      }
      case 'heading': {
        const h = document.createElement('h2');
        h.textContent = '标题文本';
        h.style.cssText = 'font-size:28px;font-weight:700;color:#2D2B28;margin:12px 0 8px;';
        insertIntoBox(container, h);
        if (window.HVE_Selector) window.HVE_Selector.select(h);
        setTimeout(() => {
          if (window.HVE_TextEdit) window.HVE_TextEdit.startEditingElement(h);
        }, 100);
        break;
      }
      case 'table': {
        showTableDialog(container);
        break;
      }
      case 'list': {
        const ul = document.createElement('ul');
        ul.style.cssText = 'margin:8px 0;padding-left:24px;line-height:1.8;font-size:16px;';
        ul.innerHTML = '<li>列表项 1</li><li>列表项 2</li><li>列表项 3</li>';
        insertIntoBox(container, ul);
        if (window.HVE_Selector) window.HVE_Selector.select(ul);
        break;
      }
      case 'more': {
        // 弹出完整的插入面板
        const rect = btn.getBoundingClientRect();
        insertTarget = container;
        insertPosition = 'append-into';
        showPanel(rect.left, rect.bottom + 4, container);
        break;
      }
    }
  }

  /**
   * 将元素插入到容器内部（在工具条之前）
   */
  function insertIntoBox(container, newEl) {
    const toolbar = container.querySelector('[data-hve-box-toolbar]');
    if (toolbar) {
      container.insertBefore(newEl, toolbar);
    } else {
      container.appendChild(newEl);
    }

    // 检查容器是否已有实际内容，有的话把虚线边框变成实线
    updateBoxAppearance(container);

    // 记录历史
    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'dom', element: newEl,
        before: { action: 'insert' },
        after: { action: 'insert', html: newEl.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(container) },
        description: '向容器添加内容'
      });
    }
  }

  /**
   * 移除容器内的占位提示
   */
  function removePlaceholder(container) {
    const ph = container.querySelector('[data-hve-placeholder]');
    if (ph) ph.remove();
  }

  /**
   * 根据容器内容更新外观：有内容 → 实线边框，空 → 虚线边框
   */
  function updateBoxAppearance(container) {
    const hasContent = hasRealContent(container);
    if (hasContent) {
      container.style.border = '1px solid #E8E5E0';
      container.style.background = 'rgba(255,255,255,0.3)';
    } else {
      container.style.border = '2px dashed #E8E5E0';
      container.style.background = 'rgba(250,249,247,0.6)';
    }
  }

  /**
   * 检查容器是否有除占位和工具条之外的实际内容
   */
  function hasRealContent(container) {
    for (const child of container.children) {
      if (child.hasAttribute('data-hve-placeholder')) continue;
      if (child.hasAttribute('data-hve-box-toolbar')) continue;
      if (child.hasAttribute('data-hve-editor')) continue;
      return true;
    }
    return false;
  }

  // ========== "+"按钮 → 弹出完整面板 ==========

  function showQuickAddButton(x, y, container) {
    hideQuickAddButton();
    hidePanel();

    quickAddBtn = document.createElement('div');
    quickAddBtn.setAttribute('data-hve-editor', 'true');
    quickAddBtn.setAttribute('data-hve-quick-add', 'true');
    quickAddBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

    const btnY = y + window.scrollY;
    quickAddBtn.style.cssText = `
      position:absolute;left:${x - 16}px;top:${btnY - 16}px;
      width:32px;height:32px;border-radius:50%;
      background:linear-gradient(135deg,#D97706,#B45309);
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;z-index:2147483644;
      box-shadow:0 2px 12px rgba(217,119,6,0.4);
      transition:all 0.2s;animation:hve-panel-in 0.2s ease;
    `;

    quickAddBtn.addEventListener('mouseenter', () => {
      quickAddBtn.style.transform = 'scale(1.15)';
      quickAddBtn.style.boxShadow = '0 4px 16px rgba(217,119,6,0.5)';
    });
    quickAddBtn.addEventListener('mouseleave', () => {
      quickAddBtn.style.transform = 'scale(1)';
      quickAddBtn.style.boxShadow = '0 2px 12px rgba(217,119,6,0.4)';
    });

    quickAddBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      hideQuickAddButton();
      // 设置插入位置
      const pos = calcInsertPosition(container, y);
      insertTarget = pos.target;
      insertPosition = pos.position;
      showPanel(x, y, container);
    });

    document.body.appendChild(quickAddBtn);

    // 5秒后自动隐藏
    setTimeout(() => {
      if (quickAddBtn) {
        quickAddBtn.style.opacity = '0';
        quickAddBtn.style.transition = 'opacity 0.3s';
        setTimeout(hideQuickAddButton, 300);
      }
    }, 5000);
  }

  function hideQuickAddButton() {
    if (quickAddBtn && quickAddBtn.parentNode) quickAddBtn.remove();
    quickAddBtn = null;
  }

  // ========== 完整插入面板（从"+"按钮或"更多"触发） ==========

  function showPanel(x, y, container) {
    hidePanel();
    hideQuickAddButton();

    // 只有非容器内部触发时才需要重新计算插入位置
    if (!insertTarget) {
      const pos = calcInsertPosition(container, y);
      insertTarget = pos.target;
      insertPosition = pos.position;
    }

    panel = document.createElement('div');
    panel.setAttribute('data-hve-editor', 'true');
    panel.setAttribute('data-hve-insert-panel', 'true');

    const items = [
      { icon: '📦', title: '容器', desc: '添加可放内容的容器', type: 'container' },
      { icon: '📝', title: '文本框', desc: '添加一段文字', type: 'text' },
      { icon: '🔤', title: '标题', desc: '添加标题文本', type: 'heading' },
      { icon: '📊', title: '表格', desc: '插入数据表格', type: 'table' },
      { icon: '🖼️', title: '图片', desc: '上传或粘贴图片', type: 'image' },
      { icon: '🔘', title: '按钮', desc: '添加可点击按钮', type: 'button' },
      { icon: '➖', title: '分隔线', desc: '添加水平分隔线', type: 'divider' },
      { icon: '🔗', title: '链接', desc: '添加超链接文本', type: 'link' },
      { icon: '📋', title: '列表', desc: '添加项目列表', type: 'list' },
      { icon: '💬', title: '引用', desc: '添加引用区块', type: 'blockquote' },
    ];

    let html = '<div class="hve-ip-title">插入元素</div>';
    items.forEach(item => {
      html += `
        <div class="hve-ip-item" data-insert-type="${item.type}">
          <div class="hve-ip-icon">${item.icon}</div>
          <div class="hve-ip-text">
            <span>${item.title}</span>
            <span>${item.desc}</span>
          </div>
        </div>`;
    });

    panel.innerHTML = html;
    panel.addEventListener('click', onPanelClick);
    document.body.appendChild(panel);

    // 插入后测量实际尺寸，再做边界修正
    const panelRect = panel.getBoundingClientRect();
    const panelH = panelRect.height;
    const panelW = panelRect.width;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8; // 距离视口边缘最小间距

    let finalLeft = x;
    let finalTop = y;

    // 水平：防止右侧溢出
    if (finalLeft + panelW > vw - margin) {
      finalLeft = vw - panelW - margin;
    }
    if (finalLeft < margin) finalLeft = margin;

    // 垂直：如果面板底部超出视口，则向上翻转
    if (finalTop + panelH > vh - margin) {
      // 尝试将面板显示在点击位置上方
      finalTop = y - panelH;
      // 如果上方也放不下，就贴着视口底部
      if (finalTop < margin) {
        finalTop = vh - panelH - margin;
      }
    }
    if (finalTop < margin) finalTop = margin;

    // 如果面板高度实在超过视口，启用内部滚动
    if (panelH > vh - margin * 2) {
      panel.style.maxHeight = (vh - margin * 2) + 'px';
      panel.style.overflowY = 'auto';
      finalTop = margin;
    }

    panel.style.left = finalLeft + 'px';
    panel.style.top = finalTop + 'px';

    // 点击面板外部关闭
    setTimeout(() => {
      document.addEventListener('mousedown', onOutsideClick);
    }, 0);
  }

  function onOutsideClick(e) {
    if (panel && !panel.contains(e.target)) {
      hidePanel();
    }
  }

  function hidePanel() {
    document.removeEventListener('mousedown', onOutsideClick);
    if (panel && panel.parentNode) panel.remove();
    panel = null;
    insertTarget = null;
    insertPosition = null;
  }

  function onPanelClick(e) {
    const item = e.target.closest('[data-insert-type]');
    if (!item) return;
    e.stopPropagation();

    const type = item.dataset.insertType;

    // 如果是"容器内更多"按钮触发的面板，插入到容器内部
    const isInsertIntoBox = insertPosition === 'append-into';

    if (type === 'table') {
      const target = insertTarget;
      hidePanel();
      if (isInsertIntoBox) {
        showTableDialogForBox(target);
      } else {
        showTableDialog(target);
      }
      return;
    }

    if (type === 'image') {
      const target = insertTarget;
      const pos = insertPosition;
      hidePanel();
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = (ev) => {
        const file = ev.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            const img = createImageElement(re.target.result, file.name);
            if (isInsertIntoBox) {
              removePlaceholder(target);
              insertIntoBox(target, img);
            } else {
              doInsert(img, target, pos);
            }
            if (window.HVE_Selector) window.HVE_Selector.select(img);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
      return;
    }

    if (type === 'container') {
      // 容器类型：插入一个空的内容容器（和双击空白一样）
      const target = insertTarget;
      const pos = insertPosition;
      hidePanel();
      const box = createContentBox();
      if (isInsertIntoBox) {
        removePlaceholder(target);
        insertIntoBox(target, box);
      } else {
        doInsert(box, target, pos);
      }
      if (window.HVE_Selector) window.HVE_Selector.select(box);
      return;
    }

    if (type === 'link') {
      // 链接类型：弹出 URL 输入对话框
      const target = insertTarget;
      const pos = insertPosition;
      const intoBox = isInsertIntoBox;
      hidePanel();
      showLinkDialogForInsert(target, pos, intoBox);
      return;
    }

    const newEl = createElementByType(type);
    if (newEl) {
      if (isInsertIntoBox) {
        removePlaceholder(insertTarget);
        insertIntoBox(insertTarget, newEl);
      } else {
        doInsert(newEl, insertTarget, insertPosition);
      }
      hidePanel();
      if (window.HVE_Selector) window.HVE_Selector.select(newEl);
    }
  }

  // ========== 元素创建工厂 ==========

  function createElementByType(type) {
    let el = null;
    switch (type) {
      case 'text':
        el = document.createElement('p');
        el.textContent = '在这里输入文本内容...';
        el.style.cssText = 'font-size:16px;line-height:1.7;color:#2D2B28;margin:12px 0;';
        break;
      case 'heading':
        el = document.createElement('h2');
        el.textContent = '标题文本';
        el.style.cssText = 'font-size:28px;font-weight:700;color:#2D2B28;margin:20px 0 12px;';
        break;
      case 'button':
        el = document.createElement('button');
        el.textContent = '按钮文本';
        el.style.cssText = 'padding:12px 28px;background:linear-gradient(135deg,#D97706,#B45309);color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;margin:8px 0;box-shadow:0 2px 8px rgba(217,119,6,0.3);';
        break;
      case 'divider':
        el = document.createElement('hr');
        el.style.cssText = 'border:none;height:1px;background:linear-gradient(to right,transparent,#D4CFC7,transparent);margin:28px 0;';
        break;
      case 'link':
        el = document.createElement('a');
        el.href = '#';
        el.textContent = '链接文本';
        el.style.cssText = 'color:#D97706;text-decoration:underline;font-size:16px;display:inline-block;margin:4px 0;';
        break;
      case 'list':
        el = document.createElement('ul');
        el.style.cssText = 'margin:12px 0;padding-left:24px;line-height:1.8;font-size:16px;';
        el.innerHTML = '<li>列表项 1</li><li>列表项 2</li><li>列表项 3</li>';
        break;
      case 'blockquote':
        el = document.createElement('blockquote');
        el.style.cssText = 'margin:16px 0;padding:16px 20px;border-left:4px solid #D97706;background:#FAF9F7;color:#5D534A;font-size:16px;font-style:italic;border-radius:0 10px 10px 0;';
        el.textContent = '这是一段引用文字...';
        break;
    }
    return el;
  }

  /**
   * 创建一个空的内容容器（和双击空白创建的一样）
   */
  function createContentBox() {
    const container = document.createElement('div');
    container.setAttribute('data-hve-content-box', 'true');
    container.style.cssText = 'padding:24px;background:rgba(250,249,247,0.6);border:2px dashed #E8E5E0;border-radius:14px;margin:12px 0;min-height:80px;position:relative;transition:border-color 0.2s,background 0.2s;';

    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-hve-placeholder', 'true');
    placeholder.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:56px;pointer-events:none;user-select:none;';
    placeholder.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4B5A4" stroke-width="1.5" stroke-linecap="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      <span style="font:13px/1.4 'SF Pro Text',-apple-system,sans-serif;color:#B8ADA4;">粘贴图片 · 拖入文件 · 点击下方按钮添加内容</span>
    `;
    container.appendChild(placeholder);

    const toolbar = document.createElement('div');
    toolbar.setAttribute('data-hve-editor', 'true');
    toolbar.setAttribute('data-hve-box-toolbar', 'true');
    toolbar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 0 0;';
    toolbar.innerHTML = `
      <button data-box-action="image" title="插入图片" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">🖼️</button>
      <button data-box-action="text" title="插入文本" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">📝</button>
      <button data-box-action="heading" title="插入标题" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">🔤</button>
      <button data-box-action="table" title="插入表格" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">📊</button>
      <button data-box-action="list" title="插入列表" style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all 0.15s;">📋</button>
      <button data-box-action="more" title="更多选项..." style="width:30px;height:30px;border:1px solid #E8E5E0;border-radius:8px;background:#FFFDF9;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;color:#9C8E82;transition:all 0.15s;">⋯</button>
    `;
    toolbar.addEventListener('click', (e) => onBoxToolbarClick(e, container));
    container.appendChild(toolbar);

    return container;
  }

  function createImageElement(src, name) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = name || 'image';
    img.style.cssText = 'max-width:100%;height:auto;margin:8px 0;display:block;border-radius:8px;';
    return img;
  }

  // ========== 通用插入（非容器内部） ==========

  function doInsert(newEl, target, position) {
    if (!target) {
      document.body.appendChild(newEl);
    } else if (position === 'before') {
      target.parentNode.insertBefore(newEl, target);
    } else if (position === 'after') {
      target.parentNode.insertBefore(newEl, target.nextSibling);
    } else {
      target.appendChild(newEl);
    }
    // 记录历史
    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'dom', element: newEl,
        before: { action: 'insert' },
        after: { action: 'insert', html: newEl.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(newEl.parentElement) },
        description: '插入元素'
      });
    }
  }

  // ========== 链接插入对话框（insert-panel 专用） ==========

  function showLinkDialogForInsert(target, pos, intoBox) {
    // 如果 toolbar 的对话框可用，直接复用
    if (window.HVE_LinkDialog) {
      // 临时设置 toolbar 的 currentTarget 后调用
      // 但 insert-panel 有自己的插入逻辑（doInsert / insertIntoBox），所以自建对话框
    }

    const overlay = document.createElement('div');
    overlay.setAttribute('data-hve-editor', 'true');
    overlay.setAttribute('data-hve-dialog-overlay', 'true');

    const dialog = document.createElement('div');
    dialog.setAttribute('data-hve-editor', 'true');
    dialog.setAttribute('data-hve-dialog', 'true');
    dialog.innerHTML = `
      <h3>插入链接</h3>
      <div style="margin-bottom:14px;">
        <label>链接文本</label>
        <input type="text" id="hve-link-text" placeholder="输入显示文字" value="链接文本">
      </div>
      <div style="margin-bottom:14px;">
        <label>链接地址 (URL)</label>
        <input type="text" id="hve-link-url" placeholder="https://example.com">
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="hve-link-blank" checked style="width:auto;accent-color:#D97706;">
          在新窗口中打开
        </label>
      </div>
      <div class="hve-dialog-actions">
        <button class="hve-btn-cancel" id="hve-link-cancel">取消</button>
        <button class="hve-btn-confirm" id="hve-link-confirm">插入</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    setTimeout(() => dialog.querySelector('#hve-link-url').focus(), 50);

    function cleanup() {
      overlay.remove();
      dialog.remove();
    }

    dialog.querySelector('#hve-link-cancel').addEventListener('click', cleanup);
    overlay.addEventListener('click', cleanup);

    dialog.querySelector('#hve-link-confirm').addEventListener('click', () => {
      const text = dialog.querySelector('#hve-link-text').value.trim() || '链接文本';
      let url = dialog.querySelector('#hve-link-url').value.trim();
      const blank = dialog.querySelector('#hve-link-blank').checked;

      if (url && !/^(https?:\/\/|mailto:|tel:|#)/.test(url)) {
        url = 'https://' + url;
      }
      if (!url) url = '#';

      const a = document.createElement('a');
      a.href = url;
      a.textContent = text;
      a.target = blank ? '_blank' : '';
      a.rel = blank ? 'noopener noreferrer' : '';
      a.style.cssText = 'color:#D97706;text-decoration:underline;font-size:16px;display:inline-block;margin:4px 0;';

      if (intoBox) {
        removePlaceholder(target);
        insertIntoBox(target, a);
      } else {
        doInsert(a, target, pos);
      }
      if (window.HVE_Selector) window.HVE_Selector.select(a);
      cleanup();
    });

    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        dialog.querySelector('#hve-link-confirm').click();
      } else if (e.key === 'Escape') {
        cleanup();
      }
    });
  }

  // ========== 表格对话框 ==========

  function showTableDialog(targetEl) {
    _showTableDialogImpl(targetEl, false);
  }

  function showTableDialogForBox(boxEl) {
    _showTableDialogImpl(boxEl, true);
  }

  function _showTableDialogImpl(targetEl, isForBox) {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-hve-editor', 'true');
    overlay.setAttribute('data-hve-dialog-overlay', 'true');

    const dialog = document.createElement('div');
    dialog.setAttribute('data-hve-editor', 'true');
    dialog.setAttribute('data-hve-dialog', 'true');
    dialog.innerHTML = `
      <h3>插入表格</h3>
      <div style="display:flex;gap:16px;margin-bottom:8px;">
        <div style="flex:1;">
          <label>行数</label>
          <input type="number" id="hve-tbl-rows" value="4" min="1" max="50">
        </div>
        <div style="flex:1;">
          <label>列数</label>
          <input type="number" id="hve-tbl-cols" value="3" min="1" max="20">
        </div>
      </div>
      <div style="margin-bottom:8px;">
        <label>样式</label>
        <select id="hve-tbl-style">
          <option value="default">默认样式</option>
          <option value="striped">斑马纹</option>
          <option value="bordered">全边框</option>
          <option value="minimal">极简</option>
        </select>
      </div>
      <div class="hve-dialog-actions">
        <button class="hve-btn-cancel" id="hve-tbl-cancel">取消</button>
        <button class="hve-btn-confirm" id="hve-tbl-confirm">插入</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    const cleanup = () => { overlay.remove(); dialog.remove(); };
    overlay.addEventListener('click', cleanup);
    dialog.querySelector('#hve-tbl-cancel').addEventListener('click', cleanup);
    dialog.querySelector('#hve-tbl-confirm').addEventListener('click', () => {
      const rows = parseInt(dialog.querySelector('#hve-tbl-rows').value) || 4;
      const cols = parseInt(dialog.querySelector('#hve-tbl-cols').value) || 3;
      const style = dialog.querySelector('#hve-tbl-style').value;
      const table = createStyledTable(rows, cols, style);

      if (isForBox) {
        // 插入到容器内部
        removePlaceholder(targetEl);
        insertIntoBox(targetEl, table);
      } else if (targetEl && targetEl.parentNode && targetEl !== document.body) {
        targetEl.parentNode.insertBefore(table, targetEl.nextSibling);
      } else if (targetEl === document.body) {
        targetEl.appendChild(table);
      } else {
        const container = document.querySelector('main') || document.body;
        container.appendChild(table);
      }

      if (window.HVE_Selector) window.HVE_Selector.select(table);
      if (window.HVE_History && !isForBox) {
        window.HVE_History.record({
          type: 'dom', element: table,
          before: { action: 'insert' },
          after: { action: 'insert', html: table.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(table.parentElement) },
          description: '插入表格'
        });
      }
      cleanup();
    });
  }

  function createStyledTable(rows, cols, style) {
    const table = document.createElement('table');
    const styles = {
      default: { table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;', th: 'padding:12px 16px;background:#F5F2ED;text-align:left;font-weight:600;border-bottom:2px solid #E8E5E0;color:#5D534A;', td: 'padding:10px 16px;border-bottom:1px solid #F0EDE8;color:#2D2B28;' },
      striped: { table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;', th: 'padding:12px 16px;background:#D97706;color:white;text-align:left;font-weight:600;', td: 'padding:10px 16px;border-bottom:1px solid #F0EDE8;color:#2D2B28;' },
      bordered: { table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;border:1px solid #E8E5E0;', th: 'padding:12px 16px;background:#FAF9F7;text-align:left;font-weight:600;border:1px solid #E8E5E0;color:#5D534A;', td: 'padding:10px 16px;border:1px solid #E8E5E0;color:#2D2B28;' },
      minimal: { table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;', th: 'padding:12px 16px;text-align:left;font-weight:600;border-bottom:2px solid #2D2B28;color:#2D2B28;', td: 'padding:10px 16px;border-bottom:1px solid #F0EDE8;color:#5D534A;' },
    };
    const s = styles[style] || styles.default;
    table.style.cssText = s.table;

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const th = document.createElement('th');
      th.textContent = '表头 ' + (c + 1);
      th.style.cssText = s.th;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows - 1; r++) {
      const tr = document.createElement('tr');
      if (style === 'striped' && r % 2 === 1) tr.style.background = '#FAF9F7';
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.textContent = '';
        td.style.cssText = s.td;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  function isPanelVisible() {
    return panel !== null || quickAddBtn !== null;
  }

  // ========== 公共 API（供 image-handler 等模块调用） ==========

  /**
   * 检查一个元素是否是内容容器（data-hve-content-box）
   */
  function isContentBox(el) {
    if (!el) return false;
    return el.hasAttribute('data-hve-content-box') || el.closest('[data-hve-content-box]') !== null;
  }

  /**
   * 获取元素所属的内容容器（如果有的话）
   */
  function getContentBox(el) {
    if (!el) return null;
    if (el.hasAttribute('data-hve-content-box')) return el;
    return el.closest('[data-hve-content-box]');
  }

  /**
   * 公共接口：向容器内插入内容并更新外观
   */
  function addToBox(container, newEl) {
    removePlaceholder(container);
    insertIntoBox(container, newEl);
  }

  return {
    activate, deactivate, showTableDialog, hidePanel, hideQuickAddButton, isPanelVisible,
    isContentBox, getContentBox, addToBox,
    removePlaceholder, updateBoxAppearance, insertIntoBox
  };
})();
