// image-handler.js — 图片粘贴 & 拖拽插入（增强版）
window.HVE_ImageHandler = (function () {
  let isActive = false;
  let dropOverlay = null;    // 拖拽进入时的视觉提示层
  let dropIndicator = null;  // 插入位置指示线

  function activate() {
    isActive = true;
    document.addEventListener('paste', onPaste, true);
    document.addEventListener('dragenter', onDragEnter, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('dragleave', onDragLeave, true);
    document.addEventListener('drop', onDrop, true);
  }

  function deactivate() {
    isActive = false;
    document.removeEventListener('paste', onPaste, true);
    document.removeEventListener('dragenter', onDragEnter, true);
    document.removeEventListener('dragover', onDragOver, true);
    document.removeEventListener('dragleave', onDragLeave, true);
    document.removeEventListener('drop', onDrop, true);
    hideDropOverlay();
    hideDropIndicator();
  }

  // ========== 粘贴处理 ==========

  function onPaste(e) {
    if (!isActive) return;

    // 如果正在文本编辑中，检查剪贴板是否有图片
    // 文本编辑中粘贴图片 → 插入到正在编辑的文本元素后面
    const isTextEditing = window.HVE_TextEdit && window.HVE_TextEdit.isEditing();

    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    // 检查是否有图片
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        hasImage = true;
        break;
      }
    }
    if (!hasImage) return;

    // 有图片 → 拦截粘贴
    e.preventDefault();
    e.stopPropagation();

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          insertImageFromFile(file);
        }
        return; // 只处理第一张图片
      }
    }
  }

  // ========== 拖拽视觉反馈 ==========

  let dragEnterCount = 0; // 处理嵌套 dragenter/dragleave 计数

  function onDragEnter(e) {
    if (!isActive) return;
    if (!hasImageFiles(e.dataTransfer)) return;

    e.preventDefault();
    dragEnterCount++;

    if (dragEnterCount === 1) {
      showDropOverlay();
    }
  }

  function onDragOver(e) {
    if (!isActive) return;
    if (!hasImageFiles(e.dataTransfer)) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    // 检查是否悬停在内容容器上
    const target = document.elementFromPoint(e.clientX, e.clientY);
    updateBoxDropHover(target);

    // 更新插入位置指示线
    updateDropIndicator(e.clientX, e.clientY);
  }

  function onDragLeave(e) {
    if (!isActive) return;
    dragEnterCount--;

    if (dragEnterCount <= 0) {
      dragEnterCount = 0;
      hideDropOverlay();
      hideDropIndicator();
      clearBoxDropHover();
    }
  }

  function onDrop(e) {
    if (!isActive) return;

    dragEnterCount = 0;
    hideDropOverlay();
    hideDropIndicator();
    clearBoxDropHover();

    if (window.HVE_Selector && window.HVE_Selector.isEditorElement(e.target)) return;

    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || files.length === 0) return;

    let hasHandled = false;
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        if (!hasHandled) {
          e.preventDefault();
          e.stopPropagation();
          hasHandled = true;
        }
        insertImageFromFile(files[i], e.clientX, e.clientY);
      }
    }
  }

  function hasImageFiles(dt) {
    if (!dt) return false;
    // 检查 types 中是否有 Files
    if (dt.types && dt.types.includes('Files')) return true;
    // 检查 items
    if (dt.items) {
      for (let i = 0; i < dt.items.length; i++) {
        if (dt.items[i].type.startsWith('image/')) return true;
      }
    }
    return false;
  }

  // ========== 拖拽覆盖层 ==========

  function showDropOverlay() {
    hideDropOverlay();
    dropOverlay = document.createElement('div');
    dropOverlay.setAttribute('data-hve-editor', 'true');
    dropOverlay.setAttribute('data-hve-drop-overlay', 'true');
    dropOverlay.innerHTML = `
      <div class="hve-drop-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span>松开鼠标插入图片</span>
      </div>
    `;
    document.body.appendChild(dropOverlay);
  }

  function hideDropOverlay() {
    if (dropOverlay && dropOverlay.parentNode) {
      dropOverlay.remove();
    }
    dropOverlay = null;
  }

  // ========== 插入位置指示线 ==========

  function updateDropIndicator(x, y) {
    // 找到鼠标位置最近的元素，显示一条水平线指示插入位置
    const target = document.elementFromPoint(x, y);
    if (!target || target === document.body || target === document.documentElement) {
      hideDropIndicator();
      return;
    }

    // 跳过编辑器自身元素
    if (window.HVE_Selector && window.HVE_Selector.isEditorElement(target)) return;

    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertBefore = y < midY;

    if (!dropIndicator) {
      dropIndicator = document.createElement('div');
      dropIndicator.setAttribute('data-hve-editor', 'true');
      dropIndicator.setAttribute('data-hve-drop-indicator', 'true');
      document.body.appendChild(dropIndicator);
    }

    const lineY = insertBefore ? rect.top : rect.bottom;
    dropIndicator.style.cssText = `
      position:fixed;left:${rect.left}px;top:${lineY - 1.5}px;
      width:${rect.width}px;height:3px;
      background:linear-gradient(90deg,transparent,#D97706,#D97706,transparent);
      z-index:2147483646;pointer-events:none;border-radius:2px;
      transition:top 0.15s ease,left 0.15s ease,width 0.15s ease;
    `;
  }

  function hideDropIndicator() {
    if (dropIndicator && dropIndicator.parentNode) {
      dropIndicator.remove();
    }
    dropIndicator = null;
  }

  // ========== 图片插入逻辑 ==========

  function insertImageFromFile(file, x, y) {
    const reader = new FileReader();
    reader.onload = function (ev) {
      const dataUrl = ev.target.result;
      insertImageElement(dataUrl, file.name, x, y);
    };
    reader.readAsDataURL(file);
  }

  function insertImageElement(src, alt, x, y) {
    const selected = window.HVE_Selector ? window.HVE_Selector.getSelected() : null;

    // 创建新图片元素
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || 'pasted-image';
    img.style.cssText = 'max-width:100%;height:auto;margin:8px 0;display:block;cursor:move;border-radius:8px;';

    // ★ 核心逻辑：确定插入位置（优先插入到内容容器内部）
    if (x !== undefined && y !== undefined) {
      // 有坐标（来自拖拽 drop）→ 先检查 drop 目标是否在内容容器内
      const dropTarget = document.elementFromPoint(x, y);
      const box = dropTarget && window.HVE_InsertPanel ? window.HVE_InsertPanel.getContentBox(dropTarget) : null;
      if (box) {
        // 拖拽到内容容器内 → 插入到容器内部
        window.HVE_InsertPanel.addToBox(box, img);
      } else {
        insertAtPosition(img, x, y);
      }
    } else if (selected && window.HVE_InsertPanel && window.HVE_InsertPanel.isContentBox(selected)) {
      // 选中的是内容容器（或容器内部元素）→ 插入到容器内部
      const box = window.HVE_InsertPanel.getContentBox(selected);
      if (box) {
        window.HVE_InsertPanel.addToBox(box, img);
      } else {
        findBestContainerInView().appendChild(img);
      }
    } else if (selected && selected.parentNode) {
      // 有选中元素 → 找到安全的插入位置（避免插入到表格内部等不合适位置）
      insertNearSelected(img, selected);
    } else {
      // 没有选中元素 → 检查视口中是否有内容容器，否则插入到 slide/section 中
      const container = findBestContainerInView();
      container.appendChild(img);
    }

    // 记录历史（如果不是通过 addToBox 插入的，addToBox 自己会记录）
    const insertedViaBox = img.parentElement && img.parentElement.hasAttribute('data-hve-content-box');
    if (!insertedViaBox && window.HVE_History) {
      window.HVE_History.record({
        type: 'dom',
        element: img,
        before: { action: 'insert' },
        after: {
          action: 'insert',
          html: img.outerHTML,
          parentSelector: window.HVE_History.getUniqueSelector(img.parentElement),
        },
        description: '插入图片'
      });
    }

    // 选中新插入的图片
    if (window.HVE_Selector) {
      window.HVE_Selector.select(img);
    }

    if (window.HVE_Core) {
      window.HVE_Core.showToast('图片已插入 ✓', 'success');
    }
  }

  /**
   * 在选中元素附近找到安全的插入位置。
   * 避免插入到 table/tr/thead/tbody 等结构性元素内部，
   * 而是向上找到块级父容器后插入。
   */
  function insertNearSelected(newEl, selected) {
    // 不适合直接在其旁边插入 <img> 的标签（表格内部结构）
    const UNSAFE_TAGS = new Set(['TD', 'TH', 'TR', 'THEAD', 'TBODY', 'TFOOT', 'COLGROUP', 'COL', 'CAPTION']);

    // 检查选中元素或其直接父级是否在表格结构中
    if (UNSAFE_TAGS.has(selected.tagName)) {
      // 选中元素在表格内部 → 找到最近的 <table>，将图片插在表格之后
      const table = selected.closest('table');
      if (table && table.parentNode) {
        table.parentNode.insertBefore(newEl, table.nextSibling);
        return;
      }
    }

    // 检查父容器是否是表格结构
    const UNSAFE_PARENTS = new Set(['TR', 'THEAD', 'TBODY', 'TFOOT', 'TABLE', 'COLGROUP']);
    if (selected.parentNode && UNSAFE_PARENTS.has(selected.parentNode.tagName)) {
      const table = selected.closest('table') || selected.parentNode;
      if (table.parentNode) {
        table.parentNode.insertBefore(newEl, table.nextSibling);
        return;
      }
    }

    // 安全的位置：直接插在选中元素后面
    selected.parentNode.insertBefore(newEl, selected.nextSibling);
  }

  /**
   * 根据鼠标坐标找到最近的元素，在其前面或后面插入
   */
  function insertAtPosition(newEl, x, y) {
    const target = document.elementFromPoint(x, y);
    if (!target || target === document.body || target === document.documentElement) {
      findBestContainerInView().appendChild(newEl);
      return;
    }

    // 跳过编辑器自身元素
    if (window.HVE_Selector && window.HVE_Selector.isEditorElement(target)) {
      findBestContainerInView().appendChild(newEl);
      return;
    }

    // 找到安全的插入目标（不在表格内部结构中）
    const safeTarget = findSafeInsertTarget(target);
    const rect = safeTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (y < midY) {
      safeTarget.parentNode.insertBefore(newEl, safeTarget);
    } else {
      safeTarget.parentNode.insertBefore(newEl, safeTarget.nextSibling);
    }
  }

  /**
   * 从目标元素向上找到一个安全的插入位置
   * 确保不会把 <img> 插入到 <tr>/<thead>/<tbody> 等内部
   */
  function findSafeInsertTarget(el) {
    const UNSAFE_PARENTS = new Set(['TR', 'THEAD', 'TBODY', 'TFOOT', 'COLGROUP']);
    let current = el;

    while (current.parentNode && UNSAFE_PARENTS.has(current.parentNode.tagName)) {
      current = current.parentNode;
    }

    // 如果当前元素就是 td/th，往上到 table 级
    if (current.tagName === 'TD' || current.tagName === 'TH') {
      // 从 td → tr → thead/tbody → table
      let table = current.closest('table');
      if (table) return table;
    }

    return current;
  }

  /**
   * 找到当前视口中最合适的容器来插入图片。
   * 优先寻找当前可见的 slide/section，确保图片随页面一起滚动。
   */
  function findBestContainerInView() {
    // 先尝试从视口中心找到当前可见的内容元素
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const centerEl = document.elementFromPoint(centerX, centerY);

    if (centerEl && centerEl !== document.body && centerEl !== document.documentElement) {
      // 跳过编辑器自身元素
      if (!(window.HVE_Selector && window.HVE_Selector.isEditorElement(centerEl))) {
        // 向上找到合适的容器（slide、section 等）
        const container = findContentContainer(centerEl);
        if (container) return container;
      }
    }

    // 兜底：检查常见容器
    return document.querySelector('main') ||
           document.querySelector('article') ||
           document.querySelector('.content') ||
           document.querySelector('.container') ||
           document.body;
  }

  /**
   * 从一个元素向上查找合适的内容容器
   * 优先找到 slide、section、article 等内容区块，而不是滚动容器或 body
   */
  function findContentContainer(el) {
    // 优先容器标签，按优先级排列
    const CONTENT_SELECTORS = [
      '.slide', '[class*="slide"]',           // PPT/幻灯片页面
      'section', 'article', 'main',           // 语义化内容容器
      '.content', '.page', '[class*="page"]', // 常见内容类名
      '.container', '.wrapper'                // 通用容器
    ];

    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      // 检查这个元素是否匹配内容容器选择器
      for (const selector of CONTENT_SELECTORS) {
        try {
          if (current.matches(selector)) {
            return current;
          }
        } catch (e) { /* 无效选择器忽略 */ }
      }
      current = current.parentElement;
    }

    // 没找到合适的内容容器，回到起始元素的直接父级
    if (el.parentElement && el.parentElement !== document.body) {
      return el.parentElement;
    }

    return null;
  }

  // ========== 内容容器拖拽悬停高亮 ==========

  let hoveredBox = null;

  function updateBoxDropHover(target) {
    const box = target && window.HVE_InsertPanel ? window.HVE_InsertPanel.getContentBox(target) : null;
    if (box !== hoveredBox) {
      clearBoxDropHover();
      if (box) {
        box.classList.add('hve-drop-hover');
        hoveredBox = box;
      }
    }
  }

  function clearBoxDropHover() {
    if (hoveredBox) {
      hoveredBox.classList.remove('hve-drop-hover');
      hoveredBox = null;
    }
    // 兜底清除所有
    document.querySelectorAll('.hve-drop-hover').forEach(el => el.classList.remove('hve-drop-hover'));
  }

  return { activate, deactivate, insertImageElement };
})();
