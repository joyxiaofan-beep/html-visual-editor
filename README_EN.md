# HTML Visual Editor

> Edit local HTML files visually like a PPT — drag, resize, tables, charts, image paste

A Chrome extension that lets you visually edit HTML pages directly in the browser — no coding required.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

[中文文档](./README.md)

## ✨ Features

- 🖱️ **Drag & Move** — Select and drag elements to reposition them
- 📐 **Resize** — Drag handles to resize any element
- ✏️ **Text Editing** — Double-click text to edit content inline
- 🎨 **Style Toolbar** — Change font size, color, bold, alignment and more
- 📊 **Table Editing** — Add/remove rows & columns, merge cells
- 🖼️ **Image Handling** — Paste and replace images
- 📏 **Alignment Guides** — Smart snap lines appear while dragging
- ↩️ **Undo / Redo** — Full operation history
- 💾 **Save & Export** — Save your edits as an HTML file
- 📑 **Page Sorting** — PPT-style page reordering

## 📦 Installation

### Install from Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/joyxiaofan-beep/html-visual-editor.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **"Developer mode"** in the top-right corner

4. Click **"Load unpacked"** and select the project folder

5. Done! Click the extension icon on any local HTML page (`file:///` protocol) to start editing

## 🚀 Usage

1. Open a local HTML file in Chrome
2. Click the extension icon to enable edit mode
3. **Click** to select an element → a floating toolbar appears
4. **Drag** to move elements around
5. **Double-click** text to enter editing mode
6. When finished, click **Save** to export the HTML

## 🏗️ Project Structure

```
├── manifest.json          # Extension config (Manifest V3)
├── background/            # Service Worker
├── content/               # Content Scripts (core editing logic)
│   ├── editor-core.js     # Editor core controller
│   ├── selector.js        # Element selector
│   ├── toolbar.js         # Floating toolbar
│   ├── drag-move.js       # Drag & move
│   ├── resize.js          # Resize handling
│   ├── text-edit.js       # Text editing
│   ├── table-edit.js      # Table editing
│   ├── image-handler.js   # Image handling
│   ├── align-guide.js     # Alignment guides
│   ├── insert-panel.js    # Insert panel
│   ├── context-menu.js    # Context menu
│   ├── page-sorter.js     # Page sorting
│   └── history.js         # Undo / Redo
├── popup/                 # Extension popup panel
├── sidepanel/             # Side panel
├── styles/                # CSS injected into pages
├── utils/                 # Utility functions
└── icons/                 # Extension icons
```

## 🛠️ Tech Stack

- **Chrome Extension Manifest V3**
- **Vanilla JavaScript** (zero framework dependencies)
- **Content Scripts** inject editing capabilities
- **CSS** inline injection, no interference with original page structure

## 📋 Compatibility

- Chrome 88+ (Manifest V3 support)
- Supports `file:///` local files and `http(s)://` web pages

## 📄 License

MIT License
