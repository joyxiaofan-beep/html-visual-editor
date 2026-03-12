// drag-move.js — 元素拖拽移动（支持多选批量移动）
window.HVE_DragMove = (function () {
  let isDraggingFlag = false;
  let isPendingDrag = false;    // 等待确认拖拽意图（鼠标按下但还没移动超阈值）
  let dragTargets = [];          // 多个拖拽目标
  let startX = 0, startY = 0;
  let origStates = [];           // 每个目标的初始位置
  let beforeStates = [];         // 用于历史记录
  let isActive = false;
  let pendingElements = null;    // 待确认拖拽的元素列表
  let rafId = null;              // requestAnimationFrame 节流

  const DRAG_THRESHOLD = 5;      // 拖拽启动阈值 (px)

  function activate() {
    isActive = true;
    document.addEventListener('mousedown', onMouseDown, true);
  }

  function deactivate() {
    isActive = false;
    document.removeEventListener('mousedown', onMouseDown, true);
    cancelPending();
    cancelDrag();
  }

  function onMouseDown(e) {
    if (!isActive) return;
    if (e.button !== 0) return; // 仅左键

    // 如果点击的是 resize 手柄，不处理
    if (e.target.hasAttribute('data-hve-handle')) return;
    // 如果点击的是编辑器 UI 元素，不处理
    if (window.HVE_Selector && window.HVE_Selector.isEditorElement(e.target)) return;
    // 如果正在框选，不处理
    if (window.HVE_Selector && window.HVE_Selector.isMarquee()) return;

    const selector = window.HVE_Selector;
    if (!selector) return;

    const isMulti = selector.isMultiSelected();
    const selectedEls = selector.getSelectedElements();
    const singleSelected = selector.getSelected();

    let elementsToMove = null;

    if (isMulti && selectedEls.length > 1) {
      // 多选模式 — 检查点击是否在任一选中元素上
      let clickedOnSelected = false;
      for (const sel of selectedEls) {
        if (sel.contains(e.target) || e.target === sel) {
          clickedOnSelected = true;
          break;
        }
      }
      if (!clickedOnSelected) return;

      // 检查是否有元素正在文本编辑
      for (const sel of selectedEls) {
        if (sel.getAttribute('contenteditable') === 'true') return;
      }

      elementsToMove = selectedEls;
    } else if (singleSelected) {
      // 单选模式
      if (!singleSelected.contains(e.target) && e.target !== singleSelected) return;
      if (singleSelected.getAttribute('contenteditable') === 'true') return;

      elementsToMove = [singleSelected];
    }

    if (!elementsToMove || elementsToMove.length === 0) return;

    // 检查是否有锁定的元素
    if (elementsToMove.some(el => el.hasAttribute('data-hve-locked'))) return;

    // 不立即开始拖拽，而是进入"待确认"状态
    e.preventDefault();
    if (isMulti) e.stopPropagation();

    isPendingDrag = true;
    pendingElements = elementsToMove;
    startX = e.clientX;
    startY = e.clientY;

    document.addEventListener('mousemove', onPendingMove, true);
    document.addEventListener('mouseup', onPendingUp, true);
  }

  // 等待确认拖拽意图（移动超过阈值才真正开始）
  function onPendingMove(e) {
    if (!isPendingDrag) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      // 超过阈值 → 确认拖拽，真正开始
      cancelPendingListeners();
      startMultiDrag(pendingElements, startX, startY);
      // 立即应用已有的偏移
      applyDrag(e);
    }
  }

  // 鼠标释放但没超过阈值 → 取消，不是拖拽
  function onPendingUp(e) {
    cancelPending();
  }

  function cancelPending() {
    isPendingDrag = false;
    pendingElements = null;
    cancelPendingListeners();
  }

  function cancelPendingListeners() {
    document.removeEventListener('mousemove', onPendingMove, true);
    document.removeEventListener('mouseup', onPendingUp, true);
  }

  function startMultiDrag(elements, x, y) {
    isDraggingFlag = true;
    dragTargets = [...elements];

    origStates = [];
    beforeStates = [];

    for (const el of dragTargets) {
      // 读取当前 transform 中的 translate 值
      const currentTransform = el.style.transform || '';
      const { tx, ty } = parseTranslate(currentTransform);

      origStates.push({ origTx: tx, origTy: ty });

      beforeStates.push({
        transform: el.style.transform || ''
      });

      el.setAttribute('data-hve-dragging', 'true');
    }

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
  }

  /**
   * 解析 transform 中的 translate 值
   */
  function parseTranslate(transform) {
    const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
    if (match) {
      return { tx: parseFloat(match[1]) || 0, ty: parseFloat(match[2]) || 0 };
    }
    return { tx: 0, ty: 0 };
  }

  /**
   * 设置 transform: translate()，保留其他 transform 属性
   */
  function setTranslate(el, tx, ty) {
    const current = el.style.transform || '';
    // 移除已有的 translate
    const cleaned = current.replace(/translate\([^)]+\)\s*/g, '').trim();
    const translateStr = `translate(${tx}px, ${ty}px)`;
    el.style.transform = cleaned ? `${translateStr} ${cleaned}` : translateStr;
  }

  function applyDrag(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // 检查对齐辅助线并获取吸附偏移
    let snapDx = 0, snapDy = 0;
    if (window.HVE_AlignGuide && !e.altKey) {
      const previewRects = dragTargets.map((el, i) => {
        const orig = origStates[i];
        const rect = el.getBoundingClientRect();
        return {
          left: rect.left + dx + snapDx,
          top: rect.top + dy + snapDy,
          right: rect.right + dx + snapDx,
          bottom: rect.bottom + dy + snapDy,
          width: rect.width,
          height: rect.height
        };
      });
      const snap = window.HVE_AlignGuide.checkAlignment(dragTargets, dx, dy, previewRects);
      snapDx = snap.snapDx;
      snapDy = snap.snapDy;
    }

    // 使用 transform: translate() 移动，不影响文档流
    for (let i = 0; i < dragTargets.length; i++) {
      const el = dragTargets[i];
      const orig = origStates[i];
      setTranslate(el, orig.origTx + dx + snapDx, orig.origTy + dy + snapDy);
    }
  }

  function onMouseMove(e) {
    if (!isDraggingFlag || dragTargets.length === 0) return;
    // 使用 rAF 节流，减少高频重排
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (isDraggingFlag) applyDrag(e);
    });
  }

  function onMouseUp(e) {
    if (!isDraggingFlag || dragTargets.length === 0) return;

    // 取消未执行的 rAF
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // 清除对齐辅助线
    if (window.HVE_AlignGuide) window.HVE_AlignGuide.clearGuides();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const hasMoved = Math.abs(dx) > 2 || Math.abs(dy) > 2;

    for (let i = 0; i < dragTargets.length; i++) {
      const el = dragTargets[i];
      el.removeAttribute('data-hve-dragging');

      if (hasMoved) {
        // 移动了足够距离，记录历史
        if (window.HVE_History) {
          window.HVE_History.record({
            type: 'move',
            element: el,
            before: { transform: beforeStates[i].transform },
            after: { transform: el.style.transform || '' },
            description: dragTargets.length > 1 ? '批量移动元素' : '移动元素'
          });
        }
      } else {
        // 没有移动足够距离，恢复到拖拽前的状态
        el.style.transform = beforeStates[i].transform;
      }
    }

    // 重新附着 resize 手柄（仅单选）
    if (dragTargets.length === 1 && window.HVE_Resize) {
      window.HVE_Resize.attachTo(dragTargets[0]);
    }

    cancelDrag(true);
  }

  function cancelDrag(fromMouseUp) {
    for (let i = 0; i < dragTargets.length; i++) {
      const el = dragTargets[i];
      el.removeAttribute('data-hve-dragging');
      // 仅在异常取消时恢复（非正常 mouseup 结束）
      if (!fromMouseUp && beforeStates[i] && isDraggingFlag) {
        el.style.transform = beforeStates[i].transform;
      }
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    isDraggingFlag = false;
    dragTargets = [];
    origStates = [];
    beforeStates = [];
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
  }

  function isDragging() {
    return isDraggingFlag || isPendingDrag;
  }

  return { activate, deactivate, isDragging };
})();
