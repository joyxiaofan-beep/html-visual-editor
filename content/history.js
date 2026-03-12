// history.js — 撤销/重做管理器
window.HVE_History = (function () {
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 100;

  /**
   * 记录一个操作
   * @param {Object} action - { type, target, before, after, description }
   *   type: 'style' | 'attribute' | 'content' | 'dom' | 'move' | 'resize'
   *   target: CSS selector 或引用标记
   *   before: 操作前的状态
   *   after: 操作后的状态
   */
  function record(action) {
    // 为 target 元素生成唯一标识
    if (action.element && !action.targetSelector) {
      action.targetSelector = getUniqueSelector(action.element);
    }
    undoStack.push(action);
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }
    // 新操作清空 redo
    redoStack.length = 0;
  }

  function undo() {
    if (undoStack.length === 0) return null;
    const action = undoStack.pop();
    redoStack.push(action);
    applyState(action, 'undo');
    return action;
  }

  function redo() {
    if (redoStack.length === 0) return null;
    const action = redoStack.pop();
    undoStack.push(action);
    applyState(action, 'redo');
    return action;
  }

  function applyState(action, direction) {
    const state = direction === 'undo' ? action.before : action.after;
    const el = findElement(action);

    switch (action.type) {
      case 'style':
        if (!el) return;
        Object.assign(el.style, state.style || {});
        break;

      case 'move':
        if (!el) return;
        // 支持 transform-only 模式（drag-move.js 和方向键微调）
        if (state.transform !== undefined) {
          el.style.transform = state.transform;
        }
        // 兼容旧式 left/top（如果有的话）
        if (state.left !== undefined) el.style.left = state.left;
        if (state.top !== undefined) el.style.top = state.top;
        if (state.position) el.style.position = state.position;
        break;

      case 'resize':
        if (!el) return;
        if (state.width !== undefined) el.style.width = state.width;
        if (state.height !== undefined) el.style.height = state.height;
        if (state.left !== undefined) el.style.left = state.left;
        if (state.top !== undefined) el.style.top = state.top;
        if (state.transform !== undefined) el.style.transform = state.transform;
        break;

      case 'content':
        if (!el) return;
        // 支持 outerHTML（table-edit.js）和 innerHTML（text-edit.js）
        if (state.outerHTML !== undefined) {
          // outerHTML 替换会销毁原元素，需要更新引用
          const parent = el.parentNode;
          const nextSibling = el.nextSibling;
          el.outerHTML = state.outerHTML;
          // 找到替换后的新元素并更新引用
          const newEl = nextSibling ? nextSibling.previousElementSibling : parent.lastElementChild;
          if (newEl && action.targetSelector) {
            // 将 data-hve-id 复制到新元素上，确保后续 undo/redo 能找到它
            const match = action.targetSelector.match(/\[data-hve-id="([^"]+)"\]/);
            if (match) {
              newEl.setAttribute('data-hve-id', match[1]);
            }
          }
        } else if (state.innerHTML !== undefined) {
          el.innerHTML = state.innerHTML;
        }
        break;

      case 'attribute':
        if (!el) return;
        if (state.attributes) {
          for (const [key, val] of Object.entries(state.attributes)) {
            if (val === null) {
              el.removeAttribute(key);
            } else {
              el.setAttribute(key, val);
            }
          }
        }
        break;

      case 'move-order': {
        // 层级调整（上移/下移/移到最前/最后）
        if (!el) return;
        const parent = findElement({ targetSelector: state.parentSelector });
        if (!parent) return;
        const targetIndex = state.index;
        const children = Array.from(parent.children);
        if (targetIndex >= children.length) {
          parent.appendChild(el);
        } else {
          const ref = children[targetIndex];
          if (ref !== el) {
            parent.insertBefore(el, ref);
          }
        }
        break;
      }

      case 'dom':
        applyDomState(action, direction, state, el);
        break;
    }
  }

  function applyDomState(action, direction, state, el) {
    const act = state.action;

    if (act === 'remove') {
      if (direction === 'undo' && state.html) {
        // 撤销删除 → 重新插入
        const parent = findElement({ targetSelector: state.parentSelector });
        if (parent) {
          const temp = document.createElement('div');
          temp.innerHTML = state.html;
          const ref = state.nextSiblingSelector
            ? findElement({ targetSelector: state.nextSiblingSelector })
            : null;
          while (temp.firstChild) {
            parent.insertBefore(temp.firstChild, ref);
          }
        }
      } else if (direction === 'redo') {
        if (el) el.remove();
      }
    } else if (act === 'insert') {
      if (direction === 'undo') {
        if (el) el.remove();
      } else if (state.html) {
        const parent = findElement({ targetSelector: state.parentSelector });
        if (parent) {
          const temp = document.createElement('div');
          temp.innerHTML = state.html;
          const ref = state.nextSiblingSelector
            ? findElement({ targetSelector: state.nextSiblingSelector })
            : null;
          while (temp.firstChild) {
            parent.insertBefore(temp.firstChild, ref);
          }
        }
      }
    } else if (act === 'swap') {
      // 页面排序交换
      const parent = findElement({ targetSelector: state.parentSelector });
      if (!parent) return;
      const idxA = state.indexA;
      const idxB = state.indexB;
      const children = Array.from(parent.children);
      if (idxA < children.length && idxB < children.length) {
        const elA = children[idxA];
        const elB = children[idxB];
        if (idxA < idxB) {
          parent.insertBefore(elB, elA);
        } else {
          parent.insertBefore(elA, elB);
        }
      }
    } else if (act === 'reorder') {
      // 页面排序移动
      const parent = findElement({ targetSelector: state.parentSelector });
      if (!parent) return;
      const from = state.fromIndex;
      const to = state.toIndex;
      const children = Array.from(parent.children);
      if (from < children.length) {
        const movedEl = children[from];
        if (to < children.length) {
          parent.insertBefore(movedEl, children[to]);
        } else {
          parent.appendChild(movedEl);
        }
      }
    } else if (act === 'group') {
      if (direction === 'undo') {
        // 撤销组合 → 释放子元素，删除组合容器
        if (!el) return;
        const parent = el.parentElement;
        const children = [...el.children];
        const nextSib = el.nextSibling;
        for (const child of children) {
          parent.insertBefore(child, nextSib);
        }
        el.remove();
      } else {
        // 重做组合 → 重新创建组合容器（使用 after.html）
        if (state.html) {
          const parent = findElement({ targetSelector: state.parentSelector });
          if (parent) {
            const temp = document.createElement('div');
            temp.innerHTML = state.html;
            if (temp.firstChild) {
              parent.appendChild(temp.firstChild);
            }
          }
        }
      }
    } else if (act === 'ungroup') {
      if (direction === 'undo') {
        // 撤销取消组合 → 重新创建组合容器
        if (state.html) {
          const parent = findElement({ targetSelector: state.parentSelector });
          if (parent) {
            const temp = document.createElement('div');
            temp.innerHTML = state.html;
            if (temp.firstChild) {
              parent.appendChild(temp.firstChild);
            }
          }
        }
      } else {
        // 重做取消组合 → 释放子元素
        if (!el) return;
        const parent = el.parentElement;
        const children = [...el.children];
        const nextSib = el.nextSibling;
        for (const child of children) {
          parent.insertBefore(child, nextSib);
        }
        el.remove();
      }
    } else if (act === 'replaceTag') {
      // 标签更改
      if (state.html) {
        if (el) {
          el.outerHTML = state.html;
        }
      }
    }
  }

  function findElement(action) {
    if (action.targetSelector) {
      try {
        return document.querySelector(action.targetSelector);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * 为元素生成一个可复现的唯一 CSS 选择器
   */
  function getUniqueSelector(el) {
    if (el.id && !el.id.startsWith('hve-')) {
      return '#' + CSS.escape(el.id);
    }

    // 临时分配一个唯一 ID
    const tempId = 'hve-tmp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    el.setAttribute('data-hve-id', tempId);
    return '[data-hve-id="' + tempId + '"]';
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  function clear() {
    undoStack.length = 0;
    redoStack.length = 0;
  }

  return { record, undo, redo, canUndo, canRedo, clear, getUniqueSelector };
})();
