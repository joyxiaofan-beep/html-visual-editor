// page-sorter.js — 多页HTML页面拖拽排序（类似PPT幻灯片排序）
window.HVE_PageSorter = (function () {
  let isActive = false;
  let sorterPanel = null;
  let pages = [];
  let dragItem = null;
  let dragPlaceholder = null;
  let dragStartIdx = -1;

  function activate() {
    isActive = true;
  }

  function deactivate() {
    isActive = false;
    hideSorter();
  }

  /**
   * 检测页面中的"页面"元素
   * 支持多种常见多页结构：
   * 1. .slide / .page / .section 类名
   * 2. scroll-snap 子元素
   * 3. 100vh 高度的直接子元素
   */
  function detectPages() {
    pages = [];

    // 策略1: 查找有 scroll-snap-align 的元素
    const snapEls = document.querySelectorAll('[style*="scroll-snap-align"], .slide, .page, .section-page');
    if (snapEls.length > 1) {
      snapEls.forEach(el => {
        if (!el.hasAttribute('data-hve-editor')) pages.push(el);
      });
      if (pages.length > 1) return pages;
      pages = [];
    }

    // 策略2: 查找 class 包含 slide/page 的元素
    const classPatterns = ['slide', 'page', 'section'];
    for (const pattern of classPatterns) {
      const els = document.querySelectorAll(`[class*="${pattern}"]`);
      const filtered = [];
      els.forEach(el => {
        if (el.hasAttribute('data-hve-editor')) return;
        // 只取同级元素
        const classStr = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
        const classes = classStr.split(/\s+/);
        if (classes.some(c => c.toLowerCase().includes(pattern) && !c.toLowerCase().includes('wrapper') && !c.toLowerCase().includes('container'))) {
          filtered.push(el);
        }
      });
      // 要有共同父元素
      if (filtered.length > 2) {
        const parent = filtered[0].parentElement;
        const sameParent = filtered.filter(el => el.parentElement === parent);
        if (sameParent.length > 2) {
          pages = sameParent;
          return pages;
        }
      }
    }

    // 策略3: 查找 100vh 高度的直接子元素
    const body = document.body;
    const wrapper = body.querySelector('.slides-wrapper, .pages-wrapper, .swiper-wrapper') || body;
    const children = Array.from(wrapper.children).filter(el => {
      if (el.hasAttribute('data-hve-editor')) return false;
      const cs = getComputedStyle(el);
      const h = parseFloat(cs.height);
      const vh = window.innerHeight;
      return Math.abs(h - vh) < 50; // 接近 100vh
    });
    if (children.length > 1) {
      pages = children;
      return pages;
    }

    return pages;
  }

  function showSorter() {
    if (!isActive) return;

    detectPages();
    if (pages.length < 2) {
      if (window.HVE_Core) {
        window.HVE_Core.showToast('未检测到多页结构（需要 ≥2 页）', 'info');
      }
      return;
    }

    hideSorter();

    sorterPanel = document.createElement('div');
    sorterPanel.setAttribute('data-hve-editor', 'true');
    sorterPanel.setAttribute('data-hve-page-sorter', 'true');

    const header = document.createElement('div');
    header.className = 'hve-ps-header';
    header.innerHTML = `
      <span class="hve-ps-title">📄 页面排序</span>
      <span class="hve-ps-count">${pages.length} 页</span>
      <button class="hve-ps-close" title="关闭">✕</button>
    `;
    header.querySelector('.hve-ps-close').addEventListener('click', hideSorter);
    sorterPanel.appendChild(header);

    const list = document.createElement('div');
    list.className = 'hve-ps-list';

    pages.forEach((page, idx) => {
      const item = createPageItem(page, idx);
      list.appendChild(item);
    });

    sorterPanel.appendChild(list);
    document.body.appendChild(sorterPanel);

    // 使面板可拖拽
    makePanelDraggable(sorterPanel, header);
  }

  function createPageItem(page, idx) {
    const item = document.createElement('div');
    item.className = 'hve-ps-item';
    item.setAttribute('data-page-index', idx);
    item.draggable = true;

    // 生成缩略图（通过 canvas 截图或 CSS 缩小）
    const thumb = document.createElement('div');
    thumb.className = 'hve-ps-thumb';
    // 用 CSS 缩小 + overflow hidden 实现缩略图效果
    const clone = page.cloneNode(true);
    // 清理编辑器相关属性
    clone.querySelectorAll('[data-hve-editor]').forEach(el => el.remove());
    clone.removeAttribute('data-hve-selected');
    clone.removeAttribute('data-hve-hovered');
    clone.style.cssText = page.style.cssText;
    clone.style.position = 'absolute';
    clone.style.top = '0';
    clone.style.left = '0';
    clone.style.width = page.offsetWidth + 'px';
    clone.style.height = page.offsetHeight + 'px';
    clone.style.transform = 'none';
    clone.style.pointerEvents = 'none';
    clone.style.outline = 'none';

    const scaleX = 160 / page.offsetWidth;
    const scaleY = 90 / page.offsetHeight;
    const scale = Math.min(scaleX, scaleY);

    thumb.style.width = '160px';
    thumb.style.height = '90px';
    thumb.style.overflow = 'hidden';
    thumb.style.position = 'relative';
    thumb.style.borderRadius = '6px';
    thumb.style.border = '1px solid #E8E5E0';
    thumb.style.background = '#fff';

    const inner = document.createElement('div');
    inner.style.cssText = `transform:scale(${scale});transform-origin:top left;width:${page.offsetWidth}px;height:${page.offsetHeight}px;pointer-events:none;overflow:hidden;`;
    inner.appendChild(clone);
    thumb.appendChild(inner);

    const info = document.createElement('div');
    info.className = 'hve-ps-info';

    // 提取页面标题
    const title = getPageTitle(page, idx);
    info.innerHTML = `
      <span class="hve-ps-num">${idx + 1}</span>
      <span class="hve-ps-name" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'hve-ps-actions';
    actions.innerHTML = `
      <button class="hve-ps-btn" data-act="goto" title="跳转到此页">👁</button>
      <button class="hve-ps-btn" data-act="up" title="上移" ${idx === 0 ? 'disabled' : ''}>↑</button>
      <button class="hve-ps-btn" data-act="down" title="下移" ${idx === pages.length - 1 ? 'disabled' : ''}>↓</button>
    `;

    actions.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      e.stopPropagation();
      const act = btn.dataset.act;
      const currentIdx = parseInt(item.dataset.pageIndex);

      if (act === 'goto') {
        pages[currentIdx]?.scrollIntoView({ behavior: 'smooth' });
      } else if (act === 'up' && currentIdx > 0) {
        swapPages(currentIdx, currentIdx - 1);
      } else if (act === 'down' && currentIdx < pages.length - 1) {
        swapPages(currentIdx, currentIdx + 1);
      }
    });

    item.appendChild(thumb);
    const rightCol = document.createElement('div');
    rightCol.className = 'hve-ps-right';
    rightCol.appendChild(info);
    rightCol.appendChild(actions);
    item.appendChild(rightCol);

    // 拖拽排序事件
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragend', onDragEnd);
    item.addEventListener('dragover', onDragOver);
    item.addEventListener('dragenter', onDragEnter);
    item.addEventListener('dragleave', onDragLeave);
    item.addEventListener('drop', onDrop);

    // 点击高亮
    item.addEventListener('click', () => {
      pages[idx]?.scrollIntoView({ behavior: 'smooth' });
      // 高亮当前项
      sorterPanel.querySelectorAll('.hve-ps-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });

    return item;
  }

  function getPageTitle(page, idx) {
    // 尝试提取标题
    const h = page.querySelector('h1, h2, h3, .page-title, .slide-title');
    if (h && h.textContent.trim()) {
      return h.textContent.trim().substring(0, 30);
    }
    // 检查 id
    if (page.id) return page.id;
    // 检查 class
    const clsStr = typeof page.className === 'string' ? page.className : (page.className?.baseVal || '');
    const cls = clsStr.split(/\s+/).filter(c => c && !c.startsWith('hve'));
    if (cls.length > 0) return cls.join(' ').substring(0, 25);
    return `第 ${idx + 1} 页`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function swapPages(idxA, idxB) {
    if (idxA === idxB) return;
    if (idxA < 0 || idxB < 0 || idxA >= pages.length || idxB >= pages.length) return;

    const parent = pages[0].parentElement;
    const elA = pages[idxA];
    const elB = pages[idxB];

    // 记录历史
    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'dom',
        element: elA,
        before: {
          action: 'swap',
          indexA: idxA,
          indexB: idxB,
          parentSelector: window.HVE_History.getUniqueSelector(parent)
        },
        after: {
          action: 'swap',
          indexA: idxB,
          indexB: idxA,
          parentSelector: window.HVE_History.getUniqueSelector(parent)
        },
        description: `移动页面 ${idxA + 1} → ${idxB + 1}`
      });
    }

    // DOM 交换
    if (idxA < idxB) {
      parent.insertBefore(elB, elA);
    } else {
      parent.insertBefore(elA, elB);
    }

    // 重新检测并刷新面板
    refreshSorter();
  }

  function movePage(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= pages.length || toIdx >= pages.length) return;

    const parent = pages[0].parentElement;
    const el = pages[fromIdx];

    // 记录历史
    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'dom',
        element: el,
        before: {
          action: 'reorder',
          fromIndex: fromIdx,
          toIndex: toIdx,
          parentSelector: window.HVE_History.getUniqueSelector(parent)
        },
        after: {
          action: 'reorder',
          fromIndex: toIdx,
          toIndex: fromIdx,
          parentSelector: window.HVE_History.getUniqueSelector(parent)
        },
        description: `移动页面 ${fromIdx + 1} → ${toIdx + 1}`
      });
    }

    // DOM 移动
    if (toIdx < fromIdx) {
      parent.insertBefore(el, pages[toIdx]);
    } else {
      const ref = pages[toIdx].nextSibling;
      parent.insertBefore(el, ref);
    }

    refreshSorter();
  }

  function refreshSorter() {
    if (!sorterPanel) return;
    detectPages();
    const list = sorterPanel.querySelector('.hve-ps-list');
    if (!list) return;
    list.innerHTML = '';
    pages.forEach((page, idx) => {
      list.appendChild(createPageItem(page, idx));
    });
    // 更新计数
    const countEl = sorterPanel.querySelector('.hve-ps-count');
    if (countEl) countEl.textContent = pages.length + ' 页';
  }

  // === 拖拽排序 ===
  function onDragStart(e) {
    dragItem = e.currentTarget;
    dragStartIdx = parseInt(dragItem.dataset.pageIndex);
    dragItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragStartIdx);
  }

  function onDragEnd(e) {
    if (dragItem) dragItem.classList.remove('dragging');
    dragItem = null;
    dragStartIdx = -1;
    // 清除所有 drag-over 样式
    if (sorterPanel) {
      sorterPanel.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDragEnter(e) {
    e.preventDefault();
    const target = e.currentTarget;
    if (target !== dragItem) {
      target.classList.add('drag-over');
    }
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    const target = e.currentTarget;
    target.classList.remove('drag-over');
    const toIdx = parseInt(target.dataset.pageIndex);
    if (dragStartIdx >= 0 && toIdx >= 0 && dragStartIdx !== toIdx) {
      movePage(dragStartIdx, toIdx);
    }
  }

  // === 面板拖拽 ===
  function makePanelDraggable(panel, handle) {
    let isDrag = false, sx, sy, ox, oy;
    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.hve-ps-close')) return;
      isDrag = true;
      sx = e.clientX;
      sy = e.clientY;
      const rect = panel.getBoundingClientRect();
      ox = rect.left;
      oy = rect.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    function onMove(e) {
      if (!isDrag) return;
      panel.style.left = (ox + e.clientX - sx) + 'px';
      panel.style.top = (oy + e.clientY - sy) + 'px';
      panel.style.right = 'auto';
    }
    function onUp() {
      isDrag = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  }

  function hideSorter() {
    if (sorterPanel && sorterPanel.parentNode) sorterPanel.remove();
    sorterPanel = null;
    pages = [];
  }

  function isVisible() {
    return sorterPanel !== null;
  }

  function toggleSorter() {
    if (isVisible()) {
      hideSorter();
    } else {
      showSorter();
    }
  }

  return { activate, deactivate, showSorter, hideSorter, toggleSorter, isVisible, detectPages };
})();
