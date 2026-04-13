// pdf-paginator.js — HTML 转 PDF 精确分页预测 v1.0
// 预测 HTML 页面在 PDF 导出时的分页位置，提供可视化预览和智能分页建议
window.HVE_PDFPaginator = (function () {
  let isActive = false;
  let previewOverlay = null;
  let pageBreakLines = [];
  let controlPanel = null;

  // PDF 页面尺寸（mm → px @96dpi）
  const PAGE_SIZES = {
    'A4': { width: 210, height: 297 },         // 最常用
    'A3': { width: 297, height: 420 },
    'Letter': { width: 215.9, height: 279.4 },
    'Legal': { width: 215.9, height: 355.6 },
    '16:9 Slide': { width: 338.67, height: 190.5 }, // 1280x720 换算
  };

  const MM_TO_PX = 96 / 25.4; // 96 DPI

  // 配置
  let config = {
    pageSize: 'A4',
    orientation: 'portrait',   // 'portrait' | 'landscape'
    margins: { top: 10, right: 10, bottom: 10, left: 10 }, // mm
    scale: 1,
    avoidBreakInside: true,    // 避免在元素内部分页
    showPageNumbers: true,
    backgroundColor: '#FFFFFF',
  };

  // ============== 公共 API ==============

  function activate() {
    if (isActive) return;
    isActive = true;
    createControlPanel();
    calculatePageBreaks();
    showPreview();
    console.log('[HVE PDF Paginator] ✅ 分页预测已开启');
  }

  function deactivate() {
    if (!isActive) return;
    isActive = false;
    hidePreview();
    destroyControlPanel();
    console.log('[HVE PDF Paginator] ⛔ 分页预测已关闭');
  }

  function toggle() {
    if (isActive) deactivate(); else activate();
  }

  // ============== 控制面板 ==============

  function createControlPanel() {
    if (controlPanel) return;

    controlPanel = document.createElement('div');
    controlPanel.setAttribute('data-hve-editor', 'true');
    controlPanel.setAttribute('data-hve-pdf-panel', 'true');

    controlPanel.innerHTML = `
      <div class="hve-pdf-header">
        <span class="hve-pdf-title">📄 PDF 分页预测</span>
        <button class="hve-pdf-close" title="关闭">✕</button>
      </div>
      <div class="hve-pdf-body">
        <div class="hve-pdf-row">
          <label>页面尺寸</label>
          <select data-pdf-config="pageSize">
            ${Object.keys(PAGE_SIZES).map(k => `<option value="${k}" ${k === config.pageSize ? 'selected' : ''}>${k} (${PAGE_SIZES[k].width}×${PAGE_SIZES[k].height}mm)</option>`).join('')}
          </select>
        </div>
        <div class="hve-pdf-row">
          <label>方向</label>
          <div class="hve-pdf-toggle">
            <button data-pdf-orient="portrait" class="${config.orientation === 'portrait' ? 'active' : ''}">竖向</button>
            <button data-pdf-orient="landscape" class="${config.orientation === 'landscape' ? 'active' : ''}">横向</button>
          </div>
        </div>
        <div class="hve-pdf-row">
          <label>页边距 (mm)</label>
          <div class="hve-pdf-margins">
            <input type="number" data-pdf-margin="top" value="${config.margins.top}" min="0" max="50" title="上">
            <input type="number" data-pdf-margin="right" value="${config.margins.right}" min="0" max="50" title="右">
            <input type="number" data-pdf-margin="bottom" value="${config.margins.bottom}" min="0" max="50" title="下">
            <input type="number" data-pdf-margin="left" value="${config.margins.left}" min="0" max="50" title="左">
          </div>
        </div>
        <div class="hve-pdf-row">
          <label>缩放</label>
          <input type="range" data-pdf-config="scale" min="0.5" max="2" step="0.05" value="${config.scale}">
          <span class="hve-pdf-scale-label">${Math.round(config.scale * 100)}%</span>
        </div>
        <div class="hve-pdf-row">
          <label>
            <input type="checkbox" data-pdf-config="avoidBreakInside" ${config.avoidBreakInside ? 'checked' : ''}>
            避免在元素内部分页
          </label>
        </div>
        <div class="hve-pdf-divider"></div>
        <div class="hve-pdf-info">
          <span data-pdf-pagecount>共 0 页</span>
        </div>
        <div class="hve-pdf-actions">
          <button class="hve-pdf-btn-primary" data-pdf-action="export">导出 PDF</button>
          <button class="hve-pdf-btn" data-pdf-action="add-breaks">插入分页符</button>
          <button class="hve-pdf-btn" data-pdf-action="clear-breaks">清除分页符</button>
        </div>
      </div>
    `;

    // 事件绑定
    controlPanel.querySelector('.hve-pdf-close').addEventListener('click', deactivate);

    // 页面尺寸
    controlPanel.querySelector('[data-pdf-config="pageSize"]').addEventListener('change', (e) => {
      config.pageSize = e.target.value;
      refresh();
    });

    // 方向切换
    controlPanel.querySelectorAll('[data-pdf-orient]').forEach(btn => {
      btn.addEventListener('click', () => {
        config.orientation = btn.getAttribute('data-pdf-orient');
        controlPanel.querySelectorAll('[data-pdf-orient]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refresh();
      });
    });

    // 页边距
    controlPanel.querySelectorAll('[data-pdf-margin]').forEach(input => {
      input.addEventListener('change', () => {
        const side = input.getAttribute('data-pdf-margin');
        config.margins[side] = parseInt(input.value) || 0;
        refresh();
      });
    });

    // 缩放
    const scaleInput = controlPanel.querySelector('[data-pdf-config="scale"]');
    const scaleLabel = controlPanel.querySelector('.hve-pdf-scale-label');
    scaleInput.addEventListener('input', (e) => {
      config.scale = parseFloat(e.target.value);
      scaleLabel.textContent = Math.round(config.scale * 100) + '%';
      refresh();
    });

    // 避免内部分页
    controlPanel.querySelector('[data-pdf-config="avoidBreakInside"]').addEventListener('change', (e) => {
      config.avoidBreakInside = e.target.checked;
      refresh();
    });

    // 操作按钮
    controlPanel.querySelectorAll('[data-pdf-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-pdf-action');
        switch (action) {
          case 'export': exportToPDF(); break;
          case 'add-breaks': insertPageBreaks(); break;
          case 'clear-breaks': clearPageBreaks(); break;
        }
      });
    });

    document.body.appendChild(controlPanel);
  }

  function destroyControlPanel() {
    if (controlPanel) {
      controlPanel.remove();
      controlPanel = null;
    }
  }

  function refresh() {
    calculatePageBreaks();
    showPreview();
  }

  // ============== 分页计算引擎 ==============

  function getPageDimensions() {
    const size = PAGE_SIZES[config.pageSize] || PAGE_SIZES['A4'];
    let w = size.width;
    let h = size.height;

    if (config.orientation === 'landscape') {
      [w, h] = [h, w];
    }

    // mm → px
    const pageWidthPx = w * MM_TO_PX;
    const pageHeightPx = h * MM_TO_PX;

    // 减去边距
    const contentHeightPx = pageHeightPx - (config.margins.top + config.margins.bottom) * MM_TO_PX;
    const contentWidthPx = pageWidthPx - (config.margins.left + config.margins.right) * MM_TO_PX;

    return {
      pageWidth: pageWidthPx,
      pageHeight: pageHeightPx,
      contentWidth: contentWidthPx,
      contentHeight: contentHeightPx,
      marginTop: config.margins.top * MM_TO_PX,
      marginBottom: config.margins.bottom * MM_TO_PX,
    };
  }

  function calculatePageBreaks() {
    pageBreakLines = [];

    const dims = getPageDimensions();
    const contentHeight = dims.contentHeight / config.scale;

    // 获取页面实际内容高度
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    // 检测是否是 slide 模式（多个 100vh section）
    const isSlideMode = detectSlideMode();

    if (isSlideMode) {
      // Slide 模式：每个 slide 就是一页
      const slides = getSlideElements();
      let accHeight = 0;
      for (let i = 0; i < slides.length; i++) {
        const slideRect = slides[i].getBoundingClientRect();
        accHeight += slideRect.height;
        if (i < slides.length - 1) {
          pageBreakLines.push({
            y: accHeight + window.scrollY,
            type: 'slide',
            label: `第 ${i + 1} 页结束`,
          });
        }
      }
    } else {
      // 普通文档模式：按 PDF 内容高度分页
      let y = contentHeight;
      let pageNum = 1;

      while (y < docHeight) {
        let breakY = y;

        if (config.avoidBreakInside) {
          // 智能调整：避免在元素内部分页
          breakY = findSafeBreakPoint(y, contentHeight);
        }

        pageBreakLines.push({
          y: breakY,
          type: 'calculated',
          label: `第 ${pageNum} 页 → 第 ${pageNum + 1} 页`,
        });

        y = breakY + contentHeight;
        pageNum++;
      }
    }

    // 检测用户手动插入的分页符
    document.querySelectorAll('[data-hve-page-break]').forEach(el => {
      const rect = el.getBoundingClientRect();
      pageBreakLines.push({
        y: rect.top + window.scrollY,
        type: 'manual',
        label: '手动分页符',
      });
    });

    // 排序
    pageBreakLines.sort((a, b) => a.y - b.y);

    // 更新页数信息
    updatePageCount();
  }

  function findSafeBreakPoint(targetY, contentHeight) {
    // 在目标位置附近寻找安全的分页点
    // 策略：向上搜索最多 contentHeight * 0.3 的范围，找到元素边界
    const searchRange = contentHeight * 0.3;
    const minY = targetY - searchRange;

    // 仅查询直接子块级元素和语义标签，避免过宽选择器导致的性能问题
    const elements = document.querySelectorAll('body > *, section, article, h1, h2, h3, h4, h5, h6, table, figure, pre, blockquote');

    let bestBreak = targetY;
    let minWaste = Infinity;

    for (const el of elements) {
      if (el.closest('[data-hve-editor]')) continue;

      const rect = el.getBoundingClientRect();
      const elTop = rect.top + window.scrollY;
      const elBottom = rect.bottom + window.scrollY;

      // 元素顶部在搜索范围内 → 在这个元素之前分页
      if (elTop >= minY && elTop <= targetY) {
        const waste = targetY - elTop;
        if (waste < minWaste) {
          minWaste = waste;
          bestBreak = elTop;
        }
      }

      // 元素底部在搜索范围内 → 在这个元素之后分页
      if (elBottom >= minY && elBottom <= targetY) {
        const waste = targetY - elBottom;
        if (waste < minWaste) {
          minWaste = waste;
          bestBreak = elBottom;
        }
      }
    }

    return bestBreak;
  }

  function detectSlideMode() {
    // 检测是否是 scroll-snap slide 模式
    const bodyStyle = getComputedStyle(document.documentElement);
    const htmlStyle = getComputedStyle(document.body);

    if (bodyStyle.scrollSnapType?.includes('y') || htmlStyle.scrollSnapType?.includes('y')) {
      return true;
    }

    // 检查是否有 .slide / .page 类名的 100vh 元素
    const candidates = document.querySelectorAll('.slide, .page, [class*="slide"], section');
    if (candidates.length >= 2) {
      const allFullHeight = Array.from(candidates).every(el => {
        const h = el.getBoundingClientRect().height;
        return h >= window.innerHeight * 0.9;
      });
      if (allFullHeight) return true;
    }

    return false;
  }

  function getSlideElements() {
    const selectors = [
      '.slide',
      '.page',
      'section[class*="slide"]',
      '[data-slide]',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length >= 2) return Array.from(els);
    }

    // fallback: body 直接子元素且高度接近 100vh
    const children = Array.from(document.body.children).filter(el => {
      if (el.closest('[data-hve-editor]')) return false;
      const h = el.getBoundingClientRect().height;
      return h >= window.innerHeight * 0.8;
    });

    return children.length >= 2 ? children : [];
  }

  function updatePageCount() {
    if (!controlPanel) return;
    const countEl = controlPanel.querySelector('[data-pdf-pagecount]');
    if (countEl) {
      countEl.textContent = `共 ${pageBreakLines.length + 1} 页`;
    }
  }

  // ============== 分页预览可视化 ==============

  function showPreview() {
    hidePreview();

    previewOverlay = document.createElement('div');
    previewOverlay.setAttribute('data-hve-editor', 'true');
    previewOverlay.setAttribute('data-hve-pdf-overlay', 'true');

    for (let i = 0; i < pageBreakLines.length; i++) {
      const pb = pageBreakLines[i];
      const line = document.createElement('div');
      line.className = 'hve-pdf-break-line';
      line.setAttribute('data-hve-editor', 'true');

      const typeClass = pb.type === 'manual' ? 'hve-pdf-break-manual' :
                        pb.type === 'slide' ? 'hve-pdf-break-slide' :
                        'hve-pdf-break-calculated';
      line.classList.add(typeClass);

      line.style.top = pb.y + 'px';

      // 标签
      const label = document.createElement('span');
      label.className = 'hve-pdf-break-label';
      label.textContent = pb.label;
      line.appendChild(label);

      // 页码
      if (config.showPageNumbers) {
        const pageNum = document.createElement('span');
        pageNum.className = 'hve-pdf-page-number';
        pageNum.textContent = `P${i + 2}`;
        line.appendChild(pageNum);
      }

      previewOverlay.appendChild(line);
    }

    document.body.appendChild(previewOverlay);
  }

  function hidePreview() {
    if (previewOverlay) {
      previewOverlay.remove();
      previewOverlay = null;
    }
  }

  // ============== 分页操作 ==============

  function insertPageBreaks() {
    // 在计算出的分页位置插入 CSS break-before 或自定义标记
    let count = 0;

    for (const pb of pageBreakLines) {
      if (pb.type !== 'calculated') continue;

      // 找到分页位置对应的元素
      const el = document.elementFromPoint(window.innerWidth / 2, pb.y - window.scrollY + 5);
      if (el && !el.closest('[data-hve-editor]') && el !== document.body) {
        // 在这个元素之前插入分页标记
        const breakEl = document.createElement('div');
        breakEl.setAttribute('data-hve-page-break', 'true');
        breakEl.style.cssText = 'page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0; border: none;';
        el.parentNode.insertBefore(breakEl, el);

        // 记录历史
        if (window.HVE_History) {
          window.HVE_History.record({
            type: 'dom', element: breakEl,
            before: { action: 'insert' },
            after: {
              action: 'insert',
              html: breakEl.outerHTML,
              parentSelector: window.HVE_History.getUniqueSelector(breakEl.parentElement),
            },
            description: '插入分页符',
          });
        }

        count++;
      }
    }

    refresh();

    if (window.HVE_Core) {
      window.HVE_Core.showToast(`已插入 ${count} 个分页符 ✓`, 'success');
    }
  }

  function clearPageBreaks() {
    const breaks = document.querySelectorAll('[data-hve-page-break]');
    let count = breaks.length;

    breaks.forEach(el => {
      if (window.HVE_History) {
        window.HVE_History.record({
          type: 'dom', element: el,
          before: {
            action: 'remove',
            html: el.outerHTML,
            parentSelector: window.HVE_History.getUniqueSelector(el.parentElement),
          },
          after: { action: 'remove' },
          description: '删除分页符',
        });
      }
      el.remove();
    });

    refresh();

    if (window.HVE_Core) {
      window.HVE_Core.showToast(`已清除 ${count} 个分页符 ✓`, 'success');
    }
  }

  // ============== PDF 导出 ==============

  async function exportToPDF() {
    // 检查是否有 html2canvas 和 jsPDF
    if (typeof html2canvas === 'undefined') {
      // 动态加载
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
    }

    const JsPDF = (typeof jspdf !== 'undefined' && jspdf.jsPDF) || (typeof jsPDF !== 'undefined' && jsPDF);
    if (!JsPDF) {
      if (window.HVE_Core) window.HVE_Core.showToast('PDF 库加载失败，请检查网络', 'error');
      return;
    }

    if (window.HVE_Core) window.HVE_Core.showToast('正在生成 PDF...', 'info');

    try {
      // 先隐藏编辑器 UI
      hidePreview();
      const editorEls = document.querySelectorAll('[data-hve-editor]');
      editorEls.forEach(el => el.style.display = 'none');

      const dims = getPageDimensions();
      const isSlide = detectSlideMode();

      if (isSlide) {
        await exportSlidesPDF(JsPDF, dims);
      } else {
        await exportDocumentPDF(JsPDF, dims);
      }

      // 恢复编辑器 UI
      editorEls.forEach(el => el.style.display = '');
      showPreview();

      if (window.HVE_Core) window.HVE_Core.showToast('PDF 已导出 ✓', 'success');
    } catch (err) {
      console.error('[HVE PDF]', err);
      // 恢复编辑器 UI（复用 try 块中已获取的 editorEls）
      editorEls.forEach(el => el.style.display = '');
      showPreview();
      if (window.HVE_Core) window.HVE_Core.showToast('PDF 导出失败: ' + err.message, 'error');
    }
  }

  async function exportSlidesPDF(JsPDF, dims) {
    const slides = getSlideElements();
    if (slides.length === 0) return;

    const orient = config.orientation === 'landscape' ? 'l' : 'p';
    const pdf = new JsPDF(orient, 'mm', [
      PAGE_SIZES[config.pageSize].width,
      PAGE_SIZES[config.pageSize].height,
    ]);

    for (let i = 0; i < slides.length; i++) {
      if (i > 0) pdf.addPage();

      const canvas = await html2canvas(slides[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: config.backgroundColor,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const size = PAGE_SIZES[config.pageSize];
      const pageW = config.orientation === 'landscape' ? size.height : size.width;
      const pageH = config.orientation === 'landscape' ? size.width : size.height;

      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);
    }

    pdf.save(`${document.title || 'slides'}.pdf`);
  }

  async function exportDocumentPDF(JsPDF, dims) {
    const orient = config.orientation === 'landscape' ? 'l' : 'p';
    const pdf = new JsPDF(orient, 'mm', [
      PAGE_SIZES[config.pageSize].width,
      PAGE_SIZES[config.pageSize].height,
    ]);

    // 整页截图
    const canvas = await html2canvas(document.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: config.backgroundColor,
      logging: false,
      windowHeight: document.body.scrollHeight,
      height: document.body.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const size = PAGE_SIZES[config.pageSize];
    const pageW = config.orientation === 'landscape' ? size.height : size.width;
    const pageH = config.orientation === 'landscape' ? size.width : size.height;

    const contentW = pageW - config.margins.left - config.margins.right;
    const contentH = pageH - config.margins.top - config.margins.bottom;

    // 计算图片在 PDF 中的比例
    const imgAspect = canvas.width / canvas.height;
    const imgWidthMM = contentW;
    const imgHeightMM = imgWidthMM / imgAspect;
    const totalPages = Math.ceil(imgHeightMM / contentH);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      // 使用裁剪方式：从大图中截取每页需要的区域
      const srcY = (page * contentH / imgHeightMM) * canvas.height;
      const srcH = (contentH / imgHeightMM) * canvas.height;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = Math.min(srcH, canvas.height - srcY);
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, srcY, canvas.width, tempCanvas.height, 0, 0, canvas.width, tempCanvas.height);

      const pageImg = tempCanvas.toDataURL('image/jpeg', 0.92);
      const actualH = (tempCanvas.height / canvas.height) * imgHeightMM;

      pdf.addImage(pageImg, 'JPEG', config.margins.left, config.margins.top, contentW, actualH);
    }

    pdf.save(`${document.title || 'document'}.pdf`);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { resolve(); return; }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // ============== 返回公共 API ==============

  return {
    activate,
    deactivate,
    toggle,
    isActive: () => isActive,
    getConfig: () => ({ ...config }),
    setConfig: (newConfig) => { Object.assign(config, newConfig); refresh(); },
    getPageCount: () => pageBreakLines.length + 1,
    exportToPDF,
  };
})();
