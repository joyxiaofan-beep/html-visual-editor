# HTML Visual Editor

[English](./README_EN.md)

> 像编辑 PPT 一样可视化编辑本地 HTML 文件 — 拖拽、缩放、表格、图表、图片粘贴

一款 Chrome 扩展，让你无需写代码就能直接在浏览器中可视化编辑 HTML 页面。

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

## ✨ 功能特性

- 🖱️ **拖拽移动** — 选中元素后直接拖拽移动位置
- 📐 **缩放调整** — 拖拽手柄调整元素大小
- ✏️ **文字编辑** — 双击文字直接编辑内容
- 🎨 **样式工具栏** — 修改字号、颜色、加粗、对齐等样式
- 📊 **表格编辑** — 增删行列、合并单元格
- 🖼️ **图片处理** — 粘贴图片、替换图片
- 📏 **对齐参考线** — 拖拽时自动显示对齐辅助线
- ↩️ **撤销/重做** — 完整的操作历史记录
- 💾 **保存导出** — 编辑后保存为 HTML 文件
- 📑 **页面排序** — 支持 PPT 风格的页面重新排序

## 📦 安装

### 从源码安装（开发者模式）

1. 克隆本仓库：
   ```bash
   git clone https://github.com/joyxiaofan-beep/html-visual-editor.git
   ```

2. 打开 Chrome，访问 `chrome://extensions/`

3. 开启右上角 **"开发者模式"**

4. 点击 **"加载已解压的扩展程序"**，选择本项目文件夹

5. 完成！在任何本地 HTML 页面（`file:///` 协议）上点击扩展图标即可开始编辑

## 🚀 使用方法

1. 用 Chrome 打开一个本地 HTML 文件
2. 点击扩展图标，启用编辑模式
3. **单击** 选中元素 → 出现浮动工具栏
4. **拖拽** 移动元素位置
5. **双击** 文字进入编辑模式
6. 编辑完成后，点击 **保存** 导出 HTML

## 🏗️ 项目结构

```
├── manifest.json          # 扩展配置（Manifest V3）
├── background/            # Service Worker
├── content/               # Content Scripts（核心编辑逻辑）
│   ├── editor-core.js     # 编辑器核心控制
│   ├── selector.js        # 元素选择器
│   ├── toolbar.js         # 浮动工具栏
│   ├── drag-move.js       # 拖拽移动
│   ├── resize.js          # 缩放调整
│   ├── text-edit.js       # 文字编辑
│   ├── table-edit.js      # 表格编辑
│   ├── image-handler.js   # 图片处理
│   ├── align-guide.js     # 对齐参考线
│   ├── insert-panel.js    # 插入面板
│   ├── context-menu.js    # 右键菜单
│   ├── page-sorter.js     # 页面排序
│   └── history.js         # 撤销/重做
├── popup/                 # 扩展弹出面板
├── sidepanel/             # 侧边栏面板
├── styles/                # 注入页面的 CSS
├── utils/                 # 工具函数
└── icons/                 # 扩展图标
```

## 🛠️ 技术栈

- **Chrome Extension Manifest V3**
- **原生 JavaScript**（零框架依赖）
- **Content Scripts** 注入编辑能力
- **CSS** 内联注入，不影响原页面结构

## 📋 兼容性

- Chrome 88+（Manifest V3 支持）
- 支持 `file:///` 本地文件和 `http(s)://` 网页

## 📄 License

MIT License
