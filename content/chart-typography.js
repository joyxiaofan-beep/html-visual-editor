// chart-typography.js — 自定义图表文字排版 v1.0
// 提供文字排版工具，用于在图表、信息图中精确控制文字布局和样式
window.HVE_ChartTypo = (function () {
  let isActive = false;
  let panelEl = null;
  let currentTarget = null;

  // 预设图表样式模板
  const CHART_TEMPLATES = {
    'stat-card': {
      name: '数据卡片',
      desc: '大数字 + 说明文字',
      html: `<div class="hve-chart-stat-card">
        <div class="hve-chart-stat-number" contenteditable="false">1,234</div>
        <div class="hve-chart-stat-label" contenteditable="false">活跃用户</div>
        <div class="hve-chart-stat-trend" contenteditable="false">↑ 12.5%</div>
      </div>`,
      css: {
        '.hve-chart-stat-card': 'background:#FFFDF9;border:1px solid #E8E5E0;border-radius:16px;padding:28px 32px;text-align:center;min-width:180px;box-shadow:0 2px 12px rgba(45,43,40,0.06);',
        '.hve-chart-stat-number': 'font-size:42px;font-weight:800;color:#292524;line-height:1.1;letter-spacing:-1px;font-variant-numeric:tabular-nums;',
        '.hve-chart-stat-label': 'font-size:14px;color:#78716C;margin-top:6px;font-weight:500;',
        '.hve-chart-stat-trend': 'font-size:13px;color:#16A34A;margin-top:4px;font-weight:600;',
      },
    },
    'metric-row': {
      name: '指标行',
      desc: '标签 + 数值 + 进度条',
      html: `<div class="hve-chart-metric-row">
        <span class="hve-chart-metric-label">完成率</span>
        <div class="hve-chart-metric-bar"><div class="hve-chart-metric-fill" style="width:73%"></div></div>
        <span class="hve-chart-metric-value">73%</span>
      </div>`,
      css: {
        '.hve-chart-metric-row': 'display:flex;align-items:center;gap:12px;padding:10px 0;',
        '.hve-chart-metric-label': 'font-size:13px;color:#78716C;min-width:60px;font-weight:500;',
        '.hve-chart-metric-bar': 'flex:1;height:8px;background:#F5F0EA;border-radius:4px;overflow:hidden;',
        '.hve-chart-metric-fill': 'height:100%;background:linear-gradient(90deg,#D97706,#F59E0B);border-radius:4px;transition:width 0.5s ease;',
        '.hve-chart-metric-value': 'font-size:14px;font-weight:700;color:#292524;min-width:40px;text-align:right;font-variant-numeric:tabular-nums;',
      },
    },
    'comparison': {
      name: '对比数据',
      desc: '左右对比布局',
      html: `<div class="hve-chart-comparison">
        <div class="hve-chart-comp-item hve-chart-comp-left">
          <div class="hve-chart-comp-value">2,847</div>
          <div class="hve-chart-comp-label">本月</div>
        </div>
        <div class="hve-chart-comp-vs">VS</div>
        <div class="hve-chart-comp-item hve-chart-comp-right">
          <div class="hve-chart-comp-value">2,134</div>
          <div class="hve-chart-comp-label">上月</div>
        </div>
      </div>`,
      css: {
        '.hve-chart-comparison': 'display:flex;align-items:center;justify-content:center;gap:24px;padding:20px;',
        '.hve-chart-comp-item': 'text-align:center;',
        '.hve-chart-comp-value': 'font-size:36px;font-weight:800;color:#292524;font-variant-numeric:tabular-nums;line-height:1.1;',
        '.hve-chart-comp-label': 'font-size:12px;color:#78716C;margin-top:4px;font-weight:500;',
        '.hve-chart-comp-left .hve-chart-comp-value': 'color:#D97706;',
        '.hve-chart-comp-right .hve-chart-comp-value': 'color:#78716C;',
        '.hve-chart-comp-vs': 'font-size:14px;font-weight:700;color:#A8A29E;padding:6px 10px;background:#F5F0EA;border-radius:8px;',
      },
    },
    'data-table-header': {
      name: '数据表标题',
      desc: '表格顶部标题区域',
      html: `<div class="hve-chart-table-header">
        <div class="hve-chart-table-title">销售数据总览</div>
        <div class="hve-chart-table-subtitle">2024年第四季度 · 最近更新: 2024.12.31</div>
      </div>`,
      css: {
        '.hve-chart-table-header': 'padding:16px 20px;border-bottom:2px solid #E8E5E0;',
        '.hve-chart-table-title': 'font-size:20px;font-weight:700;color:#292524;line-height:1.3;',
        '.hve-chart-table-subtitle': 'font-size:12px;color:#A8A29E;margin-top:4px;font-weight:400;',
      },
    },
    'legend': {
      name: '图例',
      desc: '圆点 + 标签 + 数值',
      html: `<div class="hve-chart-legend">
        <div class="hve-chart-legend-item"><span class="hve-chart-legend-dot" style="background:#D97706"></span><span class="hve-chart-legend-name">产品 A</span><span class="hve-chart-legend-val">45%</span></div>
        <div class="hve-chart-legend-item"><span class="hve-chart-legend-dot" style="background:#2563EB"></span><span class="hve-chart-legend-name">产品 B</span><span class="hve-chart-legend-val">32%</span></div>
        <div class="hve-chart-legend-item"><span class="hve-chart-legend-dot" style="background:#16A34A"></span><span class="hve-chart-legend-name">产品 C</span><span class="hve-chart-legend-val">23%</span></div>
      </div>`,
      css: {
        '.hve-chart-legend': 'display:flex;flex-wrap:wrap;gap:16px;padding:12px 16px;',
        '.hve-chart-legend-item': 'display:flex;align-items:center;gap:6px;',
        '.hve-chart-legend-dot': 'width:8px;height:8px;border-radius:50%;flex-shrink:0;',
        '.hve-chart-legend-name': 'font-size:12px;color:#78716C;font-weight:500;',
        '.hve-chart-legend-val': 'font-size:12px;color:#292524;font-weight:700;font-variant-numeric:tabular-nums;',
      },
    },
    'callout': {
      name: '标注/注释',
      desc: '带箭头的文字标注',
      html: `<div class="hve-chart-callout">
        <div class="hve-chart-callout-arrow">↗</div>
        <div class="hve-chart-callout-text">这个数据点很重要！<br><small>同比增长 25.3%</small></div>
      </div>`,
      css: {
        '.hve-chart-callout': 'display:inline-flex;align-items:flex-start;gap:8px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;max-width:200px;',
        '.hve-chart-callout-arrow': 'font-size:18px;line-height:1;color:#D97706;flex-shrink:0;',
        '.hve-chart-callout-text': 'font-size:12px;line-height:1.5;color:#92400E;font-weight:500;',
        '.hve-chart-callout-text small': 'color:#B45309;font-weight:400;',
      },
    },
    'badge': {
      name: '标签/徽章',
      desc: '状态标签',
      html: `<div class="hve-chart-badges">
        <span class="hve-chart-badge hve-chart-badge-amber">进行中</span>
        <span class="hve-chart-badge hve-chart-badge-green">已完成</span>
        <span class="hve-chart-badge hve-chart-badge-red">已逾期</span>
        <span class="hve-chart-badge hve-chart-badge-blue">待审核</span>
      </div>`,
      css: {
        '.hve-chart-badges': 'display:flex;flex-wrap:wrap;gap:6px;',
        '.hve-chart-badge': 'display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;',
        '.hve-chart-badge-amber': 'background:#FEF3C7;color:#92400E;',
        '.hve-chart-badge-green': 'background:#DCFCE7;color:#166534;',
        '.hve-chart-badge-red': 'background:#FEE2E2;color:#991B1B;',
        '.hve-chart-badge-blue': 'background:#DBEAFE;color:#1E40AF;',
      },
    },
    'kpi-grid': {
      name: 'KPI 网格',
      desc: '2×2 指标网格',
      html: `<div class="hve-chart-kpi-grid">
        <div class="hve-chart-kpi-item">
          <div class="hve-chart-kpi-num">98.5%</div>
          <div class="hve-chart-kpi-name">可用率</div>
        </div>
        <div class="hve-chart-kpi-item">
          <div class="hve-chart-kpi-num">1.2s</div>
          <div class="hve-chart-kpi-name">响应时间</div>
        </div>
        <div class="hve-chart-kpi-item">
          <div class="hve-chart-kpi-num">3,847</div>
          <div class="hve-chart-kpi-name">日活跃用户</div>
        </div>
        <div class="hve-chart-kpi-item">
          <div class="hve-chart-kpi-num">42</div>
          <div class="hve-chart-kpi-name">待处理工单</div>
        </div>
      </div>`,
      css: {
        '.hve-chart-kpi-grid': 'display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;',
        '.hve-chart-kpi-item': 'background:#FFFDF9;border:1px solid #E8E5E0;border-radius:12px;padding:16px 20px;text-align:center;',
        '.hve-chart-kpi-num': 'font-size:28px;font-weight:800;color:#292524;font-variant-numeric:tabular-nums;line-height:1.2;',
        '.hve-chart-kpi-name': 'font-size:11px;color:#78716C;margin-top:4px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;',
      },
    },
  };

  // 排版控制选项
  const TYPO_PRESETS = {
    'numbers': {
      name: '数据数字',
      styles: { fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', fontWeight: '800' },
    },
    'mono-numbers': {
      name: '等宽数字',
      styles: { fontFamily: '"SF Mono","JetBrains Mono",monospace', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px' },
    },
    'chart-title': {
      name: '图表标题',
      styles: { fontSize: '20px', fontWeight: '700', letterSpacing: '-0.3px', lineHeight: '1.3' },
    },
    'chart-subtitle': {
      name: '图表副标题',
      styles: { fontSize: '13px', fontWeight: '400', color: '#78716C', letterSpacing: '0' },
    },
    'axis-label': {
      name: '坐标轴标签',
      styles: { fontSize: '11px', fontWeight: '500', color: '#A8A29E', letterSpacing: '0.3px' },
    },
    'data-label': {
      name: '数据标签',
      styles: { fontSize: '12px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' },
    },
    'annotation': {
      name: '注释文字',
      styles: { fontSize: '11px', fontStyle: 'italic', color: '#78716C' },
    },
  };

  // ============== 激活/停用 ==============

  function activate() {
    if (isActive) return;
    isActive = true;
    createPanel();
    console.log('[HVE ChartTypo] ✅ 图表排版工具已开启');
  }

  function deactivate() {
    if (!isActive) return;
    isActive = false;
    destroyPanel();
    console.log('[HVE ChartTypo] ⛔ 图表排版工具已关闭');
  }

  function toggle() {
    if (isActive) deactivate(); else activate();
  }

  // ============== 面板 ==============

  function createPanel() {
    if (panelEl) return;

    panelEl = document.createElement('div');
    panelEl.setAttribute('data-hve-editor', 'true');
    panelEl.setAttribute('data-hve-chart-panel', 'true');

    panelEl.innerHTML = `
      <div class="hve-chart-header">
        <span class="hve-chart-title">📊 图表排版工具</span>
        <button class="hve-chart-close" title="关闭">✕</button>
      </div>
      <div class="hve-chart-body">
        <div class="hve-chart-section">
          <div class="hve-chart-section-title">插入图表组件</div>
          <div class="hve-chart-template-grid">
            ${Object.entries(CHART_TEMPLATES).map(([key, t]) => `
              <button class="hve-chart-template-btn" data-template="${key}" title="${t.desc}">
                <span class="hve-chart-template-icon">${getTemplateIcon(key)}</span>
                <span class="hve-chart-template-name">${t.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="hve-chart-divider"></div>
        <div class="hve-chart-section">
          <div class="hve-chart-section-title">排版预设</div>
          <div class="hve-chart-typo-list">
            ${Object.entries(TYPO_PRESETS).map(([key, p]) => `
              <button class="hve-chart-typo-btn" data-typo="${key}">
                <span class="hve-chart-typo-preview" style="${presetToCSS(p.styles)}">Aa 123</span>
                <span class="hve-chart-typo-name">${p.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="hve-chart-divider"></div>
        <div class="hve-chart-section">
          <div class="hve-chart-section-title">精细控制</div>
          <div class="hve-chart-fine-controls">
            <div class="hve-chart-ctrl-row">
              <label>字间距</label>
              <input type="range" data-ctrl="letterSpacing" min="-3" max="10" step="0.1" value="0">
              <span class="hve-chart-ctrl-val">0px</span>
            </div>
            <div class="hve-chart-ctrl-row">
              <label>行高</label>
              <input type="range" data-ctrl="lineHeight" min="0.8" max="3" step="0.05" value="1.5">
              <span class="hve-chart-ctrl-val">1.5</span>
            </div>
            <div class="hve-chart-ctrl-row">
              <label>数字变体</label>
              <select data-ctrl="fontVariantNumeric">
                <option value="normal">默认</option>
                <option value="tabular-nums">等宽数字</option>
                <option value="oldstyle-nums">旧式数字</option>
                <option value="lining-nums">内嵌数字</option>
                <option value="proportional-nums">比例数字</option>
              </select>
            </div>
            <div class="hve-chart-ctrl-row">
              <label>字重</label>
              <input type="range" data-ctrl="fontWeight" min="100" max="900" step="100" value="400">
              <span class="hve-chart-ctrl-val">400</span>
            </div>
            <div class="hve-chart-ctrl-row">
              <label>文字描边</label>
              <input type="range" data-ctrl="webkitTextStrokeWidth" min="0" max="3" step="0.5" value="0">
              <span class="hve-chart-ctrl-val">0px</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // 事件绑定
    panelEl.querySelector('.hve-chart-close').addEventListener('click', deactivate);

    // 模板按钮
    panelEl.querySelectorAll('[data-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        insertTemplate(btn.getAttribute('data-template'));
      });
    });

    // 排版预设
    panelEl.querySelectorAll('[data-typo]').forEach(btn => {
      btn.addEventListener('click', () => {
        applyTypoPreset(btn.getAttribute('data-typo'));
      });
    });

    // 精细控制
    panelEl.querySelectorAll('[data-ctrl]').forEach(input => {
      const valSpan = input.parentElement.querySelector('.hve-chart-ctrl-val');

      const updateValue = () => {
        const prop = input.getAttribute('data-ctrl');
        let value = input.value;

        if (prop === 'letterSpacing' || prop === 'webkitTextStrokeWidth') {
          value = value + 'px';
        }

        if (valSpan) {
          valSpan.textContent = value;
        }

        applyToSelected(prop, value);
      };

      input.addEventListener('input', updateValue);
      if (input.tagName === 'SELECT') {
        input.addEventListener('change', updateValue);
      }
    });

    // 监听选中元素变化
    document.addEventListener('hve-element-selected', onElementSelected);

    document.body.appendChild(panelEl);
  }

  function destroyPanel() {
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }
    document.removeEventListener('hve-element-selected', onElementSelected);
  }

  function onElementSelected(e) {
    currentTarget = e.detail?.element || window.HVE_Selector?.getSelected();
    updateControlValues();
  }

  function updateControlValues() {
    if (!panelEl || !currentTarget) return;

    const cs = getComputedStyle(currentTarget);

    const controls = {
      'letterSpacing': parseFloat(cs.letterSpacing) || 0,
      'lineHeight': parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.5,
      'fontWeight': parseInt(cs.fontWeight) || 400,
      'fontVariantNumeric': cs.fontVariantNumeric || 'normal',
      'webkitTextStrokeWidth': parseFloat(cs.webkitTextStrokeWidth) || 0,
    };

    for (const [prop, value] of Object.entries(controls)) {
      const input = panelEl.querySelector(`[data-ctrl="${prop}"]`);
      if (input) {
        if (input.tagName === 'SELECT') {
          input.value = value;
        } else {
          input.value = typeof value === 'number' ? value : parseFloat(value) || 0;
        }
        const valSpan = input.parentElement.querySelector('.hve-chart-ctrl-val');
        if (valSpan) {
          if (prop === 'letterSpacing' || prop === 'webkitTextStrokeWidth') {
            valSpan.textContent = value + 'px';
          } else {
            valSpan.textContent = typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value;
          }
        }
      }
    }
  }

  // ============== 模板插入 ==============

  function insertTemplate(templateKey) {
    const template = CHART_TEMPLATES[templateKey];
    if (!template) return;

    // 创建容器
    const wrapper = document.createElement('div');
    wrapper.innerHTML = template.html.trim();
    const el = wrapper.firstElementChild;

    // 应用内联样式（不依赖外部 CSS）
    applyInlineStyles(el, template.css);

    // 智能插入
    const selected = window.HVE_Selector?.getSelected();
    if (selected && selected.parentElement) {
      selected.parentElement.insertBefore(el, selected.nextSibling);
    } else {
      // 找到最佳插入位置
      const target = findBestInsertTarget();
      target.appendChild(el);
    }

    // 记录历史
    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'dom', element: el,
        before: { action: 'insert' },
        after: {
          action: 'insert',
          html: el.outerHTML,
          parentSelector: window.HVE_History.getUniqueSelector(el.parentElement),
        },
        description: `插入图表组件: ${template.name}`,
      });
    }

    // 选中插入的元素
    if (window.HVE_Selector) {
      window.HVE_Selector.deselectAll();
      window.HVE_Selector.select(el);
    }

    if (window.HVE_Core) {
      window.HVE_Core.showToast(`已插入「${template.name}」✓`, 'success');
    }
  }

  function applyInlineStyles(rootEl, cssMap) {
    for (const [selector, styles] of Object.entries(cssMap)) {
      // 检查 rootEl 自身是否匹配选择器
      const rootMatches = rootEl.matches(selector);
      // 查找子元素中匹配的目标
      const childTargets = rootEl.querySelectorAll(selector);

      // 对 rootEl 应用样式（如果匹配）
      if (rootMatches) {
        rootEl.style.cssText += styles;
      }

      // 对子元素应用样式
      childTargets.forEach(el => {
        el.style.cssText += styles;
      });
    }
  }

  function findBestInsertTarget() {
    // 优先找 main > article > section > body
    const candidates = ['main', 'article', 'section', '.content', '.container'];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && !el.closest('[data-hve-editor]')) return el;
    }
    return document.body;
  }

  // ============== 排版预设应用 ==============

  function applyTypoPreset(presetKey) {
    const preset = TYPO_PRESETS[presetKey];
    if (!preset) return;

    const el = currentTarget || window.HVE_Selector?.getSelected();
    if (!el) {
      if (window.HVE_Core) window.HVE_Core.showToast('请先选中一个元素', 'info');
      return;
    }

    // 记录旧样式
    const beforeStyles = {};
    for (const prop of Object.keys(preset.styles)) {
      beforeStyles[prop] = el.style[prop] || '';
    }

    // 应用样式
    for (const [prop, value] of Object.entries(preset.styles)) {
      el.style[prop] = value;
    }

    // 记录历史
    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'style', element: el,
        before: { style: beforeStyles },
        after: { style: { ...preset.styles } },
        description: `应用排版预设: ${preset.name}`,
      });
    }

    updateControlValues();

    if (window.HVE_Core) {
      window.HVE_Core.showToast(`已应用「${preset.name}」✓`, 'success');
    }
  }

  // ============== 精细控制 ==============

  function applyToSelected(prop, value) {
    const el = currentTarget || window.HVE_Selector?.getSelected();
    if (!el) return;

    const before = el.style[prop] || '';
    el.style[prop] = value;

    if (window.HVE_History) {
      window.HVE_History.record({
        type: 'style', element: el,
        before: { style: { [prop]: before } },
        after: { style: { [prop]: value } },
        description: '图表排版调整',
      });
    }
  }

  // ============== 辅助函数 ==============

  function presetToCSS(styles) {
    return Object.entries(styles).map(([k, v]) => {
      const cssProp = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssProp}:${v}`;
    }).join(';');
  }

  function getTemplateIcon(key) {
    const icons = {
      'stat-card': '🔢',
      'metric-row': '📊',
      'comparison': '⚖️',
      'data-table-header': '📋',
      'legend': '🎨',
      'callout': '💬',
      'badge': '🏷️',
      'kpi-grid': '📱',
    };
    return icons[key] || '📊';
  }

  // ============== 公共 API ==============

  return {
    activate,
    deactivate,
    toggle,
    isActive: () => isActive,
    insertTemplate,
    applyTypoPreset,
    getTemplates: () => ({ ...CHART_TEMPLATES }),
    getPresets: () => ({ ...TYPO_PRESETS }),
  };
})();
