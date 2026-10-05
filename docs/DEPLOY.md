# 前端部署手册

前端是**纯静态资源**（HTML + CSS + 原生 JS，零依赖零构建），因此部署只需要一个能放静态文件的服务器。
关键只有一件事：**让前端知道后端 API 在哪里** —— 改 `js/config.js` 里的 `API_BASE_URL`。

| 方式 | 地址形态 | 需要改 config.js 吗 | 说明 |
| --- | --- | --- | --- |
| 1. 由后端托管 | 与后端同源 | 不需要（留空即可） | 最省事，一个地址搞定演示 |
| 2. 本机静态服务器 | `http://127.0.0.1:8080` | 不需要（自动探测本机 8000） | 真正的前后端分离调试 |
| 3. Netlify | `https://xxx.netlify.app` | **需要**填后端公网地址 | 静态托管首选，免费 |
| 4. Vercel | `https://xxx.vercel.app` | **需要**填后端公网地址 | 同上 |
| 5. GitHub Pages | `https://<user>.github.io/<repo>` | **需要**填后端公网地址 | 仓库 Settings → Pages 选分支根目录 |

---

## 1. 由后端托管（单地址演示）

后端启动时设置：

```bash
FRONTEND_DIR=/绝对路径/832401320_calculator_frontend python run.py
```

然后只访问 `http://127.0.0.1:8000` 即可。此时前端与 API 同源，`API_BASE_URL` 保持空字符串。
注意：这**不影响前后端分离架构** —— 两个仓库依然独立，前端单独部署到静态服务器同样可用。

## 2. 本机静态服务器（推荐用于开发与演示"分离"）

```bash
# 终端 A：后端
cd 832401320_calculator_backend && python run.py

# 终端 B：前端静态服务器
cd 832401320_calculator_frontend && python -m http.server 8080 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8080`。
前端启动时会依次探测候选地址（同源 → `http://127.0.0.1:8000` → `http://localhost:8000`），
第一个 `/api/health` 返回 `{"status":"ok"}` 的地址会被采用，因此**无需改任何配置**即可跨域连通。
页脚会显示当前实际使用的 API 基地址，顶部徽标显示"后端在线 · http://127.0.0.1:8000"。

## 3. Netlify（推荐公网静态托管）

1. 把前端仓库推到 GitHub。
2. Netlify → Add new site → Import an existing project → 选择仓库。
3. Build command 留空，Publish directory 填 `.`（仓库内已带 `netlify.toml`，它会自动生效）。
4. 部署完成后：
   - 修改 `js/config.js`：

     ```js
     API_BASE_URL: 'https://你的后端地址.onrender.com',
     ```

     重新提交一次（Netlify 会自动重新部署）。
   - 到后端把该站点域名加入 `CORS_ORIGINS`（或暂时设为 `*`）。

## 4. Vercel

```bash
npm i -g vercel     # 或直接网页端导入仓库
vercel --prod
```

FrameWork Preset 选 **Other**，Output Directory 填 `.`。仓库内已带 `vercel.json`。

## 5. GitHub Pages

1. 仓库 Settings → Pages → Source 选 `Deploy from a branch`，分支 `main`，目录 `/ (root)`。
2. 等待 1~2 分钟，访问 `https://<用户名>.github.io/<仓库名>/`。
3. 同样需要把 `API_BASE_URL` 改成后端公网地址，并把该地址加入后端 `CORS_ORIGINS`。

> 提示：如果后端用的是 cloudflared 快速隧道，地址每次重启都会变，
> 那么前端 `config.js` 也要跟着改。**长期方案请把后端部署到固定域名（Render 等）。**

---

## 6. 部署后自检

1. 打开前端页面，顶部徽标应为"后端在线"，页脚显示实际 API 基地址；
2. 算一道题（如 `(1+2)*3`）确认返回 9，并在历史里看到这条记录；
3. 刷新页面，历史记录仍在（说明数据来自后端数据库，不是浏览器缓存）；
4. 点删除按钮删掉一条，再刷新 —— 该条不再出现；
5. 把后端停掉，页面会显示离线横幅，点 `=` 只会得到"无法连接后端服务"——**这正是"计算在后端"的证据**。
