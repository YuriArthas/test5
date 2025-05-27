# .meta文件嵌套显示

## 🎯 最终解决方案

使用VS Code的文件嵌套功能 + 全局隐藏，实现最佳效果。

## ✨ 工作原理

VS Code的文件嵌套有一个重要特性：**被嵌套规则匹配的文件不会被files.exclude隐藏**

- 📁 **文件的.meta**: 被嵌套规则匹配，折叠在原始文件下（如 `AbilityInstance.ts` → `AbilityInstance.ts.meta`）
- 📂 **文件夹的.meta**: 没有嵌套规则匹配，被files.exclude隐藏（如 `GAS.meta`）

## 🔧 配置说明

在`.vscode/settings.json`中的配置：

```json
{
    "explorer.fileNesting.enabled": true,
    "explorer.fileNesting.expand": false,
    "explorer.fileNesting.patterns": {
        "*.ts": "${capture}.ts.meta",
        "*.js": "${capture}.js.meta", 
        "*.scene": "${capture}.scene.meta",
        "*.prefab": "${capture}.prefab.meta",
        "*.png": "${capture}.png.meta",
        "*.jpg": "${capture}.jpg.meta",
        "*.jpeg": "${capture}.jpeg.meta",
        "*.plist": "${capture}.plist.meta"
    },
    "files.exclude": {
        "**/*.meta": true
    }
}
```

## 💡 为什么这样有效？

1. **嵌套优先级高于隐藏**: 文件嵌套规则的优先级高于files.exclude
2. **精确匹配**: 只有特定文件类型的.meta会被嵌套
3. **自动隐藏**: 其他所有.meta文件（主要是文件夹的）会被隐藏

## 🎮 使用技巧

- **查看文件的.meta**: 点击文件名旁的小箭头展开
- **全局展开**: Explorer面板右上角"..."菜单 → "Expand All"
- **临时显示所有.meta**: 设置中搜索"files.exclude"可快速开关

现在你的Explorer既整洁又实用，`GAS.meta`等文件夹的.meta文件已经完全隐藏！ 