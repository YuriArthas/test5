console.log('开始测试MCP服务器...');

// 模拟stdin输入
process.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
            name: "test-client",
            version: "1.0.0"
        }
    }
}) + '\n');

// 等待响应
process.stdout.on('data', (data) => {
    console.log('收到响应:', data.toString());
});

setTimeout(() => {
    console.log('测试完成');
    process.exit(0);
}, 2000); 