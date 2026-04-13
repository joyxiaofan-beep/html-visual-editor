// canvas-mode.js — Canvas 画板模式（Figma 风格自由画布）v1.0
window.HVE_Canvas = (function () {
  let isActive = false;
  let canvasOverlay = null;    // 覆盖层容器
  let canvas = null;           // HTML5 Canvas 元素
  let ctx = null;              // 2D 上下文
  let canvasToolbar = null;    // Canvas 专属工具栏

  // 画布状态
  let objects = [];            // 所有画布对象
  let selectedObj = null;      // 当前选中的对象
  let hoveredObj = null;       // 当前悬停的对象
  let dragState = null;        // 拖拽状态
  let resizeState = null;      // 缩放状态
  let isCreating = false;      // 正在创建新对象
  let createStart = null;      // 创建起点
  let currentTool = 'select';  // 当前工具：select | text | rect | ellipse | line | arrow
  let editingText = null;      // 正在编辑文本的对象
  let textInput = null;        // 文本输入框元素
  let spacePressed = false;    // 空格键是否按下（用于平移模式）
  let hoverThrottled = false;  // hover 检测节流标志

  // 画布视口（支持平移缩放）
  let viewportX = 0;
  let viewportY = 0;
  let viewportScale = 1;
  let isPanning = false;
  let panStart = null;

  // 常量
  const HANDLE_SIZE = 8;
  const SNAP_THRESHOLD = 6;
  const MIN_OBJ_SIZE = 10;
  const COLORS = {
    selection: '#D97706',
    selectionFill: 'rgba(217, 119, 6, 0.08)',
    hover: '#D97706',
    hoverDash: [4, 4],
    handle: '#FFFFFF',
    handleStroke: '#D97706',
    grid: 'rgba(0, 0, 0, 0.05)',
    canvasBg: '#F5F5F5',
  };

  // ============== 对象模型 ==============

  let nextId = 1;

  function createObject(type, props) {
    return {
      id: nextId++,
      type,          // 'text' | 'rect' | 'ellipse' | 'line' | 'arrow'
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      rotation: 0,
      // 样式
      fill: type === 'text' ? 'transparent' : '#FFFFFF',
      stroke: type === 'text' ? 'transparent' : '#333333',
      strokeWidth: type === 'text' ? 0 : 2,
      opacity: 1,
      // 文本属性
      text: type === 'text' ? '双击编辑文本' : '',
      fontSize: 16,
      fontFamily: 'SF Pro Text, -apple-system, sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#333333',
      lineHeight: 1.5,
      // 圆角
      borderRadius: 0,
      // 锁定
      locked: false,
      // 自定义属性覆盖
      ...props,
    };
  }

  // ============== 激活 / 停用 ==============

  function activate() {
    if (isActive) return;
    isActive = true;

    createCanvasOverlay();
    createCanvasToolbar();
    bindEvents();
    render();

    console.log('[HVE Canvas] ✅ 画板模式已开启');
  }

  function deactivate() {
    if (!isActive) return;
    isActive = false;

    finishTextEditing();
    unbindEvents();
    destroyCanvasToolbar();
    destroyCanvasOverlay();

    console.log('[HVE Canvas] ⛔ 画板模式已关闭');
  }

  function toggle() {
    if (isActive) deactivate(); else activate();
  }

  // ============== DOM 创建 ==============

  function createCanvasOverlay() {
    if (canvasOverlay) return;

    canvasOverlay = document.createElement('div');
    canvasOverlay.setAttribute('data-hve-editor', 'true');
    canvasOverlay.setAttribute('data-hve-canvas-overlay', 'true');

    canvas = document.createElement('canvas');
    canvas.setAttribute('data-hve-editor', 'true');
    canvas.setAttribute('data-hve-canvas', 'true');

    canvasOverlay.appendChild(canvas);
    document.body.appendChild(canvasOverlay);

    resizeCanvas();
  }

  function destroyCanvasOverlay() {
    if (canvasOverlay) {
      canvasOverlay.remove();
      canvasOverlay = null;
      canvas = null;
      ctx = null;
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    render();
  }

  // ============== Canvas 工具栏 ==============

  function createCanvasToolbar() {
    if (canvasToolbar) return;

    canvasToolbar = document.createElement('div');
    canvasToolbar.setAttribute('data-hve-editor', 'true');
    canvasToolbar.setAttribute('data-hve-canvas-toolbar', 'true');

    canvasToolbar.innerHTML = `
      <div class="hve-cvs-tb-group">
        <button data-cvs-tool="select" class="hve-cvs-active" title="选择工具 (V)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l7 17 2.5-6.5L20 12z"/></svg>
        </button>
        <button data-cvs-tool="text" title="文本框 (T)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>
        </button>
        <button data-cvs-tool="rect" title="矩形 (R)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </button>
        <button data-cvs-tool="ellipse" title="椭圆 (O)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg>
        </button>
        <button data-cvs-tool="line" title="线条 (L)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/></svg>
        </button>
        <button data-cvs-tool="arrow" title="箭头 (A)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/><polyline points="10,4 20,4 20,14"/></svg>
        </button>
      </div>
      <div class="hve-cvs-tb-sep"></div>
      <div class="hve-cvs-tb-group">
        <button data-cvs-action="fill-color" title="填充颜色" style="position:relative;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
          <span class="hve-cvs-color-dot" data-role="fill-dot" style="background:#FFFFFF;"></span>
        </button>
        <button data-cvs-action="stroke-color" title="边框颜色" style="position:relative;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="4 2"/></svg>
          <span class="hve-cvs-color-dot" data-role="stroke-dot" style="background:#333333;"></span>
        </button>
        <button data-cvs-action="stroke-width" title="线条粗细">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="3" y1="6" x2="21" y2="6" stroke-width="1"/><line x1="3" y1="12" x2="21" y2="12" stroke-width="2.5"/><line x1="3" y1="18" x2="21" y2="18" stroke-width="4"/></svg>
        </button>
      </div>
      <div class="hve-cvs-tb-sep"></div>
      <div class="hve-cvs-tb-group">
        <button data-cvs-action="bring-front" title="上移层级">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="18,15 12,9 6,15"/></svg>
        </button>
        <button data-cvs-action="send-back" title="下移层级">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6,9 12,15 18,9"/></svg>
        </button>
        <button data-cvs-action="delete" title="删除 (Del)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
      <div class="hve-cvs-tb-sep"></div>
      <div class="hve-cvs-tb-group">
        <button data-cvs-action="export-svg" title="导出为 SVG">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button data-cvs-action="insert-to-page" title="插入到页面">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button data-cvs-action="exit-canvas" title="退出画板模式">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;

    canvasToolbar.addEventListener('click', onCanvasToolbarClick);
    document.body.appendChild(canvasToolbar);
  }

  function destroyCanvasToolbar() {
    if (canvasToolbar) {
      canvasToolbar.remove();
      canvasToolbar = null;
    }
  }

  function onCanvasToolbarClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    const tool = btn.getAttribute('data-cvs-tool');
    const action = btn.getAttribute('data-cvs-action');

    if (tool) {
      setTool(tool);
    } else if (action) {
      handleToolbarAction(action);
    }
  }

  function setTool(tool) {
    currentTool = tool;
    // 更新工具栏激活状态
    if (canvasToolbar) {
      canvasToolbar.querySelectorAll('[data-cvs-tool]').forEach(btn => {
        btn.classList.toggle('hve-cvs-active', btn.getAttribute('data-cvs-tool') === tool);
      });
    }
    // 更新光标
    updateCursor();
    // 退出文本编辑
    if (tool !== 'text') {
      finishTextEditing();
    }
  }

  function updateCursor() {
    if (!canvas) return;
    switch (currentTool) {
      case 'select':
        canvas.style.cursor = hoveredObj ? 'move' : 'default';
        break;
      case 'text':
        canvas.style.cursor = 'text';
        break;
      case 'rect':
      case 'ellipse':
        canvas.style.cursor = 'crosshair';
        break;
      case 'line':
      case 'arrow':
        canvas.style.cursor = 'crosshair';
        break;
    }
  }

  function handleToolbarAction(action) {
    switch (action) {
      case 'delete':
        deleteSelected();
        break;
      case 'bring-front':
        bringToFront();
        break;
      case 'send-back':
        sendToBack();
        break;
      case 'fill-color':
        showColorPicker('fill');
        break;
      case 'stroke-color':
        showColorPicker('stroke');
        break;
      case 'stroke-width':
        showStrokeWidthMenu();
        break;
      case 'export-svg':
        exportToSVG();
        break;
      case 'insert-to-page':
        insertToPage();
        break;
      case 'exit-canvas':
        deactivate();
        break;
    }
  }

  // ============== 事件绑定 ==============

  function bindEvents() {
    if (!canvas) return;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('resize', onResize);
  }

  function unbindEvents() {
    if (canvas) {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('wheel', onWheel);
    }
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('resize', onResize);
    // 重置空格键状态
    spacePressed = false;
  }

  function onResize() {
    resizeCanvas();
  }

  // ============== 坐标转换 ==============

  function screenToCanvas(sx, sy) {
    return {
      x: (sx - viewportX) / viewportScale,
      y: (sy - viewportY) / viewportScale,
    };
  }

  function canvasToScreen(cx, cy) {
    return {
      x: cx * viewportScale + viewportX,
      y: cy * viewportScale + viewportY,
    };
  }

  // ============== 鼠标事件 ==============

  function onMouseDown(e) {
    if (!isActive) return;
    // 仅阻止 canvas 元素上的默认行为，避免影响页面其他交互
    if (e.target === canvas) e.preventDefault();

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    // 空格键 + 拖拽 = 平移画布
    if (e.button === 1 || (e.button === 0 && spacePressed) || (e.button === 0 && isPanning)) {
      panStart = { x: e.clientX - viewportX, y: e.clientY - viewportY };
      isPanning = true;
      canvas.style.cursor = 'grabbing';
      return;
    }

    // 选择工具
    if (currentTool === 'select') {
      // 检查是否点击了缩放手柄
      if (selectedObj) {
        const handle = getHandleAtPoint(x, y, selectedObj);
        if (handle) {
          resizeState = {
            handle,
            obj: selectedObj,
            startX: x,
            startY: y,
            origX: selectedObj.x,
            origY: selectedObj.y,
            origW: selectedObj.width,
            origH: selectedObj.height,
          };
          return;
        }
      }

      // 检查是否点击了某个对象
      const hit = hitTest(x, y);
      if (hit) {
        selectObject(hit);
        dragState = {
          obj: hit,
          startX: x,
          startY: y,
          origX: hit.x,
          origY: hit.y,
          moved: false,
        };
      } else {
        selectObject(null);
      }
      return;
    }

    // 绘制工具 — 开始创建对象
    if (['rect', 'ellipse', 'line', 'arrow', 'text'].includes(currentTool)) {
      isCreating = true;
      createStart = { x, y };

      if (currentTool === 'text') {
        // 文本工具：立即创建文本框并进入编辑
        const textObj = createObject('text', {
          x, y,
          width: 200,
          height: 40,
          text: '',
        });
        objects.push(textObj);
        selectObject(textObj);
        isCreating = false;
        startTextEditing(textObj);
        recordHistory('create', textObj);
        return;
      }
    }
  }

  function onMouseMove(e) {
    if (!isActive) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    // 平移画布
    if (isPanning && panStart) {
      viewportX = e.clientX - panStart.x;
      viewportY = e.clientY - panStart.y;
      render();
      return;
    }

    // 缩放拖拽
    if (resizeState) {
      handleResize(x, y);
      render();
      return;
    }

    // 拖拽移动
    if (dragState) {
      const dx = x - dragState.startX;
      const dy = y - dragState.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragState.moved = true;
      }
      dragState.obj.x = dragState.origX + dx;
      dragState.obj.y = dragState.origY + dy;
      render();
      return;
    }

    // 创建拖拽
    if (isCreating && createStart) {
      render();
      // 绘制创建预览
      drawCreatePreview(x, y);
      return;
    }

    // Hover 检测（节流：空闲时才更新，避免频繁 hitTest）
    if (!dragState && !resizeState && !isCreating) {
      if (!hoverThrottled) {
        hoverThrottled = true;
        requestAnimationFrame(() => {
          hoverThrottled = false;
          if (!isActive) return;
          const hit = hitTest(x, y);
          if (hit !== hoveredObj) {
            hoveredObj = hit;
            updateCursor();
            render();
          }
        });
      }
    }
  }

  function onMouseUp(e) {
    if (!isActive) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    // 结束平移
    if (isPanning) {
      isPanning = false;
      panStart = null;
      updateCursor();
      return;
    }

    // 结束缩放
    if (resizeState) {
      recordHistory('resize', resizeState.obj, {
        before: {
          x: resizeState.origX, y: resizeState.origY,
          width: resizeState.origW, height: resizeState.origH,
        },
        after: {
          x: resizeState.obj.x, y: resizeState.obj.y,
          width: resizeState.obj.width, height: resizeState.obj.height,
        },
      });
      resizeState = null;
      return;
    }

    // 结束拖拽
    if (dragState) {
      if (dragState.moved) {
        recordHistory('move', dragState.obj, {
          before: { x: dragState.origX, y: dragState.origY },
          after: { x: dragState.obj.x, y: dragState.obj.y },
        });
      }
      dragState = null;
      return;
    }

    // 结束创建
    if (isCreating && createStart) {
      const w = Math.abs(x - createStart.x);
      const h = Math.abs(y - createStart.y);

      if (w > MIN_OBJ_SIZE || h > MIN_OBJ_SIZE || currentTool === 'line' || currentTool === 'arrow') {
        const obj = createObject(currentTool, {
          x: Math.min(createStart.x, x),
          y: Math.min(createStart.y, y),
          width: Math.max(w, MIN_OBJ_SIZE),
          height: Math.max(h, MIN_OBJ_SIZE),
        });

        // 线条和箭头存储端点
        if (currentTool === 'line' || currentTool === 'arrow') {
          obj.x1 = createStart.x;
          obj.y1 = createStart.y;
          obj.x2 = x;
          obj.y2 = y;
          obj.x = Math.min(createStart.x, x);
          obj.y = Math.min(createStart.y, y);
          obj.width = Math.abs(x - createStart.x) || 1;
          obj.height = Math.abs(y - createStart.y) || 1;
        }

        objects.push(obj);
        selectObject(obj);
        recordHistory('create', obj);

        // 创建后切回选择工具
        setTool('select');
      }

      isCreating = false;
      createStart = null;
      render();
    }
  }

  function onDblClick(e) {
    if (!isActive) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (currentTool === 'select') {
      const hit = hitTest(x, y);
      if (hit && (hit.type === 'text' || hit.type === 'rect' || hit.type === 'ellipse')) {
        // 双击对象 → 进入文本编辑
        if (!hit.text && hit.type !== 'text') {
          hit.text = '';
        }
        startTextEditing(hit);
      }
    }
  }

  function onWheel(e) {
    if (!isActive) return;
    e.preventDefault();

    // Ctrl+滚轮 = 缩放
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(5, viewportScale * delta));

      // 以鼠标位置为中心缩放
      const mx = e.clientX;
      const my = e.clientY;
      viewportX = mx - (mx - viewportX) * (newScale / viewportScale);
      viewportY = my - (my - viewportY) * (newScale / viewportScale);
      viewportScale = newScale;
    } else {
      // 普通滚轮 = 平移
      viewportX -= e.deltaX;
      viewportY -= e.deltaY;
    }

    render();
  }

  function onKeyDown(e) {
    if (!isActive) return;
    // 如果正在编辑文本，大部分键交给 input
    if (editingText && textInput) {
      if (e.key === 'Escape') {
        finishTextEditing();
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // 工具快捷键
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); e.preventDefault(); e.stopPropagation(); return;
        case 't': setTool('text'); e.preventDefault(); e.stopPropagation(); return;
        case 'r': setTool('rect'); e.preventDefault(); e.stopPropagation(); return;
        case 'o': setTool('ellipse'); e.preventDefault(); e.stopPropagation(); return;
        case 'l': setTool('line'); e.preventDefault(); e.stopPropagation(); return;
        case 'a': setTool('arrow'); e.preventDefault(); e.stopPropagation(); return;
      }
    }

    // 删除选中对象
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObj) {
      e.preventDefault();
      e.stopPropagation();
      deleteSelected();
      return;
    }

    // Ctrl+Z 撤销
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      undo();
      return;
    }

    // Ctrl+Y / Ctrl+Shift+Z 重做
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      e.stopPropagation();
      redo();
      return;
    }

    // Ctrl+D 复制
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedObj) {
      e.preventDefault();
      e.stopPropagation();
      duplicateSelected();
      return;
    }

    // 方向键微调
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedObj) {
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowUp') selectedObj.y -= step;
      if (e.key === 'ArrowDown') selectedObj.y += step;
      if (e.key === 'ArrowLeft') selectedObj.x -= step;
      if (e.key === 'ArrowRight') selectedObj.x += step;
      // 防抖记录历史：清除上一次定时器，200ms 内无新输入时才记录
      clearTimeout(selectedObj._arrowTimer);
      if (!selectedObj._arrowStartPos) {
        selectedObj._arrowStartPos = { x: selectedObj.x + (e.key === 'ArrowLeft' ? step : (e.key === 'ArrowRight' ? -step : 0)),
                                        y: selectedObj.y + (e.key === 'ArrowUp' ? step : (e.key === 'ArrowDown' ? -step : 0)) };
      }
      const startPos = selectedObj._arrowStartPos;
      selectedObj._arrowTimer = setTimeout(() => {
        recordHistory('move', selectedObj, { before: startPos, after: { x: selectedObj.x, y: selectedObj.y } });
        selectedObj._arrowStartPos = null;
      }, 200);
      render();
      return;
    }

    // Escape 取消选择或退出画板
    if (e.key === 'Escape') {
      if (selectedObj) {
        selectObject(null);
      } else {
        deactivate();
      }
      e.preventDefault();
      e.stopPropagation();
    }

    // 空格键 进入平移模式
    if (e.key === ' ' && !spacePressed) {
      spacePressed = true;
      isPanning = true;
      canvas.style.cursor = 'grab';
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // 键盘释放事件
  function onKeyUp(e) {
    if (!isActive) return;
    if (e.key === ' ') {
      spacePressed = false;
      isPanning = false;
      updateCursor();
    }
  }

  // ============== 碰撞检测 ==============

  function hitTest(x, y) {
    // 从上层到下层遍历（后绘制的在上面）
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (isPointInObject(x, y, obj)) {
        return obj;
      }
    }
    return null;
  }

  function isPointInObject(x, y, obj) {
    switch (obj.type) {
      case 'line':
      case 'arrow':
        return isPointNearLine(x, y, obj.x1, obj.y1, obj.x2, obj.y2, 6);
      case 'ellipse':
        return isPointInEllipse(x, y, obj);
      default:
        return x >= obj.x && x <= obj.x + obj.width &&
               y >= obj.y && y <= obj.y + obj.height;
    }
  }

  function isPointNearLine(px, py, x1, y1, x2, y2, threshold) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1) < threshold;
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const nx = x1 + t * dx;
    const ny = y1 + t * dy;
    return Math.hypot(px - nx, py - ny) < threshold;
  }

  function isPointInEllipse(x, y, obj) {
    const cx = obj.x + obj.width / 2;
    const cy = obj.y + obj.height / 2;
    const rx = obj.width / 2;
    const ry = obj.height / 2;
    return ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry) <= 1;
  }

  // ============== 缩放手柄 ==============

  function getHandleAtPoint(x, y, obj) {
    if (!obj || obj.type === 'line' || obj.type === 'arrow') return null;

    const hs = HANDLE_SIZE / viewportScale;
    const handles = getHandlePositions(obj);

    for (const [name, hx, hy] of handles) {
      if (Math.abs(x - hx) < hs && Math.abs(y - hy) < hs) {
        return name;
      }
    }
    return null;
  }

  function getHandlePositions(obj) {
    const { x, y, width: w, height: h } = obj;
    return [
      ['nw', x, y],
      ['n', x + w / 2, y],
      ['ne', x + w, y],
      ['e', x + w, y + h / 2],
      ['se', x + w, y + h],
      ['s', x + w / 2, y + h],
      ['sw', x, y + h],
      ['w', x, y + h / 2],
    ];
  }

  function handleResize(x, y) {
    const { handle, obj, origX, origY, origW, origH, startX, startY } = resizeState;
    const dx = x - startX;
    const dy = y - startY;

    let nx = origX, ny = origY, nw = origW, nh = origH;

    if (handle.includes('e')) { nw = Math.max(MIN_OBJ_SIZE, origW + dx); }
    if (handle.includes('w')) { nw = Math.max(MIN_OBJ_SIZE, origW - dx); nx = origX + origW - nw; }
    if (handle.includes('s')) { nh = Math.max(MIN_OBJ_SIZE, origH + dy); }
    if (handle.includes('n')) { nh = Math.max(MIN_OBJ_SIZE, origH - dy); ny = origY + origH - nh; }

    obj.x = nx;
    obj.y = ny;
    obj.width = nw;
    obj.height = nh;
  }

  // ============== 对象操作 ==============

  function selectObject(obj) {
    selectedObj = obj;
    render();
    // 更新 Canvas 工具栏中的颜色指示器
    updateColorIndicators();
  }

  function deleteSelected() {
    if (!selectedObj) return;
    const idx = objects.indexOf(selectedObj);
    if (idx === -1) return;

    recordHistory('delete', selectedObj, { index: idx });
    objects.splice(idx, 1);
    selectObject(null);
    render();
  }

  function duplicateSelected() {
    if (!selectedObj) return;
    const clone = { ...selectedObj, id: nextId++, x: selectedObj.x + 20, y: selectedObj.y + 20 };
    objects.push(clone);
    recordHistory('create', clone);
    selectObject(clone);
    render();
  }

  function bringToFront() {
    if (!selectedObj) return;
    const idx = objects.indexOf(selectedObj);
    if (idx === -1 || idx === objects.length - 1) return;
    objects.splice(idx, 1);
    objects.push(selectedObj);
    render();
  }

  function sendToBack() {
    if (!selectedObj) return;
    const idx = objects.indexOf(selectedObj);
    if (idx <= 0) return;
    objects.splice(idx, 1);
    objects.unshift(selectedObj);
    render();
  }

  // ============== 文本编辑 ==============

  function startTextEditing(obj) {
    if (editingText === obj) return;
    finishTextEditing();

    editingText = obj;

    // 创建一个覆盖在对象上方的 textarea
    textInput = document.createElement('textarea');
    textInput.setAttribute('data-hve-editor', 'true');
    textInput.setAttribute('data-hve-canvas-textinput', 'true');

    const pos = canvasToScreen(obj.x, obj.y);
    textInput.style.cssText = `
      position: fixed;
      left: ${pos.x}px;
      top: ${pos.y}px;
      width: ${obj.width * viewportScale}px;
      min-height: ${obj.height * viewportScale}px;
      font-size: ${obj.fontSize * viewportScale}px;
      font-family: ${obj.fontFamily};
      font-weight: ${obj.fontWeight};
      font-style: ${obj.fontStyle};
      color: ${obj.color};
      text-align: ${obj.textAlign};
      line-height: ${obj.lineHeight};
      background: transparent;
      border: 2px solid #2563EB;
      border-radius: 4px;
      outline: none;
      padding: 4px 6px;
      resize: none;
      overflow: hidden;
      z-index: 2147483647;
      box-sizing: border-box;
    `;
    textInput.value = obj.text || '';
    document.body.appendChild(textInput);

    textInput.focus();
    textInput.select();

    // 自动调整高度
    textInput.addEventListener('input', () => {
      textInput.style.height = 'auto';
      textInput.style.height = textInput.scrollHeight + 'px';
    });
  }

  function finishTextEditing() {
    if (!editingText || !textInput) return;

    const oldText = editingText.text;
    editingText.text = textInput.value;

    // 根据输入内容调整对象尺寸
    if (textInput.value) {
      editingText.height = Math.max(editingText.height, textInput.scrollHeight / viewportScale);
    }

    if (oldText !== editingText.text) {
      recordHistory('text', editingText, {
        before: { text: oldText },
        after: { text: editingText.text },
      });
    }

    textInput.remove();
    textInput = null;
    editingText = null;
    render();
  }

  // ============== 渲染引擎 ==============

  let renderPending = false;

  function render() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      renderImmediate();
    });
  }

  function renderImmediate() {
    if (!ctx || !canvas) return;

    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    // 清空画布
    ctx.clearRect(0, 0, w, h);

    // 绘制背景
    ctx.fillStyle = COLORS.canvasBg;
    ctx.fillRect(0, 0, w, h);

    // 绘制网格
    drawGrid(w, h);

    // 应用视口变换
    ctx.save();
    ctx.translate(viewportX, viewportY);
    ctx.scale(viewportScale, viewportScale);

    // 绘制所有对象
    for (const obj of objects) {
      drawObject(obj);
    }

    // 绘制 hover 高亮
    if (hoveredObj && hoveredObj !== selectedObj) {
      drawHover(hoveredObj);
    }

    // 绘制选中框 + 手柄
    if (selectedObj) {
      drawSelection(selectedObj);
    }

    ctx.restore();

    // 绘制缩放信息
    drawViewportInfo(w, h);
  }

  function drawGrid(w, h) {
    const gridSize = 20 * viewportScale;
    if (gridSize < 5) return; // 太密就不画了

    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;

    const offsetX = viewportX % gridSize;
    const offsetY = viewportY % gridSize;

    ctx.beginPath();
    for (let x = offsetX; x < w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = offsetY; y < h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawObject(obj) {
    ctx.save();
    ctx.globalAlpha = obj.opacity;

    switch (obj.type) {
      case 'rect':
        drawRect(obj);
        break;
      case 'ellipse':
        drawEllipse(obj);
        break;
      case 'text':
        drawTextBox(obj);
        break;
      case 'line':
        drawLine(obj);
        break;
      case 'arrow':
        drawArrow(obj);
        break;
    }

    ctx.restore();
  }

  function drawRect(obj) {
    const { x, y, width: w, height: h, fill, stroke, strokeWidth, borderRadius: r } = obj;

    ctx.beginPath();
    if (r > 0) {
      roundRect(ctx, x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }

    if (fill && fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && stroke !== 'transparent' && strokeWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }

    // 如果有文本，也绘制
    if (obj.text) {
      drawTextInBounds(obj);
    }
  }

  function drawEllipse(obj) {
    const { x, y, width: w, height: h, fill, stroke, strokeWidth } = obj;
    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);

    if (fill && fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && stroke !== 'transparent' && strokeWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }

    if (obj.text) {
      drawTextInBounds(obj);
    }
  }

  function drawTextBox(obj) {
    // 文本框只绘制文本（如果没在编辑中）
    if (editingText === obj) return;

    if (obj.fill && obj.fill !== 'transparent') {
      ctx.fillStyle = obj.fill;
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    }
    if (obj.stroke && obj.stroke !== 'transparent' && obj.strokeWidth > 0) {
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = obj.strokeWidth;
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    }

    drawTextInBounds(obj);
  }

  function drawTextInBounds(obj) {
    if (!obj.text || editingText === obj) return;

    ctx.save();
    ctx.fillStyle = obj.color || '#333333';
    ctx.font = `${obj.fontStyle || 'normal'} ${obj.fontWeight || 'normal'} ${obj.fontSize}px ${obj.fontFamily || 'sans-serif'}`;
    ctx.textBaseline = 'top';

    const padding = 6;
    const maxWidth = obj.width - padding * 2;
    const lines = wrapText(obj.text, maxWidth);
    const lineH = obj.fontSize * (obj.lineHeight || 1.5);

    let startY = obj.y + padding;

    for (const line of lines) {
      let textX = obj.x + padding;
      if (obj.textAlign === 'center') {
        const w = ctx.measureText(line).width;
        textX = obj.x + (obj.width - w) / 2;
      } else if (obj.textAlign === 'right') {
        const w = ctx.measureText(line).width;
        textX = obj.x + obj.width - padding - w;
      }
      ctx.fillText(line, textX, startY);
      startY += lineH;
    }

    ctx.restore();
  }

  function wrapText(text, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (!paragraph) { lines.push(''); continue; }

      const words = paragraph.split('');
      let line = '';

      for (const char of words) {
        const testLine = line + char;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line) {
          lines.push(line);
          line = char;
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line);
    }

    return lines;
  }

  function drawLine(obj) {
    if (!obj.x1) return;
    ctx.save();
    ctx.strokeStyle = obj.stroke || '#333333';
    ctx.lineWidth = obj.strokeWidth || 2;
    ctx.beginPath();
    ctx.moveTo(obj.x1, obj.y1);
    ctx.lineTo(obj.x2, obj.y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawArrow(obj) {
    if (!obj.x1) return;
    ctx.save();
    ctx.strokeStyle = obj.stroke || '#333333';
    ctx.lineWidth = obj.strokeWidth || 2;
    ctx.fillStyle = obj.stroke || '#333333';

    // 绘制线
    ctx.beginPath();
    ctx.moveTo(obj.x1, obj.y1);
    ctx.lineTo(obj.x2, obj.y2);
    ctx.stroke();

    // 绘制箭头头部
    const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1);
    const headLen = 12;
    ctx.beginPath();
    ctx.moveTo(obj.x2, obj.y2);
    ctx.lineTo(
      obj.x2 - headLen * Math.cos(angle - Math.PI / 6),
      obj.y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      obj.x2 - headLen * Math.cos(angle + Math.PI / 6),
      obj.y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawHover(obj) {
    ctx.save();
    ctx.strokeStyle = COLORS.hover;
    ctx.lineWidth = 1.5 / viewportScale;
    ctx.setLineDash(COLORS.hoverDash.map(d => d / viewportScale));

    if (obj.type === 'line' || obj.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(obj.x1, obj.y1);
      ctx.lineTo(obj.x2, obj.y2);
      ctx.stroke();
    } else if (obj.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2 + 3, obj.height / 2 + 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(obj.x - 2, obj.y - 2, obj.width + 4, obj.height + 4);
    }

    ctx.restore();
  }

  function drawSelection(obj) {
    ctx.save();

    // 选中框
    ctx.strokeStyle = COLORS.selection;
    ctx.lineWidth = 1.5 / viewportScale;
    ctx.setLineDash([]);

    if (obj.type === 'line' || obj.type === 'arrow') {
      // 线条选中：端点手柄
      drawHandle(obj.x1, obj.y1);
      drawHandle(obj.x2, obj.y2);
    } else {
      // 矩形选中框
      ctx.fillStyle = COLORS.selectionFill;
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

      // 8 个缩放手柄
      const handles = getHandlePositions(obj);
      for (const [, hx, hy] of handles) {
        drawHandle(hx, hy);
      }
    }

    // 尺寸信息
    const infoY = obj.y + obj.height + 16 / viewportScale;
    ctx.fillStyle = COLORS.selection;
    ctx.font = `${11 / viewportScale}px SF Pro Text, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${Math.round(obj.width)} × ${Math.round(obj.height)}`,
      obj.x + obj.width / 2,
      infoY
    );

    ctx.restore();
  }

  function drawHandle(x, y) {
    const hs = HANDLE_SIZE / 2 / viewportScale;
    ctx.fillStyle = COLORS.handle;
    ctx.strokeStyle = COLORS.handleStroke;
    ctx.lineWidth = 1.5 / viewportScale;
    ctx.fillRect(x - hs, y - hs, hs * 2, hs * 2);
    ctx.strokeRect(x - hs, y - hs, hs * 2, hs * 2);
  }

  function drawCreatePreview(x, y) {
    if (!createStart) return;

    ctx.save();
    ctx.translate(viewportX, viewportY);
    ctx.scale(viewportScale, viewportScale);

    ctx.strokeStyle = COLORS.selection;
    ctx.lineWidth = 1 / viewportScale;
    ctx.setLineDash([4 / viewportScale, 4 / viewportScale]);

    const sx = createStart.x, sy = createStart.y;

    switch (currentTool) {
      case 'rect':
        ctx.strokeRect(
          Math.min(sx, x), Math.min(sy, y),
          Math.abs(x - sx), Math.abs(y - sy)
        );
        break;
      case 'ellipse':
        const cx = (sx + x) / 2, cy = (sy + y) / 2;
        const rx = Math.abs(x - sx) / 2, ry = Math.abs(y - sy) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'line':
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(x, y);
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  function drawViewportInfo(w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.font = '11px SF Pro Text, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${Math.round(viewportScale * 100)}%`, w - 12, h - 12);
    ctx.restore();
  }

  // 圆角矩形辅助
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ============== 颜色选择器 ==============

  function showColorPicker(mode) {
    if (!selectedObj) return;

    const btn = canvasToolbar.querySelector(`[data-cvs-action="${mode}-color"]`);
    if (!btn) return;

    const currentColor = mode === 'fill' ? selectedObj.fill : selectedObj.stroke;

    // 创建简易颜色面板
    const panel = document.createElement('div');
    panel.setAttribute('data-hve-editor', 'true');
    panel.setAttribute('data-hve-canvas-colorpanel', 'true');

    const presetColors = [
      '#FFFFFF', '#F5F5F5', '#E5E7EB', '#9CA3AF', '#6B7280', '#374151', '#1F2937', '#111827', '#000000',
      '#FEF3C7', '#FDE68A', '#FCD34D', '#FBBF24', '#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F',
      '#DCFCE7', '#BBF7D0', '#86EFAC', '#4ADE80', '#22C55E', '#16A34A', '#15803D', '#166534', '#14532D',
      '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A',
      '#EDE9FE', '#DDD6FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95',
      '#FCE7F3', '#FBCFE8', '#F9A8D4', '#F472B6', '#EC4899', '#DB2777', '#BE185D', '#9D174D', '#831843',
      '#FEE2E2', '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D',
    ];

    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:3px;padding:8px;">
        ${presetColors.map(c => `
          <div class="hve-cvs-color-swatch" style="background:${c};${c === '#FFFFFF' ? 'border:1px solid #E5E7EB;' : ''}" data-color="${c}"></div>
        `).join('')}
      </div>
      <div style="padding:4px 8px 8px;display:flex;align-items:center;gap:6px;">
        <span style="font-size:11px;color:#666;">自定义:</span>
        <input type="color" value="${currentColor || '#333333'}" style="width:28px;height:24px;border:none;cursor:pointer;">
        <button class="hve-cvs-transparent-btn" data-color="transparent" style="font-size:11px;padding:2px 8px;border:1px solid #ddd;border-radius:4px;background:white;cursor:pointer;">透明</button>
      </div>
    `;

    // 定位
    const btnRect = btn.getBoundingClientRect();
    panel.style.cssText = `
      position: fixed;
      top: ${btnRect.bottom + 6}px;
      left: ${btnRect.left}px;
      background: white;
      border: 1px solid #E8E5E0;
      border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      z-index: 2147483647;
    `;

    // 事件
    panel.addEventListener('click', (e) => {
      const swatch = e.target.closest('[data-color]');
      if (swatch) {
        const color = swatch.getAttribute('data-color');
        applyColor(mode, color);
        panel.remove();
      }
    });

    const colorInput = panel.querySelector('input[type="color"]');
    colorInput.addEventListener('input', (e) => {
      applyColor(mode, e.target.value);
    });
    colorInput.addEventListener('change', () => {
      panel.remove();
    });

    document.body.appendChild(panel);

    // 点击外部关闭
    setTimeout(() => {
      document.addEventListener('click', function closePanel(ev) {
        if (!panel.contains(ev.target) && !btn.contains(ev.target)) {
          panel.remove();
          document.removeEventListener('click', closePanel);
        }
      });
    }, 0);
  }

  function applyColor(mode, color) {
    if (!selectedObj) return;
    const before = mode === 'fill' ? selectedObj.fill : selectedObj.stroke;

    if (mode === 'fill') {
      selectedObj.fill = color;
    } else {
      selectedObj.stroke = color;
    }

    recordHistory('style', selectedObj, {
      before: { [mode]: before },
      after: { [mode]: color },
    });

    updateColorIndicators();
    render();
  }

  function updateColorIndicators() {
    if (!canvasToolbar) return;
    const fillDot = canvasToolbar.querySelector('[data-role="fill-dot"]');
    const strokeDot = canvasToolbar.querySelector('[data-role="stroke-dot"]');

    if (selectedObj) {
      if (fillDot) fillDot.style.background = selectedObj.fill || '#FFFFFF';
      if (strokeDot) strokeDot.style.background = selectedObj.stroke || '#333333';
    }
  }

  function showStrokeWidthMenu() {
    if (!selectedObj) return;

    const btn = canvasToolbar.querySelector('[data-cvs-action="stroke-width"]');
    if (!btn) return;

    const widths = [0, 1, 2, 3, 4, 6, 8];

    const menu = document.createElement('div');
    menu.setAttribute('data-hve-editor', 'true');
    menu.setAttribute('data-hve-dropdown', 'true');

    widths.forEach(w => {
      const item = document.createElement('div');
      item.className = 'hve-dd-item';
      item.innerHTML = `
        <span style="display:inline-block;width:40px;height:${Math.max(w, 1)}px;background:${w === 0 ? 'transparent' : '#333'};border:${w === 0 ? '1px dashed #ccc' : 'none'};vertical-align:middle;margin-right:8px;"></span>
        <span>${w === 0 ? '无边框' : w + 'px'}</span>
      `;
      item.addEventListener('click', () => {
        const before = selectedObj.strokeWidth;
        selectedObj.strokeWidth = w;
        recordHistory('style', selectedObj, {
          before: { strokeWidth: before },
          after: { strokeWidth: w },
        });
        render();
        menu.remove();
      });
      menu.appendChild(item);
    });

    const btnRect = btn.getBoundingClientRect();
    menu.style.cssText = `
      position: fixed;
      top: ${btnRect.bottom + 4}px;
      left: ${btnRect.left + btnRect.width / 2}px;
      transform: translateX(-50%);
    `;
    document.body.appendChild(menu);

    setTimeout(() => {
      document.addEventListener('click', function close() {
        menu.remove();
        document.removeEventListener('click', close);
      }, { once: true });
    }, 0);
  }

  // ============== 历史记录 ==============

  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 80;

  function recordHistory(action, obj, data) {
    undoStack.push({ action, objId: obj.id, data, snapshot: JSON.parse(JSON.stringify(obj)) });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    const entry = undoStack.pop();
    redoStack.push(entry);

    switch (entry.action) {
      case 'create':
        objects = objects.filter(o => o.id !== entry.objId);
        break;
      case 'delete':
        objects.splice(entry.data.index, 0, entry.snapshot);
        break;
      case 'move':
      case 'resize':
      case 'style':
      case 'text': {
        const obj = objects.find(o => o.id === entry.objId);
        if (obj && entry.data?.before) {
          Object.assign(obj, entry.data.before);
        }
        break;
      }
    }

    selectObject(null);
    render();
  }

  function redo() {
    if (redoStack.length === 0) return;
    const entry = redoStack.pop();
    undoStack.push(entry);

    switch (entry.action) {
      case 'create':
        objects.push(entry.snapshot);
        break;
      case 'delete':
        objects = objects.filter(o => o.id !== entry.objId);
        break;
      case 'move':
      case 'resize':
      case 'style':
      case 'text': {
        const obj = objects.find(o => o.id === entry.objId);
        if (obj && entry.data?.after) {
          Object.assign(obj, entry.data.after);
        }
        break;
      }
    }

    selectObject(null);
    render();
  }

  // ============== 导出功能 ==============

  function exportToSVG() {
    if (objects.length === 0) {
      if (window.HVE_Core) window.HVE_Core.showToast('画布为空，无法导出', 'info');
      return;
    }

    // 计算边界
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of objects) {
      if (obj.type === 'line' || obj.type === 'arrow') {
        // 线条/箭头使用端点坐标
        minX = Math.min(minX, obj.x1, obj.x2);
        minY = Math.min(minY, obj.y1, obj.y2);
        maxX = Math.max(maxX, obj.x1, obj.x2);
        maxY = Math.max(maxY, obj.y1, obj.y2);
      } else {
        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);
        maxX = Math.max(maxX, obj.x + obj.width);
        maxY = Math.max(maxY, obj.y + obj.height);
      }
    }

    const padding = 20;
    const svgW = maxX - minX + padding * 2;
    const svgH = maxY - minY + padding * 2;

    let svgParts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`];

    for (const obj of objects) {
      const ox = obj.x - minX + padding;
      const oy = obj.y - minY + padding;

      switch (obj.type) {
        case 'rect':
          svgParts.push(`<rect x="${ox}" y="${oy}" width="${obj.width}" height="${obj.height}" rx="${obj.borderRadius}" fill="${obj.fill}" stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}" opacity="${obj.opacity}"/>`);
          if (obj.text) {
            svgParts.push(textToSVG(obj, ox, oy));
          }
          break;
        case 'ellipse':
          svgParts.push(`<ellipse cx="${ox + obj.width / 2}" cy="${oy + obj.height / 2}" rx="${obj.width / 2}" ry="${obj.height / 2}" fill="${obj.fill}" stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}" opacity="${obj.opacity}"/>`);
          if (obj.text) {
            svgParts.push(textToSVG(obj, ox, oy));
          }
          break;
        case 'text':
          svgParts.push(textToSVG(obj, ox, oy));
          break;
        case 'line':
          svgParts.push(`<line x1="${obj.x1 - minX + padding}" y1="${obj.y1 - minY + padding}" x2="${obj.x2 - minX + padding}" y2="${obj.y2 - minY + padding}" stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}"/>`);
          break;
        case 'arrow': {
          const x1 = obj.x1 - minX + padding, y1 = obj.y1 - minY + padding;
          const x2 = obj.x2 - minX + padding, y2 = obj.y2 - minY + padding;
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const hl = 12;
          svgParts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}"/>`);
          svgParts.push(`<polygon points="${x2},${y2} ${x2 - hl * Math.cos(angle - Math.PI / 6)},${y2 - hl * Math.sin(angle - Math.PI / 6)} ${x2 - hl * Math.cos(angle + Math.PI / 6)},${y2 - hl * Math.sin(angle + Math.PI / 6)}" fill="${obj.stroke}"/>`);
          break;
        }
      }
    }

    svgParts.push('</svg>');
    const svgStr = svgParts.join('\n');

    // 下载 SVG 文件
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'canvas-export.svg';
    a.click();
    URL.revokeObjectURL(url);

    if (window.HVE_Core) window.HVE_Core.showToast('SVG 已导出 ✓', 'success');
  }

  function textToSVG(obj, ox, oy) {
    if (!obj.text) return '';
    const lines = obj.text.split('\n');
    const lineH = obj.fontSize * (obj.lineHeight || 1.5);
    let parts = [`<text x="${ox + 6}" y="${oy + obj.fontSize + 4}" font-size="${obj.fontSize}" font-family="${obj.fontFamily}" fill="${obj.color}" font-weight="${obj.fontWeight}" font-style="${obj.fontStyle}">`];
    lines.forEach((line, i) => {
      parts.push(`<tspan x="${ox + 6}" dy="${i === 0 ? 0 : lineH}">${escapeXml(line)}</tspan>`);
    });
    parts.push('</text>');
    return parts.join('');
  }

  function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function insertToPage() {
    if (objects.length === 0) {
      if (window.HVE_Core) window.HVE_Core.showToast('画布为空', 'info');
      return;
    }

    // 将画布内容转换为 Canvas 图片，然后插入页面
    const tempCanvas = document.createElement('canvas');
    const dpr = 2;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of objects) {
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + obj.width);
      maxY = Math.max(maxY, obj.y + obj.height);
    }

    const pad = 20;
    const imgW = maxX - minX + pad * 2;
    const imgH = maxY - minY + pad * 2;

    tempCanvas.width = imgW * dpr;
    tempCanvas.height = imgH * dpr;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.scale(dpr, dpr);
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, imgW, imgH);

    // 偏移绘制
    tempCtx.translate(-minX + pad, -minY + pad);

    // 临时绘制所有对象到 tempCtx
    const origCtx = ctx;
    ctx = tempCtx;
    for (const obj of objects) {
      drawObject(obj);
    }
    ctx = origCtx;

    const dataUrl = tempCanvas.toDataURL('image/png');
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.maxWidth = '100%';
    img.alt = 'Canvas 画板导出';

    // 智能插入到页面
    const selected = window.HVE_Selector?.getSelected();
    if (selected && selected.parentElement) {
      selected.parentElement.insertBefore(img, selected.nextSibling);
    } else {
      document.body.appendChild(img);
    }

    // 退出画板模式
    deactivate();

    // 选中插入的图片
    setTimeout(() => {
      if (window.HVE_Selector) window.HVE_Selector.select(img);
    }, 100);

    if (window.HVE_Core) window.HVE_Core.showToast('已插入到页面 ✓', 'success');
  }

  // ============== 公共 API ==============

  return {
    activate,
    deactivate,
    toggle,
    isCanvasMode: () => isActive,
    getObjects: () => objects,
    setObjects: (objs) => {
      objects = objs;
      nextId = objs.length > 0 ? Math.max(...objs.map(o => o.id)) + 1 : 1;
      render();
    },
    addObject: (type, props) => {
      const obj = createObject(type, props);
      objects.push(obj);
      recordHistory('create', obj);
      selectObject(obj);
      render();
      return obj;
    },
    render,
  };
})();
