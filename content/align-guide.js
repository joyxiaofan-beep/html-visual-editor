// align-guide.js — 拖拽对齐辅助线（PPT 级智能对齐参考线 + 等距 + 距离标签）
window.HVE_AlignGuide = (function () {
  let isActive = false;
  let guideLines = [];           // 当前显示的辅助线 DOM
  let distLabels = [];           // 距离标签
  const SNAP_THRESHOLD = 6;      // 吸附阈值 (px)
  const GUIDE_COLOR = '#FF4081'; // 辅助线颜色（品红色，醒目）
  const EQUAL_COLOR = '#2563EB'; // 等距辅助线颜色（蓝色）

  function activate() {
    isActive = true;
  }

  function deactivate() {
    isActive = false;
    clearGuides();
  }

  /**
   * 在拖拽过程中调用，检测并显示对齐辅助线
   * @param {HTMLElement[]} dragElements - 正在拖拽的元素
   * @param {number} dx - X 偏移量
   * @param {number} dy - Y 偏移量
   * @param {Object[]} [previewRects] - 预计算的拖拽元素矩形（避免双重重排）
   * @returns {{ snapDx: number, snapDy: number }} 吸附后的偏移调整
   */
  function checkAlignment(dragElements, dx, dy, previewRects) {
    if (!isActive || dragElements.length === 0) return { snapDx: 0, snapDy: 0 };

    clearGuides();

    // 如果提供了预计算矩形，使用它；否则从DOM读取
    const dragRect = previewRects ? getMergedRectFromData(previewRects) : getMergedRect(dragElements);
    if (!dragRect) return { snapDx: 0, snapDy: 0 };

    // 获取参考元素（同级非拖拽元素）
    const siblings = getSiblings(dragElements);

    // 加上视口边界作为参考
    const viewportRef = {
      left: 0, right: window.innerWidth,
      top: 0, bottom: window.innerHeight,
      centerX: window.innerWidth / 2,
      centerY: window.innerHeight / 2
    };

    // 获取父元素的 padding 边界
    const parent = dragElements[0]?.parentElement;
    let parentRect = null;
    if (parent && parent !== document.body) {
      const pr = parent.getBoundingClientRect();
      const pcs = getComputedStyle(parent);
      parentRect = {
        left: pr.left + parseFloat(pcs.paddingLeft),
        right: pr.right - parseFloat(pcs.paddingRight),
        top: pr.top + parseFloat(pcs.paddingTop),
        bottom: pr.bottom - parseFloat(pcs.paddingBottom),
        centerX: (pr.left + pr.right) / 2,
        centerY: (pr.top + pr.bottom) / 2
      };
    }

    let snapDx = 0, snapDy = 0;

    // 拖拽元素的关键点
    const dragCenterX = dragRect.left + dragRect.width / 2;
    const dragCenterY = dragRect.top + dragRect.height / 2;

    // === 检查水平方向对齐（只保留最佳匹配） ===
    let bestHSnap = Infinity;
    let bestHGuide = null;

    // 兄弟元素对齐
    for (const sib of siblings) {
      const sibRect = sib.getBoundingClientRect();
      const sibCenterX = sibRect.left + sibRect.width / 2;

      // 左对齐
      const dLeft = dragRect.left - sibRect.left;
      if (Math.abs(dLeft) < SNAP_THRESHOLD && Math.abs(dLeft) < Math.abs(bestHSnap)) {
        bestHSnap = -dLeft;
        bestHGuide = { type: 'v', x: sibRect.left, y1: Math.min(dragRect.top, sibRect.top) - 10, y2: Math.max(dragRect.bottom, sibRect.bottom) + 10 };
      }

      // 右对齐
      const dRight = dragRect.right - sibRect.right;
      if (Math.abs(dRight) < SNAP_THRESHOLD && Math.abs(dRight) < Math.abs(bestHSnap)) {
        bestHSnap = -dRight;
        bestHGuide = { type: 'v', x: sibRect.right, y1: Math.min(dragRect.top, sibRect.top) - 10, y2: Math.max(dragRect.bottom, sibRect.bottom) + 10 };
      }

      // 中心对齐
      const dCenter = dragCenterX - sibCenterX;
      if (Math.abs(dCenter) < SNAP_THRESHOLD && Math.abs(dCenter) < Math.abs(bestHSnap)) {
        bestHSnap = -dCenter;
        bestHGuide = { type: 'v', x: sibCenterX, y1: Math.min(dragRect.top, sibRect.top) - 10, y2: Math.max(dragRect.bottom, sibRect.bottom) + 10 };
      }

      // 左-右对齐（拖拽元素左边与兄弟元素右边对齐）
      const dLeftRight = dragRect.left - sibRect.right;
      if (Math.abs(dLeftRight) < SNAP_THRESHOLD && Math.abs(dLeftRight) < Math.abs(bestHSnap)) {
        bestHSnap = -dLeftRight;
        bestHGuide = { type: 'v', x: sibRect.right, y1: Math.min(dragRect.top, sibRect.top) - 10, y2: Math.max(dragRect.bottom, sibRect.bottom) + 10 };
      }

      // 右-左对齐
      const dRightLeft = dragRect.right - sibRect.left;
      if (Math.abs(dRightLeft) < SNAP_THRESHOLD && Math.abs(dRightLeft) < Math.abs(bestHSnap)) {
        bestHSnap = -dRightLeft;
        bestHGuide = { type: 'v', x: sibRect.left, y1: Math.min(dragRect.top, sibRect.top) - 10, y2: Math.max(dragRect.bottom, sibRect.bottom) + 10 };
      }
    }

    // 父容器边界对齐
    if (parentRect) {
      const dPLeft = dragRect.left - parentRect.left;
      if (Math.abs(dPLeft) < SNAP_THRESHOLD && Math.abs(dPLeft) < Math.abs(bestHSnap)) {
        bestHSnap = -dPLeft;
        bestHGuide = { type: 'v', x: parentRect.left, y1: parentRect.top, y2: parentRect.bottom, dashed: true };
      }
      const dPRight = dragRect.right - parentRect.right;
      if (Math.abs(dPRight) < SNAP_THRESHOLD && Math.abs(dPRight) < Math.abs(bestHSnap)) {
        bestHSnap = -dPRight;
        bestHGuide = { type: 'v', x: parentRect.right, y1: parentRect.top, y2: parentRect.bottom, dashed: true };
      }
      const dPCenter = dragCenterX - parentRect.centerX;
      if (Math.abs(dPCenter) < SNAP_THRESHOLD && Math.abs(dPCenter) < Math.abs(bestHSnap)) {
        bestHSnap = -dPCenter;
        bestHGuide = { type: 'v', x: parentRect.centerX, y1: parentRect.top, y2: parentRect.bottom, dashed: true };
      }
    }

    // 视口中心对齐
    const dViewCenterX = dragCenterX - viewportRef.centerX;
    if (Math.abs(dViewCenterX) < SNAP_THRESHOLD && Math.abs(dViewCenterX) < Math.abs(bestHSnap)) {
      bestHSnap = -dViewCenterX;
      bestHGuide = { type: 'v', x: viewportRef.centerX, y1: 0, y2: window.innerHeight, dashed: true };
    }

    if (bestHSnap !== Infinity) snapDx = bestHSnap;

    // === 检查垂直方向对齐（只保留最佳匹配） ===
    let bestVSnap = Infinity;
    let bestVGuide = null;
    for (const sib of siblings) {
      const sibRect = sib.getBoundingClientRect();
      const sibCenterY = sibRect.top + sibRect.height / 2;

      // 顶部对齐
      const dTop = dragRect.top - sibRect.top;
      if (Math.abs(dTop) < SNAP_THRESHOLD && Math.abs(dTop) < Math.abs(bestVSnap)) {
        bestVSnap = -dTop;
        bestVGuide = { type: 'h', y: sibRect.top, x1: Math.min(dragRect.left, sibRect.left) - 10, x2: Math.max(dragRect.right, sibRect.right) + 10 };
      }

      // 底部对齐
      const dBottom = dragRect.bottom - sibRect.bottom;
      if (Math.abs(dBottom) < SNAP_THRESHOLD && Math.abs(dBottom) < Math.abs(bestVSnap)) {
        bestVSnap = -dBottom;
        bestVGuide = { type: 'h', y: sibRect.bottom, x1: Math.min(dragRect.left, sibRect.left) - 10, x2: Math.max(dragRect.right, sibRect.right) + 10 };
      }

      // 中心对齐
      const dCenterY = dragCenterY - sibCenterY;
      if (Math.abs(dCenterY) < SNAP_THRESHOLD && Math.abs(dCenterY) < Math.abs(bestVSnap)) {
        bestVSnap = -dCenterY;
        bestVGuide = { type: 'h', y: sibCenterY, x1: Math.min(dragRect.left, sibRect.left) - 10, x2: Math.max(dragRect.right, sibRect.right) + 10 };
      }

      // 顶-底对齐（拖拽元素顶部与兄弟底部对齐）
      const dTopBottom = dragRect.top - sibRect.bottom;
      if (Math.abs(dTopBottom) < SNAP_THRESHOLD && Math.abs(dTopBottom) < Math.abs(bestVSnap)) {
        bestVSnap = -dTopBottom;
        bestVGuide = { type: 'h', y: sibRect.bottom, x1: Math.min(dragRect.left, sibRect.left) - 10, x2: Math.max(dragRect.right, sibRect.right) + 10 };
      }

      // 底-顶对齐
      const dBottomTop = dragRect.bottom - sibRect.top;
      if (Math.abs(dBottomTop) < SNAP_THRESHOLD && Math.abs(dBottomTop) < Math.abs(bestVSnap)) {
        bestVSnap = -dBottomTop;
        bestVGuide = { type: 'h', y: sibRect.top, x1: Math.min(dragRect.left, sibRect.left) - 10, x2: Math.max(dragRect.right, sibRect.right) + 10 };
      }
    }

    // 父容器边界对齐
    if (parentRect) {
      const dPTop = dragRect.top - parentRect.top;
      if (Math.abs(dPTop) < SNAP_THRESHOLD && Math.abs(dPTop) < Math.abs(bestVSnap)) {
        bestVSnap = -dPTop;
        bestVGuide = { type: 'h', y: parentRect.top, x1: parentRect.left, x2: parentRect.right, dashed: true };
      }
      const dPBottom = dragRect.bottom - parentRect.bottom;
      if (Math.abs(dPBottom) < SNAP_THRESHOLD && Math.abs(dPBottom) < Math.abs(bestVSnap)) {
        bestVSnap = -dPBottom;
        bestVGuide = { type: 'h', y: parentRect.bottom, x1: parentRect.left, x2: parentRect.right, dashed: true };
      }
      const dPCenterY = dragCenterY - parentRect.centerY;
      if (Math.abs(dPCenterY) < SNAP_THRESHOLD && Math.abs(dPCenterY) < Math.abs(bestVSnap)) {
        bestVSnap = -dPCenterY;
        bestVGuide = { type: 'h', y: parentRect.centerY, x1: parentRect.left, x2: parentRect.right, dashed: true };
      }
    }

    // 视口中心对齐
    const dViewCenterY = dragCenterY - viewportRef.centerY;
    if (Math.abs(dViewCenterY) < SNAP_THRESHOLD && Math.abs(dViewCenterY) < Math.abs(bestVSnap)) {
      bestVSnap = -dViewCenterY;
      bestVGuide = { type: 'h', y: viewportRef.centerY, x1: 0, x2: window.innerWidth, dashed: true };
    }

    if (bestVSnap !== Infinity) snapDy = bestVSnap;

    // 渲染辅助线（每个方向最多一条，避免累积）
    if (bestHGuide) renderGuide(bestHGuide);
    if (bestVGuide) renderGuide(bestVGuide);

    // === 等距检测：三个或以上同级元素等距排列时显示蓝色标记 ===
    checkEqualSpacing(dragElements, dragRect, siblings, snapDx, snapDy);

    // === 距离标签：显示与最近兄弟的距离 ===
    showDistanceLabels(dragRect, siblings, snapDx, snapDy);

    return { snapDx, snapDy };
  }

  /**
   * 检查等距排列并显示等距标记
   */
  function checkEqualSpacing(dragEls, dragRect, siblings, snapDx, snapDy) {
    if (siblings.length < 2) return;

    const adjustedDrag = {
      left: dragRect.left + snapDx,
      right: dragRect.right + snapDx,
      top: dragRect.top + snapDy,
      bottom: dragRect.bottom + snapDy,
      centerX: dragRect.left + snapDx + dragRect.width / 2,
      centerY: dragRect.top + snapDy + dragRect.height / 2
    };

    // 收集所有中心点（包括拖拽元素）
    const sibRects = siblings.map(s => s.getBoundingClientRect());

    // 水平等距检测
    const hCenters = sibRects.map(r => ({ cx: r.left + r.width / 2, r }));
    hCenters.push({ cx: adjustedDrag.centerX, r: adjustedDrag, isDrag: true });
    hCenters.sort((a, b) => a.cx - b.cx);

    if (hCenters.length >= 3) {
      for (let i = 0; i < hCenters.length - 2; i++) {
        const d1 = hCenters[i + 1].cx - hCenters[i].cx;
        const d2 = hCenters[i + 2].cx - hCenters[i + 1].cx;
        if (Math.abs(d1 - d2) < 3 && d1 > 10) {
          // 等距！显示标记
          const y = Math.max(hCenters[i].r.top || 0, hCenters[i + 1].r.top || 0, hCenters[i + 2].r.top || 0) - 16;
          renderDistMark(hCenters[i].cx, y, hCenters[i + 1].cx, y, Math.round(d1));
          renderDistMark(hCenters[i + 1].cx, y, hCenters[i + 2].cx, y, Math.round(d2));
        }
      }
    }
  }

  /**
   * 显示距离标签（拖拽元素与最近兄弟之间的距离）
   */
  function showDistanceLabels(dragRect, siblings, snapDx, snapDy) {
    if (siblings.length === 0) return;

    const adjustedDrag = {
      left: dragRect.left + snapDx,
      right: dragRect.right + snapDx,
      top: dragRect.top + snapDy,
      bottom: dragRect.bottom + snapDy
    };

    // 找最近的上方和左侧兄弟，显示距离
    let nearestAbove = null, minAboveDist = Infinity;
    let nearestLeft = null, minLeftDist = Infinity;

    for (const sib of siblings) {
      const sr = sib.getBoundingClientRect();

      // 上方元素
      if (sr.bottom <= adjustedDrag.top) {
        const dist = adjustedDrag.top - sr.bottom;
        if (dist < minAboveDist && dist < 100) {
          minAboveDist = dist;
          nearestAbove = sr;
        }
      }

      // 左侧元素
      if (sr.right <= adjustedDrag.left) {
        const dist = adjustedDrag.left - sr.right;
        if (dist < minLeftDist && dist < 100) {
          minLeftDist = dist;
          nearestLeft = sr;
        }
      }
    }

    if (nearestAbove && minAboveDist > 2) {
      const x = adjustedDrag.left + dragRect.width / 2;
      renderDistLabel(x, nearestAbove.bottom + minAboveDist / 2, Math.round(minAboveDist), 'v');
    }

    if (nearestLeft && minLeftDist > 2) {
      const y = adjustedDrag.top + dragRect.height / 2;
      renderDistLabel(nearestLeft.right + minLeftDist / 2, y, Math.round(minLeftDist), 'h');
    }
  }

  function getMergedRect(elements) {
    if (elements.length === 0) return null;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    elements.forEach(el => {
      const r = el.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    });
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function getMergedRectFromData(rects) {
    if (!rects || rects.length === 0) return null;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    rects.forEach(r => {
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    });
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function getSiblings(dragElements) {
    const result = [];
    const parent = dragElements[0]?.parentElement;
    if (!parent) return result;

    const dragSet = new Set(dragElements);
    for (const child of parent.children) {
      if (dragSet.has(child)) continue;
      if (child.hasAttribute('data-hve-editor')) continue;
      if (child.offsetParent === null) continue; // 不可见
      const r = child.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      result.push(child);
    }
    return result;
  }

  function renderGuide(g) {
    const line = document.createElement('div');
    line.setAttribute('data-hve-editor', 'true');
    line.setAttribute('data-hve-guide', 'true');

    if (g.type === 'v') {
      // 垂直线
      line.style.cssText = `
        position:fixed;left:${g.x}px;top:${g.y1}px;
        width:1px;height:${g.y2 - g.y1}px;
        background:${GUIDE_COLOR};z-index:2147483642;pointer-events:none;
        ${g.dashed ? 'border-left:1px dashed ' + GUIDE_COLOR + ';background:none;' : ''}
      `;
    } else {
      // 水平线
      line.style.cssText = `
        position:fixed;left:${g.x1}px;top:${g.y}px;
        width:${g.x2 - g.x1}px;height:1px;
        background:${GUIDE_COLOR};z-index:2147483642;pointer-events:none;
        ${g.dashed ? 'border-top:1px dashed ' + GUIDE_COLOR + ';background:none;' : ''}
      `;
    }

    document.body.appendChild(line);
    guideLines.push(line);
  }

  /**
   * 渲染距离标签
   */
  function renderDistLabel(x, y, distance, direction) {
    const label = document.createElement('div');
    label.setAttribute('data-hve-editor', 'true');
    label.setAttribute('data-hve-guide', 'true');
    label.textContent = distance + 'px';
    label.style.cssText = `
      position:fixed;z-index:2147483643;pointer-events:none;
      background:${GUIDE_COLOR};color:white;font-size:10px;font-weight:600;
      padding:1px 5px;border-radius:3px;
      font-family:'SF Pro Text',-apple-system,sans-serif;
      white-space:nowrap;
      left:${x}px;top:${y}px;
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(label);
    distLabels.push(label);
  }

  /**
   * 渲染等距标记（两点之间的双箭头线 + 距离数字）
   */
  function renderDistMark(x1, y1, x2, y2, dist) {
    // 连线
    const line = document.createElement('div');
    line.setAttribute('data-hve-editor', 'true');
    line.setAttribute('data-hve-guide', 'true');
    const isHorizontal = Math.abs(y2 - y1) < 2;
    if (isHorizontal) {
      line.style.cssText = `
        position:fixed;left:${Math.min(x1, x2)}px;top:${y1}px;
        width:${Math.abs(x2 - x1)}px;height:1px;
        background:${EQUAL_COLOR};z-index:2147483642;pointer-events:none;
      `;
    }
    document.body.appendChild(line);
    guideLines.push(line);

    // 距离数字
    const label = document.createElement('div');
    label.setAttribute('data-hve-editor', 'true');
    label.setAttribute('data-hve-guide', 'true');
    label.textContent = dist;
    label.style.cssText = `
      position:fixed;z-index:2147483643;pointer-events:none;
      background:${EQUAL_COLOR};color:white;font-size:9px;font-weight:700;
      padding:1px 4px;border-radius:3px;
      font-family:'SF Mono',monospace;white-space:nowrap;
      left:${(x1 + x2) / 2}px;top:${y1 - 8}px;
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(label);
    distLabels.push(label);
  }

  function clearGuides() {
    guideLines.forEach(el => el.remove());
    guideLines = [];
    distLabels.forEach(el => el.remove());
    distLabels = [];
  }

  return { activate, deactivate, checkAlignment, clearGuides };
})();
