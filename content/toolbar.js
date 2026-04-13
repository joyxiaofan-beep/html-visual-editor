// toolbar.js — 浮动工具栏 v2（Claude 风格 + 完整富文本功能）
window.HVE_Toolbar = (function () {
  let toolbarEl = null;
  let currentTarget = null;
  let isActive = false;
  let activeDropdown = null;

  function activate() { isActive = true; }

  function deactivate() {
    isActive = false;
    // 先清理格式刷状态（事件监听器、光标、body 属性）
    if (typeof deactivateFormatBrush === 'function') deactivateFormatBrush();
    hide();
    destroyToolbar();
  }

  function createToolbar() {
    if (toolbarEl) return;
    toolbarEl = document.createElement('div');
    toolbarEl.setAttribute('data-hve-editor', 'true');
    toolbarEl.setAttribute('data-hve-toolbar', 'true');

    toolbarEl.innerHTML = `
      <div class="hve-tb-group">
        <button data-action="bold" title="加粗 (⌘B)"><b style="font-size:14px;">B</b></button>
        <button data-action="italic" title="斜体 (⌘I)"><i style="font-size:14px;">I</i></button>
        <button data-action="underline" title="下划线 (⌘U)"><span style="text-decoration:underline;font-size:13px;">U</span></button>
        <button data-action="strikethrough" title="删除线"><span style="text-decoration:line-through;font-size:13px;">S</span></button>
      </div>
      <div class="hve-tb-sep"></div>
      <div class="hve-tb-group">
        <button data-action="font-family-menu" title="字体" style="font-size:11px;width:auto;padding:0 6px;">
          <span class="hve-tb-label" data-role="font-label">字体</span>
          <span style="font-size:9px;margin-left:2px;">▼</span>
        </button>
        <button data-action="font-size-menu" title="字号" style="font-size:12px;width:auto;padding:0 6px;">
          <span class="hve-tb-label">14</span>
          <span style="font-size:9px;margin-left:2px;">▼</span>
        </button>
        <button data-action="heading-menu" title="标题级别" style="font-size:12px;width:auto;padding:0 6px;">
          <span class="hve-tb-label">H</span>
          <span style="font-size:9px;margin-left:2px;">▼</span>
        </button>
      </div>
      <div class="hve-tb-sep"></div>
      <div class="hve-tb-group">
        <button data-action="align-left" title="左对齐">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </button>
        <button data-action="align-center" title="居中">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <button data-action="align-right" title="右对齐">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
      <div class="hve-tb-sep"></div>
      <div class="hve-tb-group">
        <button data-action="color" title="文字颜色" style="position:relative;overflow:visible;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3L4 21h3l2-5h6l2 5h3L12 3z"/></svg>
          <span class="hve-color-indicator" data-role="color-indicator" style="position:absolute;bottom:3px;left:50%;transform:translateX(-50%);width:14px;height:3px;background:#D97706;border-radius:1px;"></span>
        </button>
        <button data-action="bg-color" title="背景颜色" style="position:relative;overflow:visible;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3" fill="#FEF3C7" stroke="#D97706"/></svg>
          <span class="hve-color-indicator" data-role="bg-indicator" style="position:absolute;bottom:3px;left:50%;transform:translateX(-50%);width:14px;height:3px;background:#FEF3C7;border-radius:1px;"></span>
        </button>
      </div>
      <div class="hve-tb-sep"></div>
      <div class="hve-tb-group">
        <button data-action="border-radius-menu" title="圆角">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12V5a2 2 0 012-2h7"/><path d="M21 12v7a2 2 0 01-2 2h-7"/></svg>
        </button>
        <button data-action="shadow-menu" title="阴影">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M21 7v14H7" opacity="0.4"/></svg>
        </button>
        <button data-action="opacity-menu" title="透明度">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" opacity="0.4"/><path d="M12 3a9 9 0 010 18" fill="currentColor" opacity="0.15"/></svg>
        </button>
      </div>
      <div class="hve-tb-sep"></div>
      <div class="hve-tb-group">
        <button data-action="insert-menu" title="插入...">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="hve-tb-sep"></div>
      <div class="hve-tb-group">
        <button data-action="format-brush" title="格式刷 (单击用一次 / 双击连续用)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 3H5a2 2 0 00-2 2v2a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"/><path d="M10 9v5a2 2 0 002 2h0a2 2 0 002-2V9"/><line x1="12" y1="16" x2="12" y2="21"/></svg>
        </button>
      </div>
      <div class="hve-tb-sep"></div>
      <div class="hve-tb-group">
        <button data-action="duplicate" title="复制元素">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button data-action="move-up" title="上移层级">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="18,15 12,9 6,15"/></svg>
        </button>
        <button data-action="move-down" title="下移层级">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6,9 12,15 18,9"/></svg>
        </button>
        <button data-action="lock" title="锁定/解锁 (⌘L)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </button>
        <button data-action="delete" title="删除 (Del)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
      <div class="hve-tb-sep"></div>
      <div class="hve-tb-group">
        <button data-action="page-sorter" title="页面排序 (⌘⇧P)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="8" height="5" rx="1"/><rect x="2" y="10" width="8" height="5" rx="1"/><rect x="2" y="17" width="8" height="5" rx="1"/><path d="M14 5h7M14 12h7M14 19h7"/></svg>
        </button>
        <button data-action="canvas-mode" title="画板模式 — Figma 风格自由画布">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="2" fill="currentColor"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>
        </button>
        <button data-action="pdf-paginator" title="PDF 分页预测与导出">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="6" y1="13" x2="18" y2="13" stroke-dasharray="3 2"/><line x1="6" y1="17" x2="18" y2="17" stroke-dasharray="3 2"/></svg>
        </button>
        <button data-action="chart-typo" title="图表排版工具">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17.5 14v7M14.5 17.5h6"/></svg>
        </button>
        <button data-action="undo" title="撤销 (⌘Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/></svg>
        </button>
        <button data-action="redo" title="重做 (⌘⇧Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-5.64-11.36L23 10"/></svg>
        </button>
      </div>
    `;

    toolbarEl.addEventListener('mousedown', (e) => {
      // 不阻止 color input 和颜色面板的默认行为
      if (e.target.tagName === 'INPUT') return;
      if (e.target.closest('[data-hve-color-panel]')) return;
      e.preventDefault();
    });
    toolbarEl.addEventListener('click', onToolbarClick);
    document.body.appendChild(toolbarEl);
  }

  function closeDropdown() {
    if (activeDropdown) {
      activeDropdown.remove();
      activeDropdown = null;
    }
  }

  function showDropdown(anchorBtn, items) {
    closeDropdown();
    const dd = document.createElement('div');
    dd.setAttribute('data-hve-editor', 'true');
    dd.setAttribute('data-hve-dropdown', 'true');
    items.forEach(item => {
      if (item.divider) {
        const d = document.createElement('div');
        d.className = 'hve-dd-divider';
        dd.appendChild(d);
        return;
      }
      const el = document.createElement('div');
      el.className = 'hve-dd-item';
      el.innerHTML = `${item.icon ? `<span class="hve-dd-icon">${item.icon}</span>` : ''}${item.label}`;
      if (item.style) el.style.cssText += item.style;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        closeDropdown();
      });
      dd.appendChild(el);
    });
    // 将下拉菜单挂到 document.body（position:fixed 视口坐标）
    const btnRect = anchorBtn.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.top = (btnRect.bottom + 4) + 'px';
    dd.style.left = (btnRect.left + btnRect.width / 2) + 'px';
    dd.style.transform = 'translateX(-50%)';
    dd.style.margin = '0';
    document.body.appendChild(dd);
    activeDropdown = dd;
    setTimeout(() => {
      document.addEventListener('click', closeDropdown, { once: true });
    }, 0);
  }

  function onToolbarClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const action = btn.dataset.action;
    const el = currentTarget;

    switch (action) {
      case 'bold':
        applyFormat('bold');
        break;
      case 'italic':
        applyFormat('italic');
        break;
      case 'underline':
        applyFormat('underline');
        break;
      case 'strikethrough':
        applyFormat('strikeThrough');
        break;

      case 'font-size-menu':
        showDropdown(btn, [10,12,14,16,18,20,24,28,32,40,48].map(s => ({
          label: `${s}px`,
          style: `font-size:${Math.min(s,20)}px;`,
          action: () => {
            if (el) {
              if (window.HVE_TextEdit && window.HVE_TextEdit.isEditing()) {
                document.execCommand('fontSize', false, '7');
                const fontEls = el.querySelectorAll('font[size="7"]');
                fontEls.forEach(f => { f.removeAttribute('size'); f.style.fontSize = s + 'px'; });
              } else {
                recordStyleChange(el, 'fontSize', s + 'px');
                el.style.fontSize = s + 'px';
              }
            }
          }
        })));
        break;

      case 'font-family-menu': {
        const fonts = [
          { label: '系统默认', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
          { label: 'PingFang SC', value: '"PingFang SC", sans-serif' },
          { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
          { label: '思源黑体', value: '"Source Han Sans SC", "Noto Sans SC", sans-serif' },
          { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
          { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
          { label: 'Georgia', value: 'Georgia, serif' },
          { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
          { label: 'Courier New', value: '"Courier New", Courier, monospace' },
          { label: 'SF Mono', value: '"SF Mono", "Fira Code", monospace' },
          { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
          { label: '宋体', value: 'SimSun, serif' },
          { label: '楷体', value: 'KaiTi, serif' },
        ];
        showDropdown(btn, fonts.map(f => ({
          label: f.label,
          style: `font-family:${f.value};`,
          action: () => {
            if (el) {
              recordStyleChange(el, 'fontFamily', f.value);
              el.style.fontFamily = f.value;
              // 更新按钮标签
              const label = toolbarEl?.querySelector('[data-role="font-label"]');
              if (label) label.textContent = f.label.length > 4 ? f.label.substring(0, 4) + '…' : f.label;
            }
          }
        })));
        break;
      }

      case 'heading-menu':
        showDropdown(btn, [
          { label: '正文', icon: 'P', action: () => changeTag(el, 'P') },
          { label: '标题 1', icon: 'H1', style: 'font-size:18px;font-weight:700;', action: () => changeTag(el, 'H1') },
          { label: '标题 2', icon: 'H2', style: 'font-size:16px;font-weight:700;', action: () => changeTag(el, 'H2') },
          { label: '标题 3', icon: 'H3', style: 'font-size:15px;font-weight:600;', action: () => changeTag(el, 'H3') },
          { label: '标题 4', icon: 'H4', style: 'font-size:14px;font-weight:600;', action: () => changeTag(el, 'H4') },
        ]);
        break;

      case 'align-left':
        if (el) { recordStyleChange(el, 'textAlign', 'left'); el.style.textAlign = 'left'; }
        break;
      case 'align-center':
        if (el) { recordStyleChange(el, 'textAlign', 'center'); el.style.textAlign = 'center'; }
        break;
      case 'align-right':
        if (el) { recordStyleChange(el, 'textAlign', 'right'); el.style.textAlign = 'right'; }
        break;

      case 'color': {
        openColorPicker(el, 'text');
        break;
      }
      case 'bg-color': {
        openColorPicker(el, 'bg');
        break;
      }

      case 'insert-menu':
        showDropdown(btn, [
          { label: '文本框', icon: '📝', action: () => insertElement('text') },
          { label: '标题', icon: '🔤', action: () => insertElement('heading') },
          { divider: true },
          { label: '表格', icon: '📊', action: () => showTableDialog() },
          { label: '图片', icon: '🖼️', action: () => insertElement('image') },
          { divider: true },
          { label: '按钮', icon: '🔘', action: () => insertElement('button') },
          { label: '分隔线', icon: '➖', action: () => insertElement('divider') },
          { label: '容器', icon: '📦', action: () => insertElement('container') },
          { label: '链接', icon: '🔗', action: () => showLinkDialog() },
        ]);
        break;

      case 'duplicate':
        if (el && el.parentNode) {
          const clone = el.cloneNode(true);
          clone.removeAttribute('data-hve-selected');
          clone.removeAttribute('data-hve-multi-selected');
          clone.removeAttribute('data-hve-id');
          el.parentNode.insertBefore(clone, el.nextSibling);
          if (window.HVE_History) {
            window.HVE_History.record({
              type: 'dom', element: clone,
              before: { action: 'insert' },
              after: { action: 'insert', html: clone.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(clone.parentElement) },
              description: '复制元素'
            });
          }
        }
        break;

      case 'move-up':
        if (el && el.previousElementSibling) {
          el.parentNode.insertBefore(el, el.previousElementSibling);
          if (window.HVE_Resize) window.HVE_Resize.attachTo(el);
          positionToolbar(el);
        }
        break;

      case 'move-down':
        if (el && el.nextElementSibling) {
          el.parentNode.insertBefore(el.nextElementSibling, el);
          if (window.HVE_Resize) window.HVE_Resize.attachTo(el);
          positionToolbar(el);
        }
        break;

      case 'delete':
        if (el && el.parentNode) {
          if (window.HVE_History) {
            window.HVE_History.record({
              type: 'dom', element: el,
              before: { action: 'remove', html: el.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(el.parentElement) },
              after: { action: 'remove' },
              description: '删除元素'
            });
          }
          if (window.HVE_Selector) window.HVE_Selector.deselectAll();
          el.remove();
        }
        break;

      case 'lock':
        if (el && window.HVE_ContextMenu) {
          window.HVE_ContextMenu.toggleLock([el]);
        }
        break;

      case 'border-radius-menu':
        showDropdown(btn, [0, 4, 8, 12, 16, 24, 32, 50, 9999].map(r => ({
          label: r === 9999 ? '圆形' : r + 'px',
          icon: `<span style="display:inline-block;width:16px;height:16px;background:#D97706;border-radius:${Math.min(r, 8)}px;"></span>`,
          action: () => {
            if (el) {
              const val = r === 9999 ? '50%' : r + 'px';
              recordStyleChange(el, 'borderRadius', val);
              el.style.borderRadius = val;
            }
          }
        })));
        break;

      case 'shadow-menu':
        showDropdown(btn, [
          { label: '无阴影', value: 'none' },
          { label: '轻微', value: '0 1px 3px rgba(0,0,0,0.12)' },
          { label: '中等', value: '0 4px 12px rgba(0,0,0,0.15)' },
          { label: '明显', value: '0 8px 24px rgba(0,0,0,0.2)' },
          { label: '强烈', value: '0 12px 40px rgba(0,0,0,0.3)' },
          { label: '上浮感', value: '0 20px 60px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)' },
          { label: '内阴影', value: 'inset 0 2px 8px rgba(0,0,0,0.15)' },
          { label: '彩色光晕', value: '0 4px 20px rgba(217,119,6,0.3)' },
        ].map(s => ({
          label: s.label,
          action: () => {
            if (el) {
              recordStyleChange(el, 'boxShadow', s.value);
              el.style.boxShadow = s.value;
            }
          }
        })));
        break;

      case 'opacity-menu':
        showDropdown(btn, [100, 90, 80, 70, 60, 50, 30, 10].map(o => ({
          label: o + '%',
          style: `opacity:${o/100};`,
          action: () => {
            if (el) {
              const val = (o / 100).toString();
              recordStyleChange(el, 'opacity', val);
              el.style.opacity = val;
            }
          }
        })));
        break;

      case 'page-sorter':
        if (window.HVE_PageSorter) window.HVE_PageSorter.toggleSorter();
        break;

      case 'canvas-mode':
        if (window.HVE_Canvas) {
          // 互斥：开启画板前关闭其他面板
          if (!window.HVE_Canvas.isCanvasMode()) {
            if (window.HVE_PDFPaginator?.isActive()) {
              window.HVE_PDFPaginator.deactivate();
              const pb = toolbarEl?.querySelector('[data-action="pdf-paginator"]');
              if (pb) pb.classList.remove('hve-tb-pdf-active');
            }
            if (window.HVE_ChartTypo?.isActive()) {
              window.HVE_ChartTypo.deactivate();
              const cb = toolbarEl?.querySelector('[data-action="chart-typo"]');
              if (cb) cb.classList.remove('hve-tb-chart-active');
            }
          }
          window.HVE_Canvas.toggle();
          // 更新按钮激活态
          const cvsBtn = toolbarEl?.querySelector('[data-action="canvas-mode"]');
          if (cvsBtn) cvsBtn.classList.toggle('hve-tb-canvas-active', window.HVE_Canvas.isCanvasMode());
        }
        break;

      case 'pdf-paginator':
        if (window.HVE_PDFPaginator) {
          // 互斥：开启 PDF 面板前关闭其他面板
          if (!window.HVE_PDFPaginator.isActive()) {
            if (window.HVE_Canvas?.isCanvasMode()) {
              window.HVE_Canvas.deactivate();
              const cvb = toolbarEl?.querySelector('[data-action="canvas-mode"]');
              if (cvb) cvb.classList.remove('hve-tb-canvas-active');
            }
            if (window.HVE_ChartTypo?.isActive()) {
              window.HVE_ChartTypo.deactivate();
              const cb = toolbarEl?.querySelector('[data-action="chart-typo"]');
              if (cb) cb.classList.remove('hve-tb-chart-active');
            }
          }
          window.HVE_PDFPaginator.toggle();
          const pdfBtn = toolbarEl?.querySelector('[data-action="pdf-paginator"]');
          if (pdfBtn) pdfBtn.classList.toggle('hve-tb-pdf-active', window.HVE_PDFPaginator.isActive());
        }
        break;

      case 'chart-typo':
        if (window.HVE_ChartTypo) {
          // 互斥：开启图表面板前关闭其他面板
          if (!window.HVE_ChartTypo.isActive()) {
            if (window.HVE_Canvas?.isCanvasMode()) {
              window.HVE_Canvas.deactivate();
              const cvb = toolbarEl?.querySelector('[data-action="canvas-mode"]');
              if (cvb) cvb.classList.remove('hve-tb-canvas-active');
            }
            if (window.HVE_PDFPaginator?.isActive()) {
              window.HVE_PDFPaginator.deactivate();
              const pb = toolbarEl?.querySelector('[data-action="pdf-paginator"]');
              if (pb) pb.classList.remove('hve-tb-pdf-active');
            }
          }
          window.HVE_ChartTypo.toggle();
          const chartBtn = toolbarEl?.querySelector('[data-action="chart-typo"]');
          if (chartBtn) chartBtn.classList.toggle('hve-tb-chart-active', window.HVE_ChartTypo.isActive());
        }
        break;

      case 'undo':
        if (window.HVE_History) window.HVE_History.undo();
        break;
      case 'redo':
        if (window.HVE_History) window.HVE_History.redo();
        break;

      case 'format-brush':
        activateFormatBrush(el);
        break;
    }
  }

  // 执行富文本格式命令
  function applyFormat(command) {
    const el = currentTarget;
    if (!el) return;
    // 如果正在文本编辑，用 execCommand
    if (window.HVE_TextEdit && window.HVE_TextEdit.isEditing()) {
      document.execCommand(command, false, null);
    } else {
      // 不在编辑中，先进入编辑，全选，应用格式
      if (window.HVE_TextEdit) {
        window.HVE_TextEdit.startEditingElement(el);
        setTimeout(() => {
          document.execCommand('selectAll', false, null);
          document.execCommand(command, false, null);
        }, 50);
      }
    }
  }

  function changeTag(el, newTag) {
    if (!el || !el.parentNode) return;
    const oldTag = el.tagName;
    const oldHTML = el.outerHTML;
    const parentSelector = window.HVE_History?.getUniqueSelector(el.parentElement);
    const nextSibling = el.nextElementSibling;
    const nextSiblingSelector = nextSibling ? window.HVE_History?.getUniqueSelector(nextSibling) : null;

    const newEl = document.createElement(newTag);
    newEl.innerHTML = el.innerHTML;
    for (const attr of el.attributes) {
      if (!attr.name.startsWith('data-hve-')) {
        newEl.setAttribute(attr.name, attr.value);
      }
    }
    el.parentNode.replaceChild(newEl, el);

    // 记录历史
    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'dom', element: newEl,
        before: { action: 'replaceTag', html: oldHTML, parentSelector, nextSiblingSelector, oldTag },
        after: { action: 'replaceTag', html: newEl.outerHTML, newTag },
        description: `更改标签为 ${newTag}`
      });
    }

    if (window.HVE_Selector) window.HVE_Selector.select(newEl);
  }

  function recordStyleChange(el, prop, value) {
    if (!window.HVE_History || !el) return;
    window.HVE_History.record({
      type: 'style', element: el,
      before: { style: { [prop]: el.style[prop] || '' } },
      after: { style: { [prop]: value } },
      description: '修改样式'
    });
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb.includes('rgba(0, 0, 0, 0)')) return '#ffffff';
    if (rgb.startsWith('#')) return rgb;
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return '#000000';
    return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  }

  // 自定义颜色选择面板 — 可靠且美观
  let colorPanel = null;

  function openColorPicker(el, mode) {
    closeColorPanel();

    // 获取按钮位置
    const btnSelector = mode === 'text' ? '[data-action="color"]' : '[data-action="bg-color"]';
    const anchorBtn = toolbarEl?.querySelector(btnSelector);

    colorPanel = document.createElement('div');
    colorPanel.setAttribute('data-hve-editor', 'true');
    colorPanel.setAttribute('data-hve-color-panel', 'true');

    // 获取当前颜色
    let currentColor = '#000000';
    if (el) {
      if (mode === 'text') {
        currentColor = rgbToHex(getComputedStyle(el).color);
      } else {
        currentColor = rgbToHex(getComputedStyle(el).backgroundColor);
      }
    }

    // 预设颜色
    const presetColors = [
      // 行1: 基础色
      '#000000', '#333333', '#555555', '#777777', '#999999', '#BBBBBB', '#DDDDDD', '#FFFFFF',
      // 行2: 暖色系
      '#D32F2F', '#F44336', '#FF5722', '#FF9800', '#FFC107', '#FFE082', '#FFF9C4', '#FFF176',
      // 行3: 冷色系
      '#1565C0', '#1976D2', '#2196F3', '#42A5F5', '#4FC3F7', '#4DD0E1', '#80CBC4', '#A5D6A7',
      // 行4: 彩色
      '#6A1B9A', '#7B1FA2', '#9C27B0', '#AB47BC', '#CE93D8', '#E91E63', '#F06292', '#F48FB1',
      // 行5: 自然色
      '#3E2723', '#5D4037', '#795548', '#8D6E63', '#A1887F', '#D7CCC8', '#D97706', '#B45309',
    ];

    const title = mode === 'text' ? '文字颜色' : '背景颜色';

    colorPanel.innerHTML = `
      <div class="hve-cp-title">${title}</div>
      <div class="hve-cp-grid">${presetColors.map(c =>
        `<div class="hve-cp-swatch${c === currentColor.toUpperCase() ? ' active' : ''}" data-color="${c}" style="background:${c};${c === '#FFFFFF' ? 'border:1px solid #E8E5E0;' : ''}" title="${c}"></div>`
      ).join('')}</div>
      <div class="hve-cp-custom">
        <label>自定义</label>
        <div class="hve-cp-custom-row">
          <input type="color" value="${currentColor}" class="hve-cp-native" />
          <input type="text" value="${currentColor}" class="hve-cp-hex" maxlength="7" placeholder="#000000" />
        </div>
      </div>
    `;

    // 事件处理
    // 预设色块点击
    colorPanel.querySelectorAll('.hve-cp-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = swatch.dataset.color;
        applyColorValue(el, mode, color);
        // 更新活跃状态
        colorPanel.querySelectorAll('.hve-cp-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        // 更新输入框
        const hexInput = colorPanel.querySelector('.hve-cp-hex');
        const nativeInput = colorPanel.querySelector('.hve-cp-native');
        if (hexInput) hexInput.value = color;
        if (nativeInput) nativeInput.value = color;
      });
    });

    // 原生颜色选择器（作为自定义颜色入口）
    const nativeInput = colorPanel.querySelector('.hve-cp-native');
    if (nativeInput) {
      nativeInput.addEventListener('input', (ev) => {
        const color = ev.target.value;
        applyColorValue(el, mode, color);
        const hexInput = colorPanel.querySelector('.hve-cp-hex');
        if (hexInput) hexInput.value = color;
      });
    }

    // Hex 输入框
    const hexInput = colorPanel.querySelector('.hve-cp-hex');
    if (hexInput) {
      hexInput.addEventListener('change', (ev) => {
        let val = ev.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
          applyColorValue(el, mode, val);
          if (nativeInput) nativeInput.value = val;
        }
      });
      hexInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.target.dispatchEvent(new Event('change'));
          closeColorPanel();
        }
      });
    }

    // 定位在按钮下方（position:fixed 视口坐标）
    if (anchorBtn) {
      const btnRect = anchorBtn.getBoundingClientRect();
      colorPanel.style.position = 'fixed';
      colorPanel.style.top = (btnRect.bottom + 4) + 'px';
      colorPanel.style.left = (btnRect.left + btnRect.width / 2) + 'px';
      colorPanel.style.transform = 'translateX(-50%)';
    }
    document.body.appendChild(colorPanel);

    // 点击外部关闭
    setTimeout(() => {
      document.addEventListener('mousedown', onColorPanelOutsideClick, true);
    }, 0);
  }

  function applyColorValue(el, mode, color) {
    if (mode === 'text') {
      if (window.HVE_TextEdit && window.HVE_TextEdit.isEditing()) {
        document.execCommand('foreColor', false, color);
      } else if (el) {
        recordStyleChange(el, 'color', color);
        el.style.color = color;
      }
      // 更新指示条颜色
      const indicator = toolbarEl?.querySelector('[data-role="color-indicator"]');
      if (indicator) indicator.style.background = color;
    } else {
      if (window.HVE_TextEdit && window.HVE_TextEdit.isEditing()) {
        document.execCommand('hiliteColor', false, color);
      } else if (el) {
        recordStyleChange(el, 'backgroundColor', color);
        el.style.backgroundColor = color;
      }
      // 更新指示条颜色
      const indicator = toolbarEl?.querySelector('[data-role="bg-indicator"]');
      if (indicator) indicator.style.background = color;
    }
  }

  function onColorPanelOutsideClick(e) {
    if (colorPanel && !colorPanel.contains(e.target)) {
      // 不关闭 native color picker 的点击
      if (e.target.classList?.contains('hve-cp-native')) return;
      closeColorPanel();
    }
  }

  function closeColorPanel() {
    document.removeEventListener('mousedown', onColorPanelOutsideClick, true);
    if (colorPanel && colorPanel.parentNode) colorPanel.remove();
    colorPanel = null;
  }

  // 插入元素
  function insertElement(type) {
    const sel = currentTarget;
    let newEl = null;
    switch (type) {
      case 'text': {
        newEl = document.createElement('p');
        newEl.textContent = '在这里输入文本...';
        newEl.style.cssText = 'font-size:16px;line-height:1.6;color:#2D2B28;padding:4px;margin:8px 0;';
        break;
      }
      case 'heading': {
        newEl = document.createElement('h2');
        newEl.textContent = '标题文本';
        newEl.style.cssText = 'font-size:24px;font-weight:700;color:#2D2B28;margin:16px 0 8px;';
        break;
      }
      case 'image': {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = (ev) => {
          const file = ev.target.files[0];
          if (file && window.HVE_ImageHandler) {
            const reader = new FileReader();
            reader.onload = (re) => window.HVE_ImageHandler.insertImageElement(re.target.result, file.name);
            reader.readAsDataURL(file);
          }
        };
        input.click();
        return;
      }
      case 'button': {
        newEl = document.createElement('button');
        newEl.textContent = '按钮';
        newEl.style.cssText = 'padding:10px 24px;background:#D97706;color:white;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;';
        break;
      }
      case 'divider': {
        newEl = document.createElement('hr');
        newEl.style.cssText = 'border:none;height:1px;background:#E8E5E0;margin:24px 0;';
        break;
      }
      case 'container': {
        newEl = document.createElement('div');
        newEl.style.cssText = 'padding:24px;background:#F5F2ED;border-radius:12px;margin:16px 0;min-height:60px;';
        newEl.innerHTML = '<p style="color:#7A6F65;font-size:14px;">容器内容区域</p>';
        break;
      }
      case 'link': {
        newEl = document.createElement('a');
        newEl.href = '#';
        newEl.textContent = '链接文本';
        newEl.style.cssText = 'color:#D97706;text-decoration:underline;font-size:16px;display:inline-block;margin:4px 0;';
        break;
      }
    }
    if (newEl) {
      insertAfterTarget(newEl, sel);
      if (window.HVE_Selector) window.HVE_Selector.select(newEl);
      if (window.HVE_History) {
        window.HVE_History.record({
          type: 'dom', element: newEl,
          before: { action: 'insert' },
          after: { action: 'insert', html: newEl.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(newEl.parentElement) },
          description: '插入' + type
        });
      }
    }
  }

  function insertAfterTarget(newEl, target) {
    if (target && target.parentNode) {
      target.parentNode.insertBefore(newEl, target.nextSibling);
    } else {
      const container = document.querySelector('main') || document.querySelector('article') || document.body;
      container.appendChild(newEl);
    }
  }

  function showTableDialog() {
    if (window.HVE_InsertPanel) {
      window.HVE_InsertPanel.showTableDialog(currentTarget);
    } else {
      // fallback
      const table = window.HVE_TableEdit?.insertNewTable(4, 3, currentTarget);
      if (table && window.HVE_Selector) window.HVE_Selector.select(table);
    }
  }

  // ========== 链接对话框 ==========
  function showLinkDialog(existingLink) {
    const isEdit = !!existingLink;
    const sel = currentTarget;

    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.setAttribute('data-hve-editor', 'true');
    overlay.setAttribute('data-hve-dialog-overlay', 'true');

    // 创建对话框
    const dialog = document.createElement('div');
    dialog.setAttribute('data-hve-editor', 'true');
    dialog.setAttribute('data-hve-dialog', 'true');
    dialog.innerHTML = `
      <h3>${isEdit ? '编辑链接' : '插入链接'}</h3>
      <div style="margin-bottom:14px;">
        <label>链接文本</label>
        <input type="text" id="hve-link-text" placeholder="输入显示文字" value="${isEdit ? existingLink.textContent : '链接文本'}">
      </div>
      <div style="margin-bottom:14px;">
        <label>链接地址 (URL)</label>
        <input type="text" id="hve-link-url" placeholder="https://example.com" value="${isEdit ? (existingLink.href === location.href + '#' || existingLink.getAttribute('href') === '#' ? '' : existingLink.href) : ''}">
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="hve-link-blank" ${isEdit && existingLink.target === '_blank' ? 'checked' : 'checked'} style="width:auto;accent-color:#D97706;">
          在新窗口中打开
        </label>
      </div>
      <div class="hve-dialog-actions">
        ${isEdit ? '<button class="hve-btn-cancel" id="hve-link-remove" style="color:#DC2626;border-color:#FCA5A5;">移除链接</button>' : ''}
        <button class="hve-btn-cancel" id="hve-link-cancel">取消</button>
        <button class="hve-btn-confirm" id="hve-link-confirm">${isEdit ? '更新' : '插入'}</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    // 自动聚焦到 URL 输入框
    const urlInput = dialog.querySelector('#hve-link-url');
    const textInput = dialog.querySelector('#hve-link-text');
    setTimeout(() => urlInput.focus(), 50);

    function cleanup() {
      overlay.remove();
      dialog.remove();
    }

    // 取消
    dialog.querySelector('#hve-link-cancel').addEventListener('click', cleanup);
    overlay.addEventListener('click', cleanup);

    // 移除链接（编辑模式）
    const removeBtn = dialog.querySelector('#hve-link-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        if (existingLink && existingLink.parentNode) {
          const text = document.createTextNode(existingLink.textContent);
          existingLink.parentNode.replaceChild(text, existingLink);
          if (window.HVE_History) {
            window.HVE_History.record({
              type: 'dom', element: text,
              before: { action: 'insert' },
              after: { action: 'insert' },
              description: '移除链接'
            });
          }
        }
        cleanup();
      });
    }

    // 确认
    dialog.querySelector('#hve-link-confirm').addEventListener('click', () => {
      const text = textInput.value.trim() || '链接文本';
      let url = urlInput.value.trim();
      const blank = dialog.querySelector('#hve-link-blank').checked;

      // URL 自动补全 http(s)
      if (url && !/^(https?:\/\/|mailto:|tel:|#)/.test(url)) {
        url = 'https://' + url;
      }
      if (!url) url = '#';

      if (isEdit) {
        // 编辑模式：更新已有链接
        const oldHref = existingLink.href;
        const oldText = existingLink.textContent;
        existingLink.href = url;
        existingLink.textContent = text;
        existingLink.target = blank ? '_blank' : '';
        existingLink.rel = blank ? 'noopener noreferrer' : '';
        if (window.HVE_History) {
          window.HVE_History.record({
            type: 'attribute', element: existingLink,
            before: { href: oldHref, textContent: oldText },
            after: { href: url, textContent: text },
            description: '编辑链接'
          });
        }
        if (window.HVE_Selector) window.HVE_Selector.select(existingLink);
      } else {
        // 插入模式：创建新链接
        const a = document.createElement('a');
        a.href = url;
        a.textContent = text;
        a.target = blank ? '_blank' : '';
        a.rel = blank ? 'noopener noreferrer' : '';
        a.style.cssText = 'color:#D97706;text-decoration:underline;font-size:16px;display:inline-block;margin:4px 0;';
        insertAfterTarget(a, sel);
        if (window.HVE_Selector) window.HVE_Selector.select(a);
        if (window.HVE_History) {
          window.HVE_History.record({
            type: 'dom', element: a,
            before: { action: 'insert' },
            after: { action: 'insert', html: a.outerHTML, parentSelector: window.HVE_History.getUniqueSelector(a.parentElement) },
            description: '插入链接'
          });
        }
      }
      cleanup();
    });

    // 回车快速确认
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        dialog.querySelector('#hve-link-confirm').click();
      } else if (e.key === 'Escape') {
        cleanup();
      }
    });
  }

  // 暴露给外部（text-edit.js 编辑链接时使用）
  window.HVE_LinkDialog = { show: showLinkDialog };

  function show(el) {
    if (!isActive) return;
    currentTarget = el;
    createToolbar();
    // 先设为可见（display:flex），这样才能正确获取 offsetWidth
    toolbarEl.style.display = 'flex';
    positionToolbar(el);
    updateFormatState();
  }

  function hide() {
    closeDropdown();
    closeColorPanel();
    if (toolbarEl) toolbarEl.style.display = 'none';
    currentTarget = null;
  }

  function updateFormatState() {
    if (!toolbarEl || !currentTarget) return;
    const cs = getComputedStyle(currentTarget);
    // 更新字号显示
    const sizeLabel = toolbarEl.querySelector('[data-action="font-size-menu"] .hve-tb-label');
    if (sizeLabel) sizeLabel.textContent = parseInt(cs.fontSize) || 14;
  }

  function positionToolbar(el) {
    if (!toolbarEl || !el) return;
    const rect = el.getBoundingClientRect();
    const tbWidth = toolbarEl.offsetWidth || 500;
    const tbHeight = toolbarEl.offsetHeight || 44;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // === 垂直定位（视口坐标，position:fixed） ===
    // 策略1：放在元素上方
    let top = rect.top - tbHeight - 8;
    if (top < 8) {
      // 策略2：元素上方放不下，放在元素下方
      top = rect.bottom + 8;
      // 如果元素很大，下方也超出视口，则固定在视口顶部
      if (top > vh - tbHeight - 8) {
        top = 8;
      }
    }

    // === 水平定位 ===
    let left = Math.max(8, rect.left + rect.width / 2 - tbWidth / 2);
    left = Math.min(left, vw - tbWidth - 8);

    toolbarEl.style.top = top + 'px';
    toolbarEl.style.left = left + 'px';
  }

  function destroyToolbar() {
    if (toolbarEl && toolbarEl.parentNode) toolbarEl.parentNode.removeChild(toolbarEl);
    toolbarEl = null;
  }

  function getTarget() { return currentTarget; }

  // ========== 格式刷 (Format Brush) ==========
  let formatBrushStyle = null;       // 格式刷复制的样式
  let formatBrushActive = false;     // 格式刷是否激活
  let formatBrushContinuous = false; // 连续模式（双击激活）
  let formatBrushLastClick = 0;      // 双击检测

  function activateFormatBrush(el) {
    if (!el) return;

    const now = Date.now();
    const isDoubleClick = (now - formatBrushLastClick) < 350;
    formatBrushLastClick = now;

    if (formatBrushActive) {
      // 已激活 → 再次点击关闭
      deactivateFormatBrush();
      return;
    }

    // 复制样式
    const cs = getComputedStyle(el);
    formatBrushStyle = {};
    const props = [
      'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
      'fontStyle', 'textDecoration', 'textAlign', 'lineHeight', 'letterSpacing',
      'borderRadius', 'border', 'boxShadow', 'opacity', 'padding',
      'textShadow'
    ];
    props.forEach(p => { formatBrushStyle[p] = cs[p]; });

    formatBrushActive = true;
    formatBrushContinuous = isDoubleClick;

    // 更新按钮状态
    const btn = toolbarEl?.querySelector('[data-action="format-brush"]');
    if (btn) {
      btn.classList.add('hve-active');
      if (formatBrushContinuous) {
        btn.style.boxShadow = '0 0 0 2px #D97706';
      }
    }

    // 改变光标
    document.body.style.cursor = 'copy';
    document.body.setAttribute('data-hve-format-brush', 'true');

    // 监听点击以应用样式
    document.addEventListener('click', onFormatBrushClick, true);
    document.addEventListener('keydown', onFormatBrushKeyDown, true);

    if (window.HVE_Core) {
      window.HVE_Core.showToast(
        isDoubleClick ? '格式刷连续模式 🖌️ (Esc 退出)' : '格式刷已激活 🖌️ (点击目标元素)',
        'info'
      );
    }
  }

  function onFormatBrushClick(e) {
    if (!formatBrushActive || !formatBrushStyle) return;

    const target = e.target;
    if (window.HVE_Selector?.isEditorElement(target)) return;
    if (!window.HVE_Selector?.isSelectable(target)) return;

    e.preventDefault();
    e.stopPropagation();

    // 应用样式
    if (window.HVE_History) {
      const before = {};
      const after = {};
      Object.keys(formatBrushStyle).forEach(p => {
        before[p] = target.style[p] || '';
        after[p] = formatBrushStyle[p];
      });
      window.HVE_History.record({
        type: 'style', element: target,
        before: { style: before },
        after: { style: after },
        description: '格式刷'
      });
    }

    Object.entries(formatBrushStyle).forEach(([p, v]) => {
      target.style[p] = v;
    });

    if (window.HVE_Core) window.HVE_Core.showToast('格式已应用 ✓', 'success');

    // 非连续模式 → 用完一次就关
    if (!formatBrushContinuous) {
      deactivateFormatBrush();
    }
  }

  function onFormatBrushKeyDown(e) {
    if (e.key === 'Escape') {
      deactivateFormatBrush();
    }
  }

  function deactivateFormatBrush() {
    formatBrushActive = false;
    formatBrushContinuous = false;
    formatBrushStyle = null;

    const btn = toolbarEl?.querySelector('[data-action="format-brush"]');
    if (btn) {
      btn.classList.remove('hve-active');
      btn.style.boxShadow = '';
    }

    document.body.style.cursor = '';
    document.body.removeAttribute('data-hve-format-brush');
    document.removeEventListener('click', onFormatBrushClick, true);
    document.removeEventListener('keydown', onFormatBrushKeyDown, true);
  }

  return { activate, deactivate, show, hide, getTarget, insertElement };
})();
