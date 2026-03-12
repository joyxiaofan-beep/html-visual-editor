// selector.js — 元素选择与高亮（支持多选 + 框选）
window.HVE_Selector = (function () {
  let selectedElement = null;       // 主选中元素（兼容旧接口）
  let selectedElements = [];        // 多选元素列表
  let hoveredElement = null;
  let isActive = false;

  // 框选相关
  let isMarqueeSelecting = false;
  let marqueeJustFinished = false;   // 防止框选结束后 click 清除选中
  let marqueeBox = null;             // 框选矩形 DOM 元素
  let marqueeStartX = 0, marqueeStartY = 0;
  let marqueeStartTime = 0;
  let cachedCandidates = null;       // 框选期间缓存候选元素
  let marqueeRafId = null;           // requestAnimationFrame 节流

  // 编辑器自身注入的元素选择器前缀
  const EDITOR_SELECTOR = '[data-hve-editor]';

  // 不可选择的元素标签
  const EXCLUDED_TAGS = new Set(['HTML', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'BR']);

  function activate() {
    isActive = true;
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('mousedown', onMouseDown, true);
  }

  function deactivate() {
    isActive = false;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mousemove', onMarqueeMove, true);
    document.removeEventListener('mouseup', onMarqueeUp, true);
    clearHover();
    deselectAll();
    removeMarquee();
  }

  function isEditorElement(el) {
    if (!el) return false;
    return el.closest(EDITOR_SELECTOR) !== null || el.hasAttribute('data-hve-editor');
  }

  function isSelectable(el) {
    if (!el || !el.tagName) return false;
    if (EXCLUDED_TAGS.has(el.tagName)) return false;
    if (el === document.body) return false;
    if (isEditorElement(el)) return false;
    return true;
  }

  // ========== 框选 (Marquee Selection) ==========

  function onMouseDown(e) {
    if (!isActive) return;
    if (e.button !== 0) return;
    if (isEditorElement(e.target)) return;

    // 如果正在拖拽或缩放，不处理
    if (window.HVE_DragMove && window.HVE_DragMove.isDragging()) return;
    if (window.HVE_Resize && window.HVE_Resize.isResizing()) return;
    // 如果正在文本编辑，不处理
    if (window.HVE_TextEdit && window.HVE_TextEdit.isEditing()) return;

    // 判断是否点击在已选中的元素上（这种情况交给 drag-move 处理）
    const selected = getSelected();
    if (selected && (selected.contains(e.target) || e.target === selected)) return;
    // 多选状态下，点在任何已选元素上也交给 drag
    if (selectedElements.length > 1) {
      for (const sel of selectedElements) {
        if (sel.contains(e.target) || e.target === sel) return;
      }
    }

    // 只有在空白区域（body 或容器）上开始框选，或者按住 Shift 也可以
    const target = e.target;
    const isEmptyArea = target === document.body || isContainerLike(target);

    if (isEmptyArea || e.shiftKey) {
      marqueeStartX = e.clientX;
      marqueeStartY = e.clientY;
      marqueeStartTime = Date.now();
      // 先监听 mousemove，等移动超过阈值后再真正开始框选
      document.addEventListener('mousemove', onMarqueeMove, true);
      document.addEventListener('mouseup', onMarqueeUp, true);
    }
  }

  // 容器类标签（用于判断空白区域框选）
  const CONTAINER_TAGS = new Set(['DIV', 'SECTION', 'MAIN', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'NAV']);

  function isContainerLike(el) {
    return CONTAINER_TAGS.has(el.tagName);
  }

  function onMarqueeMove(e) {
    const dx = e.clientX - marqueeStartX;
    const dy = e.clientY - marqueeStartY;

    // 移动超过 5px 才真正开始框选
    if (!isMarqueeSelecting && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isMarqueeSelecting = true;
      createMarquee();
      cachedCandidates = getCandidateElements(); // 框选开始时缓存
    }

    if (isMarqueeSelecting) {
      e.preventDefault();
      e.stopPropagation();
      updateMarquee(e.clientX, e.clientY);
      // 使用 requestAnimationFrame 节流高亮更新
      if (!marqueeRafId) {
        marqueeRafId = requestAnimationFrame(() => {
          highlightElementsInMarquee();
          marqueeRafId = null;
        });
      }
    }
  }

  function onMarqueeUp(e) {
    document.removeEventListener('mousemove', onMarqueeMove, true);
    document.removeEventListener('mouseup', onMarqueeUp, true);

    if (isMarqueeSelecting) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // 取消未执行的 rAF
      if (marqueeRafId) {
        cancelAnimationFrame(marqueeRafId);
        marqueeRafId = null;
      }

      // 完成框选 — 选中框内所有可选元素（复用缓存）
      const marqueeRect = getMarqueeRect(e.clientX, e.clientY);
      selectElementsInRect(marqueeRect, e.shiftKey);
      removeMarquee();
      isMarqueeSelecting = false;
      cachedCandidates = null; // 清理缓存

      // 标记框选刚结束，防止紧随其后的 click 清除选中
      marqueeJustFinished = true;
      setTimeout(() => { marqueeJustFinished = false; }, 50);
    } else {
      isMarqueeSelecting = false;
      cachedCandidates = null;
    }
  }

  function createMarquee() {
    removeMarquee();
    marqueeBox = document.createElement('div');
    marqueeBox.setAttribute('data-hve-editor', 'true');
    marqueeBox.setAttribute('data-hve-marquee', 'true');
    marqueeBox.style.cssText = `
      position: fixed;
      border: 2px dashed #D97706;
      background: rgba(217, 119, 6, 0.08);
      z-index: 2147483643;
      pointer-events: none;
      border-radius: 4px;
    `;
    document.body.appendChild(marqueeBox);
  }

  function updateMarquee(currentX, currentY) {
    if (!marqueeBox) return;
    const x = Math.min(marqueeStartX, currentX);
    const y = Math.min(marqueeStartY, currentY);
    const w = Math.abs(currentX - marqueeStartX);
    const h = Math.abs(currentY - marqueeStartY);

    marqueeBox.style.left = x + 'px';
    marqueeBox.style.top = y + 'px';
    marqueeBox.style.width = w + 'px';
    marqueeBox.style.height = h + 'px';
  }

  function getMarqueeRect(endX, endY) {
    return {
      left: Math.min(marqueeStartX, endX),
      top: Math.min(marqueeStartY, endY),
      right: Math.max(marqueeStartX, endX),
      bottom: Math.max(marqueeStartY, endY),
    };
  }

  function removeMarquee() {
    // 清除框选预览高亮
    document.querySelectorAll('[data-hve-marquee-preview]').forEach(el => {
      el.removeAttribute('data-hve-marquee-preview');
    });
    if (marqueeBox && marqueeBox.parentNode) {
      marqueeBox.remove();
    }
    marqueeBox = null;
  }

  function highlightElementsInMarquee() {
    if (!marqueeBox) return;
    const mRect = marqueeBox.getBoundingClientRect();

    // 清除旧的预览高亮
    document.querySelectorAll('[data-hve-marquee-preview]').forEach(el => {
      el.removeAttribute('data-hve-marquee-preview');
    });

    // 使用缓存的候选元素（框选期间 DOM 不变）
    const candidates = cachedCandidates || getCandidateElements();
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rectsIntersect(mRect, rect)) {
        el.setAttribute('data-hve-marquee-preview', 'true');
      }
    }
  }

  function getCandidateElements() {
    // 获取页面上所有可选的「叶子级」元素
    const all = document.body.querySelectorAll('*');
    const result = [];
    for (const el of all) {
      if (!isSelectable(el)) continue;
      // 排除太大的容器（如 body 级别的 wrapper）
      const rect = el.getBoundingClientRect();
      if (rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.9) continue;
      // 确保元素可见
      if (rect.width === 0 || rect.height === 0) continue;
      result.push(el);
    }
    return result;
  }

  function rectsIntersect(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function selectElementsInRect(marqueeRect, additive) {
    const candidates = cachedCandidates || getCandidateElements();
    const toSelect = [];

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rectsIntersect(marqueeRect, rect)) {
        // 排除已被选中子元素的父元素（避免父子同选）
        let hasSelectedChild = false;
        for (const other of toSelect) {
          if (el.contains(other)) { hasSelectedChild = true; break; }
        }
        if (!hasSelectedChild) {
          // 如果之前添加了父元素，移除它
          for (let i = toSelect.length - 1; i >= 0; i--) {
            if (toSelect[i].contains(el)) {
              toSelect.splice(i, 1);
            }
          }
          toSelect.push(el);
        }
      }
    }

    if (toSelect.length === 0) {
      if (!additive) deselectAll();
      return;
    }

    if (additive) {
      // 追加模式
      for (const el of toSelect) {
        if (!selectedElements.includes(el)) {
          addToSelection(el);
        }
      }
    } else {
      // 替换模式
      deselectAll();
      for (const el of toSelect) {
        addToSelection(el);
      }
    }

    // 更新主选中元素（第一个）
    if (selectedElements.length > 0) {
      selectedElement = selectedElements[0];
    }

    // 通知其他模块
    notifySelectionChanged();
  }

  // ========== 单击选择 ==========

  function onMouseMove(e) {
    if (!isActive) return;
    if (isMarqueeSelecting) return;
    // 如果正在拖拽或缩放，不处理 hover
    if (window.HVE_DragMove && window.HVE_DragMove.isDragging()) return;
    if (window.HVE_Resize && window.HVE_Resize.isResizing()) return;

    const target = e.target;
    if (isEditorElement(target)) return;
    if (!isSelectable(target)) return;

    if (target !== hoveredElement) {
      clearHover();
      hoveredElement = target;
      showHover(hoveredElement);
    }
  }

  function onClick(e) {
    if (!isActive) return;
    if (isMarqueeSelecting) return; // 框选中不处理 click
    if (marqueeJustFinished) return; // 框选刚结束，跳过此 click

    const target = e.target;

    // 点击编辑器自身元素不处理
    if (isEditorElement(target)) return;

    if (!isSelectable(target)) {
      deselectAll();
      // 主动隐藏+号按钮
      if (window.HVE_InsertPanel && window.HVE_InsertPanel.hideQuickAddButton) {
        window.HVE_InsertPanel.hideQuickAddButton();
      }
      return;
    }

    // 检查是否点击了容器的空白区域（子元素间隙或 padding 区域）
    if (isContainerLike(target)) {
      const clickedChild = getDirectClickChild(target, e.clientX, e.clientY);
      if (!clickedChild) {
        // 点击了容器空白区域 → 取消选中，同时隐藏+号按钮
        deselectAll();
        // 主动隐藏+号按钮（防止旧逻辑残留）
        if (window.HVE_InsertPanel && window.HVE_InsertPanel.hideQuickAddButton) {
          window.HVE_InsertPanel.hideQuickAddButton();
        }
        return;
      }
    }

    e.preventDefault();
    e.stopPropagation();

    // ★ PPT 核心逻辑：单击只选中，不进入编辑
    // 如果目标正在编辑（contenteditable），且单击的是同一个元素，保持编辑状态
    if (window.HVE_TextEdit && window.HVE_TextEdit.isEditing()) {
      // 点击的是正在编辑的元素内部，让文本编辑继续处理
      const editingEl = getSelected();
      if (editingEl && (editingEl === target || editingEl.contains(target))) {
        return;
      }
      // 点击了其他元素，先结束编辑
      window.HVE_TextEdit.finishEditing();
    }

    if (e.shiftKey) {
      // Shift + 点击 → 追加/移除选择
      toggleInSelection(target);
    } else {
      // ★ Figma 风格：单击优先选中「高层级」元素
      // 表格：单击 td/th → 选中整个 table（双击才进入编辑单元格）
      // 组合：单击组合内部 → 选中整个组合
      const smartTarget = getSmartSelectTarget(target);

      const current = getSelected();
      if (current && current === smartTarget) {
        // 已选中同一元素，向下钻入选择子元素（Figma 双击进入组合的替代方案）
        // 如果当前选中的是 table，再次点击可以选中 td
        if (smartTarget !== target) {
          // 当前选中的是智能提升后的元素（如 table），再次点击进入内部
          select(target);
          return;
        }
        // 已经选中最终目标，尝试向上选父级
        const parent = findSelectableParent(target);
        if (parent) {
          select(parent);
          return;
        }
      }
      select(smartTarget);
    }
  }

  /**
   * Figma 风格智能选择：确定单击时应该选中哪个元素
   * - 点击 td/th → 优先选中 table（如果 table 未被选中）
   * - 点击组合内子元素 → 优先选中组合容器
   */
  function getSmartSelectTarget(target) {
    // 优先检查组合容器（最外层），再检查 table
    // 这样当 table 嵌套在 group 内时，先选中 group

    // 1. 如果点击的是组合内部元素，优先选中组合容器
    const group = target.closest('[data-hve-group]');
    if (group && isSelectable(group)) {
      const currentSel = getSelected();
      if (currentSel === group) {
        // 已选中组合，向下钻入：检查内部是否有 table
        const table = target.closest('table');
        if (table && isSelectable(table) && group.contains(table)) {
          if (currentSel === table) {
            return target; // table 也已选中，继续向下钻入到 td
          }
          return table;
        }
        return target;
      }
      return group;
    }

    // 2. 如果点击的是表格内部元素（td/th/tr），优先选中整个 table
    const table = target.closest('table');
    if (table && isSelectable(table)) {
      const currentSel = getSelected();
      // 如果当前已选中这个 table，则允许向下钻入选中 td
      if (currentSel === table) {
        return target;
      }
      return table;
    }

    return target;
  }

  /**
   * 检查是否直接点击到了容器的某个子元素（非空白区域）
   */
  function getDirectClickChild(container, x, y) {
    for (const child of container.children) {
      if (child.hasAttribute('data-hve-editor')) continue;
      if (child.offsetParent === null && child.tagName !== 'BODY') continue;
      const rect = child.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return child;
      }
    }
    return null;
  }

  /**
   * 向上选择父级元素（用于从 td → tr → table → 更上级容器）
   */
  function selectParent() {
    const current = getSelected();
    if (!current) return false;
    const parent = findSelectableParent(current);
    if (parent) {
      select(parent);
      return true;
    }
    return false;
  }

  /**
   * 查找元素最近的可选父级
   */
  function findSelectableParent(el) {
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      if (isSelectable(parent)) {
        // 排除太大的容器
        const rect = parent.getBoundingClientRect();
        if (rect.width < window.innerWidth * 0.95 || rect.height < window.innerHeight * 0.9) {
          return parent;
        }
      }
      parent = parent.parentElement;
    }
    return null;
  }

  // ========== 选择操作 ==========

  function select(el) {
    if (selectedElements.length === 1 && selectedElements[0] === el) return;

    deselectAll();
    addToSelection(el);
    selectedElement = el;

    notifySelectionChanged();
  }

  // 表格元素浮层标签
  let tableLabelOverlay = null;

  function addToSelection(el) {
    if (selectedElements.includes(el)) return;
    selectedElements.push(el);
    el.setAttribute('data-hve-selected', 'true');

    // 设置选中标签（显示元素类型，类似 PPT 的选中提示）
    const tagLabel = getElementLabel(el);
    el.setAttribute('data-hve-select-label', tagLabel);

    // 表格内元素（td/th/tr）使用浮层标签避免布局错位
    if (isTableElement(el)) {
      showTableLabel(el, tagLabel);
    }

    if (selectedElements.length > 1) {
      el.setAttribute('data-hve-multi-selected', 'true');
    }

    // 如果从单选变为多选，给第一个元素也加上多选标记
    if (selectedElements.length === 2) {
      selectedElements[0].setAttribute('data-hve-multi-selected', 'true');
    }
  }

  /**
   * 判断是否是表格内部元素（td/th/tr/thead/tbody/tfoot）
   */
  function isTableElement(el) {
    const tag = el.tagName;
    return tag === 'TD' || tag === 'TH' || tag === 'TR' || tag === 'THEAD' || tag === 'TBODY' || tag === 'TFOOT';
  }

  /**
   * 为表格元素显示浮层标签（不使用 ::before 伪元素）
   */
  function showTableLabel(el, label) {
    removeTableLabel();
    tableLabelOverlay = document.createElement('div');
    tableLabelOverlay.setAttribute('data-hve-editor', 'true');
    tableLabelOverlay.setAttribute('data-hve-table-label', 'true');
    tableLabelOverlay.textContent = label;
    tableLabelOverlay.style.cssText = `
      position: fixed;
      font: 10px/1 'SF Pro Text', -apple-system, sans-serif;
      color: white;
      background: #D97706;
      padding: 2px 6px;
      border-radius: 4px 4px 0 0;
      pointer-events: none;
      z-index: 2147483641;
      white-space: nowrap;
      opacity: 0.85;
    `;
    document.body.appendChild(tableLabelOverlay);
    positionTableLabel(el);
  }

  /**
   * 定位表格浮层标签到元素上方
   */
  function positionTableLabel(el) {
    if (!tableLabelOverlay || !el) return;
    const rect = el.getBoundingClientRect();
    tableLabelOverlay.style.left = rect.left + 'px';
    tableLabelOverlay.style.top = (rect.top - 16) + 'px';
  }

  /**
   * 移除表格浮层标签
   */
  function removeTableLabel() {
    if (tableLabelOverlay && tableLabelOverlay.parentNode) {
      tableLabelOverlay.remove();
    }
    tableLabelOverlay = null;
  }

  /**
   * 获取元素的人类可读标签
   */
  function getElementLabel(el) {
    // 特殊标记的元素优先
    if (el.hasAttribute('data-hve-content-box')) return '内容框';
    if (el.hasAttribute('data-hve-group')) return '组合';

    const tag = el.tagName.toLowerCase();
    const tagNames = {
      h1: 'H1 标题', h2: 'H2 标题', h3: 'H3 标题', h4: 'H4 标题',
      p: '段落', div: '容器', span: '文本', a: '链接',
      img: '图片', table: '表格', ul: '列表', ol: '列表',
      button: '按钮', input: '输入框', form: '表单',
      section: '区域', article: '文章', header: '页头', footer: '页脚',
      nav: '导航', aside: '侧栏', main: '主区域',
      td: '单元格', th: '表头', tr: '行', hr: '分割线',
      blockquote: '引用', pre: '代码', code: '代码',
      figure: '图片组', figcaption: '图注', video: '视频', audio: '音频',
      svg: 'SVG', canvas: '画布', iframe: '嵌入框'
    };
    return tagNames[tag] || tag.toUpperCase();
  }

  function removeFromSelection(el) {
    const idx = selectedElements.indexOf(el);
    if (idx === -1) return;
    selectedElements.splice(idx, 1);
    el.removeAttribute('data-hve-selected');
    el.removeAttribute('data-hve-multi-selected');
    el.removeAttribute('data-hve-select-label');

    // 清理表格浮层标签
    if (isTableElement(el)) {
      removeTableLabel();
    }

    // 如果只剩一个，移除它的多选标记
    if (selectedElements.length === 1) {
      selectedElements[0].removeAttribute('data-hve-multi-selected');
    }

    if (selectedElement === el) {
      selectedElement = selectedElements.length > 0 ? selectedElements[0] : null;
    }
  }

  function toggleInSelection(el) {
    if (selectedElements.includes(el)) {
      removeFromSelection(el);
    } else {
      addToSelection(el);
      selectedElement = el;
    }
    notifySelectionChanged();
  }

  function deselect() {
    deselectAll();
  }

  function deselectAll() {
    for (const el of selectedElements) {
      el.removeAttribute('data-hve-selected');
      el.removeAttribute('data-hve-multi-selected');
      el.removeAttribute('data-hve-select-label');
    }
    selectedElements = [];
    selectedElement = null;

    // 清理表格浮层标签
    removeTableLabel();

    hideMultiSelectInfo();

    if (window.HVE_Resize) {
      window.HVE_Resize.detach();
    }
    if (window.HVE_Toolbar) {
      window.HVE_Toolbar.hide();
    }

    document.dispatchEvent(new CustomEvent('hve-element-deselected', { detail: {} }));

    // 通知侧边栏属性面板
    try {
      chrome.runtime?.sendMessage({ type: 'HVE_ELEMENT_DESELECTED' });
    } catch (e) { /* ignore */ }
  }

  function notifySelectionChanged() {
    if (selectedElements.length === 1) {
      // 单选模式 — 显示工具栏和 resize，隐藏多选提示
      hideMultiSelectInfo();
      selectedElement = selectedElements[0];

      // 如果选中的不是表格元素，清理表格浮层标签
      if (!isTableElement(selectedElement)) {
        removeTableLabel();
      }

      if (window.HVE_Resize) {
        window.HVE_Resize.attachTo(selectedElement);
      }
      if (window.HVE_Toolbar) {
        window.HVE_Toolbar.show(selectedElement);
      }
      document.dispatchEvent(new CustomEvent('hve-element-selected', {
        detail: { element: selectedElement }
      }));

      // 通知侧边栏属性面板
      try {
        const cs = getComputedStyle(selectedElement);
        const rect = selectedElement.getBoundingClientRect();
        chrome.runtime?.sendMessage({
          type: 'HVE_ELEMENT_SELECTED',
          data: {
            tagName: selectedElement.tagName,
            id: selectedElement.id || '',
            className: (typeof selectedElement.className === 'string' ? selectedElement.className : selectedElement.className?.baseVal) || '',
            textContent: (selectedElement.textContent || '').substring(0, 100),
            style: {
              width: cs.width, height: cs.height,
              fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily,
              color: cs.color, backgroundColor: cs.backgroundColor,
              padding: cs.padding, margin: cs.margin,
              paddingTop: cs.paddingTop, paddingRight: cs.paddingRight,
              paddingBottom: cs.paddingBottom, paddingLeft: cs.paddingLeft,
              marginTop: cs.marginTop, marginRight: cs.marginRight,
              marginBottom: cs.marginBottom, marginLeft: cs.marginLeft,
              borderRadius: cs.borderRadius, boxShadow: cs.boxShadow,
              opacity: cs.opacity, position: cs.position,
              left: cs.left, top: cs.top,
              display: cs.display, textAlign: cs.textAlign,
              lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing
            },
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
          }
        });
      } catch (e) { /* ignore */ }
    } else if (selectedElements.length > 1) {
      // 多选模式 — 隐藏单元素工具栏和 resize，显示多选信息
      if (window.HVE_Resize) {
        window.HVE_Resize.detach();
      }
      if (window.HVE_Toolbar) {
        window.HVE_Toolbar.hide();
      }
      showMultiSelectInfo();
      document.dispatchEvent(new CustomEvent('hve-multi-selected', {
        detail: { elements: [...selectedElements] }
      }));
    } else {
      deselectAll();
    }
  }

  // ========== 多选信息提示 ==========

  let multiSelectToast = null;

  function showMultiSelectInfo() {
    hideMultiSelectInfo();
    multiSelectToast = document.createElement('div');
    multiSelectToast.setAttribute('data-hve-editor', 'true');
    multiSelectToast.setAttribute('data-hve-multi-toast', 'true');
    const count = selectedElements.length;
    multiSelectToast.innerHTML = `
      <div class="hve-multi-info-row">
        <span class="hve-multi-dot"></span>
        <span>已选中 <b>${count}</b> 个元素</span>
      </div>
      <div class="hve-multi-actions">
        <button data-multi-action="align-left" title="批量左对齐">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </button>
        <button data-multi-action="align-center" title="批量居中">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <button data-multi-action="align-right" title="批量右对齐">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span class="hve-multi-sep"></span>
        <button data-multi-action="same-width" title="统一宽度">W</button>
        <button data-multi-action="same-height" title="统一高度">H</button>
        <span class="hve-multi-sep"></span>
        <button data-multi-action="copy-style" title="复制样式 (⌘⇧C)">🎨</button>
        <button data-multi-action="paste-style" title="粘贴样式 (⌘⇧V)">🖌️</button>
        <span class="hve-multi-sep"></span>
        <button data-multi-action="delete" title="批量删除 (Del)" class="hve-multi-btn-danger">🗑️</button>
      </div>
      <div class="hve-multi-hint">拖拽移动 · 方向键微调 · Esc 取消</div>
    `;

    // 事件绑定
    multiSelectToast.addEventListener('mousedown', (e) => e.preventDefault());
    multiSelectToast.addEventListener('click', onMultiActionClick);
    document.body.appendChild(multiSelectToast);
  }

  function onMultiActionClick(e) {
    const btn = e.target.closest('[data-multi-action]');
    if (!btn) return;
    e.stopPropagation();

    const action = btn.dataset.multiAction;
    const elements = [...selectedElements];
    if (elements.length === 0) return;

    switch (action) {
      case 'align-left':
        batchSetStyle(elements, 'textAlign', 'left');
        break;
      case 'align-center':
        batchSetStyle(elements, 'textAlign', 'center');
        break;
      case 'align-right':
        batchSetStyle(elements, 'textAlign', 'right');
        break;
      case 'same-width': {
        // 取第一个元素的宽度作为标准
        const refWidth = elements[0].getBoundingClientRect().width;
        batchSetStyle(elements, 'width', refWidth + 'px');
        break;
      }
      case 'same-height': {
        const refHeight = elements[0].getBoundingClientRect().height;
        batchSetStyle(elements, 'height', refHeight + 'px');
        break;
      }
      case 'copy-style':
        if (window.HVE_ContextMenu) {
          window.HVE_ContextMenu.copyStyle(elements[0]);
        }
        break;
      case 'paste-style':
        if (window.HVE_ContextMenu?.getCopiedStyle()) {
          window.HVE_ContextMenu.pasteStyle(elements);
        }
        break;
      case 'delete': {
        const deletable = elements.filter(el => !el.hasAttribute('data-hve-locked'));
        if (deletable.length === 0) {
          if (window.HVE_Core) window.HVE_Core.showToast('元素已锁定，无法删除 🔒', 'info');
          return;
        }
        for (const el of deletable) {
          if (window.HVE_History) {
            window.HVE_History.record({
              type: 'dom', element: el,
              before: { action: 'remove', html: el.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(el.parentElement) },
              after: { action: 'remove' },
              description: '批量删除元素'
            });
          }
          el.remove();
        }
        deselectAll();
        break;
      }
    }
  }

  function batchSetStyle(elements, prop, value) {
    for (const el of elements) {
      if (window.HVE_History) {
        window.HVE_History.record({
          type: 'style', element: el,
          before: { style: { [prop]: el.style[prop] || '' } },
          after: { style: { [prop]: value } },
          description: '批量修改样式'
        });
      }
      el.style[prop] = value;
    }
    const actionNames = {
      textAlign: '对齐方式',
      width: '宽度',
      height: '高度'
    };
    if (window.HVE_Core) {
      window.HVE_Core.showToast(`已批量设置${actionNames[prop] || prop} ✓`, 'success');
    }
  }

  function hideMultiSelectInfo() {
    if (multiSelectToast && multiSelectToast.parentNode) {
      multiSelectToast.remove();
    }
    multiSelectToast = null;
  }

  // ========== Hover ==========

  function showHover(el) {
    if (el && !selectedElements.includes(el)) {
      el.setAttribute('data-hve-hovered', 'true');
    }
  }

  function clearHover() {
    if (hoveredElement) {
      hoveredElement.removeAttribute('data-hve-hovered');
      hoveredElement = null;
    }
  }

  // ========== 公共 API ==========

  function getSelected() {
    return selectedElement;
  }

  function getSelectedElements() {
    return [...selectedElements];
  }

  function getSelectionCount() {
    return selectedElements.length;
  }

  function isMultiSelected() {
    return selectedElements.length > 1;
  }

  function isElementSelected() {
    return selectedElements.length > 0;
  }

  function isMarquee() {
    return isMarqueeSelecting;
  }

  return {
    activate,
    deactivate,
    select,
    selectParent,
    deselect,
    deselectAll,
    addToSelection,
    removeFromSelection,
    getSelected,
    getSelectedElements,
    getSelectionCount,
    isMultiSelected,
    isElementSelected,
    isEditorElement,
    isSelectable,
    isMarquee,
    hideMultiSelectInfo
  };
})();
