// panel.js — 侧边栏属性面板逻辑 v3（PPT 风格即时属性修改）
(function () {
  const emptyState = document.getElementById('empty-state');
  const panelContent = document.getElementById('panel-content');
  let currentData = null; // 当前选中元素的数据缓存

  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg.type === 'HVE_ELEMENT_SELECTED') {
      showProperties(msg.data);
    } else if (msg.type === 'HVE_ELEMENT_DESELECTED') {
      showEmpty();
    }
  });

  function showProperties(data) {
    currentData = data;
    emptyState.style.display = 'none';
    panelContent.style.display = 'block';

    document.getElementById('prop-tag').textContent = data.tagName || '-';
    document.getElementById('prop-id').value = data.id || '';
    document.getElementById('prop-class').value = data.className || '';

    // 位置 & 尺寸
    document.getElementById('prop-x').value = data.rect?.x ?? 0;
    document.getElementById('prop-y').value = data.rect?.y ?? 0;
    document.getElementById('prop-w').value = data.rect?.width ?? 0;
    document.getElementById('prop-h').value = data.rect?.height ?? 0;

    // 文字
    document.getElementById('prop-font-size').value = parseInt(data.style?.fontSize) || '';
    const lh = parseFloat(data.style?.lineHeight);
    document.getElementById('prop-line-height').value = isNaN(lh) ? '' : Math.round(lh * 10) / 10;

    const fw = data.style?.fontWeight;
    const fwSel = document.getElementById('prop-font-weight');
    if (fw === '700' || fw === 'bold') fwSel.value = 'bold';
    else if (fw === '600') fwSel.value = '600';
    else if (fw === '500') fwSel.value = '500';
    else fwSel.value = 'normal';

    // 文字对齐
    const ta = data.style?.textAlign || 'left';
    document.querySelectorAll('.align-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.align === ta);
    });

    // 颜色
    const color = rgbToHex(data.style?.color);
    const bgColor = rgbToHex(data.style?.backgroundColor);
    document.getElementById('prop-color').value = color;
    document.getElementById('prop-color-hex').textContent = color;
    document.getElementById('prop-bg-color').value = bgColor;
    document.getElementById('prop-bg-hex').textContent = bgColor;

    // 外观
    document.getElementById('prop-radius').value = parseInt(data.style?.borderRadius) || 0;
    const opacity = Math.round((parseFloat(data.style?.opacity) || 1) * 100);
    document.getElementById('prop-opacity').value = opacity;
    document.getElementById('prop-opacity-val').textContent = opacity + '%';

    // 间距（从 style 对象解析）
    const style = data.style || {};
    const parsePx = (v) => parseInt(v) || 0;
    document.getElementById('prop-mt').value = parsePx(style.marginTop);
    document.getElementById('prop-mr').value = parsePx(style.marginRight);
    document.getElementById('prop-mb').value = parsePx(style.marginBottom);
    document.getElementById('prop-ml').value = parsePx(style.marginLeft);
    document.getElementById('prop-pt').value = parsePx(style.paddingTop);
    document.getElementById('prop-pr').value = parsePx(style.paddingRight);
    document.getElementById('prop-pb').value = parsePx(style.paddingBottom);
    document.getElementById('prop-pl').value = parsePx(style.paddingLeft);
  }

  function showEmpty() {
    currentData = null;
    emptyState.style.display = 'block';
    panelContent.style.display = 'none';
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#FFFFFF';
    if (rgb.startsWith('#')) return rgb.toUpperCase();
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return '#000000';
    return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  // === PPT 风格：逐属性发送修改 ===
  async function sendPropChange(prop, value) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'HVE_UPDATE_PROPERTIES',
        data: { prop, value }
      });
    }
  }

  // 数值输入字段 → 实时修改（输入后立即应用）
  const propMappings = {
    'prop-w': { prop: 'width', unit: 'px' },
    'prop-h': { prop: 'height', unit: 'px' },
    'prop-font-size': { prop: 'fontSize', unit: 'px' },
    'prop-line-height': { prop: 'lineHeight', unit: '' },
    'prop-radius': { prop: 'borderRadius', unit: 'px' },
    'prop-mt': { prop: 'marginTop', unit: 'px' },
    'prop-mr': { prop: 'marginRight', unit: 'px' },
    'prop-mb': { prop: 'marginBottom', unit: 'px' },
    'prop-ml': { prop: 'marginLeft', unit: 'px' },
    'prop-pt': { prop: 'paddingTop', unit: 'px' },
    'prop-pr': { prop: 'paddingRight', unit: 'px' },
    'prop-pb': { prop: 'paddingBottom', unit: 'px' },
    'prop-pl': { prop: 'paddingLeft', unit: 'px' },
  };

  // X/Y 位置修改（通过 transform: translate 实现）
  ['prop-x', 'prop-y'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', async () => {
      const xEl = document.getElementById('prop-x');
      const yEl = document.getElementById('prop-y');
      const x = parseInt(xEl.value) || 0;
      const y = parseInt(yEl.value) || 0;
      // 通过 transform 实现位置偏移（相对于原始 rect 位置）
      const origX = currentData?.rect?.x ?? 0;
      const origY = currentData?.rect?.y ?? 0;
      const dx = x - origX;
      const dy = y - origY;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'HVE_UPDATE_PROPERTIES',
          data: { prop: 'transform', value: `translate(${dx}px, ${dy}px)` }
        });
      }
    });
  });

  Object.entries(propMappings).forEach(([id, mapping]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const val = el.value;
      sendPropChange(mapping.prop, val + mapping.unit);
    });
  });

  // 颜色
  ['prop-color', 'prop-bg-color'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      const hexEl = document.getElementById(id === 'prop-color' ? 'prop-color-hex' : 'prop-bg-hex');
      if (hexEl) hexEl.textContent = e.target.value.toUpperCase();
      const prop = id === 'prop-color' ? 'color' : 'backgroundColor';
      sendPropChange(prop, e.target.value);
    });
  });

  // 透明度
  document.getElementById('prop-opacity')?.addEventListener('input', (e) => {
    document.getElementById('prop-opacity-val').textContent = e.target.value + '%';
    sendPropChange('opacity', (parseInt(e.target.value) / 100).toString());
  });

  // 字重
  document.getElementById('prop-font-weight')?.addEventListener('change', (e) => {
    sendPropChange('fontWeight', e.target.value);
  });

  // 文字对齐按钮
  document.querySelectorAll('.align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sendPropChange('textAlign', btn.dataset.align);
    });
  });
})();
