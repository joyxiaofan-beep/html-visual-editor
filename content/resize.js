// resize.js — 元素缩放调整
window.HVE_Resize = (function () {
  let currentTarget = null;
  let isResizingFlag = false;
  let activeHandle = null;
  let startX = 0, startY = 0;
  let origWidth = 0, origHeight = 0;
  let origLeft = 0, origTop = 0;
  let beforeState = null;

  // 容器用于放置 resize 手柄
  let handleContainer = null;

  // 8 个方向的手柄
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function createHandleContainer() {
    if (handleContainer) return;
    handleContainer = document.createElement('div');
    handleContainer.setAttribute('data-hve-editor', 'true');
    handleContainer.setAttribute('data-hve-resize-container', 'true');
    handleContainer.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483640;';
    document.body.appendChild(handleContainer);
  }

  function attachTo(el) {
    if (!el) return;
    detach();
    currentTarget = el;
    createHandleContainer();
    updateHandlePositions();
    handleContainer.style.display = 'block';
  }

  function detach() {
    currentTarget = null;
    if (handleContainer) {
      handleContainer.innerHTML = '';
      handleContainer.style.display = 'none';
    }
  }

  function updateHandlePositions() {
    if (!currentTarget || !handleContainer) return;

    const rect = currentTarget.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    handleContainer.style.left = (rect.left + scrollX) + 'px';
    handleContainer.style.top = (rect.top + scrollY) + 'px';
    handleContainer.style.width = rect.width + 'px';
    handleContainer.style.height = rect.height + 'px';
    handleContainer.innerHTML = '';

    HANDLES.forEach(dir => {
      const handle = document.createElement('div');
      handle.setAttribute('data-hve-editor', 'true');
      handle.setAttribute('data-hve-handle', dir);
      handle.style.cssText = getHandleStyle(dir);
      handle.addEventListener('mousedown', (e) => onHandleMouseDown(e, dir));
      handleContainer.appendChild(handle);
    });
  }

  function getHandleStyle(dir) {
    const size = 10;
    const half = -size / 2;
    let base = `position:absolute;width:${size}px;height:${size}px;background:#D97706;border:2px solid white;border-radius:3px;pointer-events:all;z-index:2147483641;box-shadow:0 1px 3px rgba(0,0,0,0.2);`;

    const cursors = {
      nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize',
      e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize',
      sw: 'nesw-resize', w: 'ew-resize'
    };
    base += `cursor:${cursors[dir]};`;

    switch (dir) {
      case 'nw': base += `left:${half}px;top:${half}px;`; break;
      case 'n':  base += `left:calc(50% + ${half}px);top:${half}px;`; break;
      case 'ne': base += `right:${half}px;top:${half}px;`; break;
      case 'e':  base += `right:${half}px;top:calc(50% + ${half}px);`; break;
      case 'se': base += `right:${half}px;bottom:${half}px;`; break;
      case 's':  base += `left:calc(50% + ${half}px);bottom:${half}px;`; break;
      case 'sw': base += `left:${half}px;bottom:${half}px;`; break;
      case 'w':  base += `left:${half}px;top:calc(50% + ${half}px);`; break;
    }

    return base;
  }

  function onHandleMouseDown(e, direction) {
    e.preventDefault();
    e.stopPropagation();

    if (!currentTarget) return;

    isResizingFlag = true;
    activeHandle = direction;
    startX = e.clientX;
    startY = e.clientY;

    const computed = window.getComputedStyle(currentTarget);
    origWidth = parseFloat(computed.width);
    origHeight = parseFloat(computed.height);

    // 读取当前 transform 中的 translate 值（与 drag-move.js 保持一致）
    const transform = currentTarget.style.transform || '';
    const translateMatch = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
    origLeft = translateMatch ? parseFloat(translateMatch[1]) || 0 : 0;
    origTop = translateMatch ? parseFloat(translateMatch[2]) || 0 : 0;

    beforeState = {
      width: currentTarget.style.width || '',
      height: currentTarget.style.height || '',
      transform: currentTarget.style.transform || ''
    };

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
  }

  function onMouseMove(e) {
    if (!isResizingFlag || !currentTarget) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newWidth = origWidth;
    let newHeight = origHeight;
    let newLeft = origLeft;
    let newTop = origTop;

    const dir = activeHandle;

    // 根据方向计算新尺寸
    if (dir.includes('e')) { newWidth = Math.max(20, origWidth + dx); }
    if (dir.includes('w')) { newWidth = Math.max(20, origWidth - dx); newLeft = origLeft + dx; }
    if (dir.includes('s')) { newHeight = Math.max(20, origHeight + dy); }
    if (dir.includes('n')) { newHeight = Math.max(20, origHeight - dy); newTop = origTop + dy; }

    // Shift 键保持比例
    if (e.shiftKey) {
      const ratio = origWidth / origHeight;
      if (dir === 'e' || dir === 'w') {
        newHeight = newWidth / ratio;
      } else if (dir === 'n' || dir === 's') {
        newWidth = newHeight * ratio;
      } else {
        // 对角手柄
        const avgScale = ((newWidth / origWidth) + (newHeight / origHeight)) / 2;
        newWidth = origWidth * avgScale;
        newHeight = origHeight * avgScale;
      }
    }

    currentTarget.style.width = newWidth + 'px';
    currentTarget.style.height = newHeight + 'px';

    if (dir.includes('w') || dir.includes('n')) {
      // 使用 transform: translate() 来补偿位置偏移，与 drag-move.js 一致
      const tx = dir.includes('w') ? newLeft : origLeft;
      const ty = dir.includes('n') ? newTop : origTop;
      const current = currentTarget.style.transform || '';
      const cleaned = current.replace(/translate\([^)]+\)\s*/g, '').trim();
      const translateStr = `translate(${tx}px, ${ty}px)`;
      currentTarget.style.transform = cleaned ? `${translateStr} ${cleaned}` : translateStr;
    }

    updateHandlePositions();
  }

  function onMouseUp(e) {
    if (!isResizingFlag) return;

    // 记录历史
    if (window.HVE_History && currentTarget) {
      window.HVE_History.record({
        type: 'resize',
        element: currentTarget,
        before: { ...beforeState },
        after: {
          width: currentTarget.style.width,
          height: currentTarget.style.height,
          transform: currentTarget.style.transform || ''
        },
        description: '调整元素大小'
      });
    }

    isResizingFlag = false;
    activeHandle = null;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);

    updateHandlePositions();
  }

  function isResizing() {
    return isResizingFlag;
  }

  function destroy() {
    detach();
    if (handleContainer && handleContainer.parentNode) {
      handleContainer.parentNode.removeChild(handleContainer);
    }
    handleContainer = null;
  }

  return { attachTo, detach, updateHandlePositions, isResizing, destroy };
})();
