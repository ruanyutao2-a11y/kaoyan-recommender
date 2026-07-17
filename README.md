# 考研择校助手 (Kaoyan School Recommender)

AI 驱动的考研院校推荐工具。输入你的本科背景，获取个性化的冲/稳/保院校推荐。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Cloudflare Workers + Hono
- **数据**: Cloudflare D1 + KV
- **AI**: 阿里云百炼 DashScope (qwen-plus + 联网搜索)

## 本地开发

```bash
# 安装依赖
npm install
cd worker && npm install && cd ..

# 启动 Worker（终端 1）
cd worker && npx wrangler dev

# 启动前端（终端 2）
npm run dev
```

## 部署

```bash
# 设置 Worker secrets
cd worker
npx wrangler secret put DASHSCOPE_API_KEY

# 部署 Worker
npx wrangler deploy

# 部署前端
npm run build
npx wrangler pages deploy dist --project-name kaoyan-recommender
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `DASHSCOPE_API_KEY` | 阿里云百炼 API 密钥（Worker secret） |
| `TAOBAO_PRODUCT_URL` | 淘宝商品链接（wrangler.toml vars） |
