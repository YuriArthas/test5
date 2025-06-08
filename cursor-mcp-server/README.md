# Cocos Creator MCP 服务器

专为Cocos Creator项目设计的MCP（Model Context Protocol）服务器，提供代码分析和智能辅助功能。

## 🚀 功能特性

### 📊 项目分析工具
- **analyze_cocos_project**: 全面分析Cocos Creator项目结构
- **find_typescript_files**: 智能查找TypeScript文件
- **read_file_content**: 安全读取文件内容

### 🎯 专业功能
- **analyze_gas_system**: 深度分析GameplayAbilitySystem架构
- **suggest_code_improvements**: AI驱动的代码改进建议

## 📦 安装和配置

### 1. 构建服务器
```bash
npm install
npm run build
```

### 2. 配置Cursor

#### 方法一：使用MCP配置文件
1. 复制 `mcp-config.json` 中的配置
2. 添加到Cursor的MCP设置中

#### 方法二：手动配置
在Cursor设置中添加MCP服务器：

```json
{
  "mcpServers": {
    "cocos-creator-mcp": {
      "command": "node",
      "args": ["path/to/cursor-mcp-server/dist/index.js"],
      "env": {},
      "description": "Cocos Creator项目分析工具"
    }
  }
}
```

### 3. 启动服务器

#### Windows:
```bash
start-mcp.bat
```

#### 手动启动:
```bash
npm start
```

## 🛠️ 工具使用

### 分析项目结构
```
analyze_cocos_project:
  projectPath: "F:/cocos/tests/test5"
```

### 查找TypeScript文件
```
find_typescript_files:
  projectPath: "F:/cocos/tests/test5"
  pattern: "Unit" (可选)
```

### 分析GAS系统
```
analyze_gas_system:
  projectPath: "F:/cocos/tests/test5"
```

### 代码改进建议
```
suggest_code_improvements:
  filePath: "assets/battle/GAS/Unit.ts"
  codeSnippet: "代码片段" (可选)
```

## 🔧 开发和调试

### 开发模式
```bash
npm run dev
```

### 测试连接
```bash
# 服务器启动后应该显示：
# Cocos Creator MCP服务器已启动
```

## 📋 支持的项目结构

```
your-cocos-project/
├── assets/
│   ├── battle/
│   │   ├── GAS/          # GameplayAbilitySystem
│   │   │   ├── Unit.ts
│   │   │   ├── 属性.ts
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── package.json
└── tsconfig.json
```

## 🎯 针对你的项目优化

这个MCP服务器特别针对你的Cocos Creator 3.8.6项目进行了优化：
- 专门识别GAS架构模式
- 支持中文文件名和标识符
- 理解Cocos Creator组件模式
- 提供TypeScript最佳实践建议

## 🔍 故障排除

### 常见问题
1. **端口占用**: 确保没有其他进程使用相同端口
2. **路径错误**: 检查配置文件中的路径是否正确
3. **权限问题**: 确保有读取项目文件的权限

### 日志查看
服务器日志会输出到控制台，包含：
- 启动信息
- 错误详情
- 工具调用记录

## 📝 扩展开发

### 添加新工具
1. 在 `setupToolHandlers()` 中注册新工具
2. 实现对应的处理方法
3. 更新工具列表

### 自定义分析规则
修改 `suggestCodeImprovements()` 方法来添加项目特定的分析规则。

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！ 