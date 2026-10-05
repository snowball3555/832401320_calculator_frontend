# 前后端分离计算器 · 前端

> 软件工程实践 · 第一次作业 · **计算器前端仓库**（独立仓库，与后端只通过 HTTP/JSON 通信）

一个**零构建**的原生 Web 前端：只做界面交互、表达式输入、结果展示、历史展示与错误提示，
**不参与任何数值计算**。所有计算结果、历史记录、统计、进制转换、单位换算、语法分析
全部由后端 FastAPI 服务通过 HTTP API 返回。

---

## 1. 项目介绍

### 1.1 职责边界

| 前端**负责** | 前端**不负责** |
| --- | --- |
| 界面渲染与布局（顶栏、显示区、键盘、历史列表、扩展工具） | 任何数值计算（四则、乘方、阶乘、三角函数…） |
| 表达式输入与编辑（点击键盘、物理键盘、光标插入、退格、清空、取反） | 表达式合法性校验（括号匹配、函数参数个数…） |
| 把显示符号翻译成 API 传输符号（`×` → `*`、`÷` → `/`） | 分词与语法分析（Token / AST 全在后端） |
| 调用后端 API 并渲染返回结果 | 结果精度与格式化规则的实现 |
| 历史记录的查询、搜索、分页、收藏、删除、清空的**界面**与请求发起 | 历史数据的持久化与存储 |
| 错误提示、离线横幅、后端在线状态探测 | 进制转换 / 单位换算的换算算法 |
| 轻提示（toast）、主题切换、快捷键 | 用户输入的执行（不 `eval`、不 `new Function`） |

**唯一的字符串处理**是显示符号到传输符号的映射，属于展示层格式转换，不产生任何数值结果：

```js
// js/calculator.js
function toApiExpression(text) {
  return text
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/（/g, '(')
    .replace(/）/g, ')');
}
```

**可验证的设计后果**：停掉后端进程后，界面仍可输入表达式，但点击 `=` 只会得到
`NETWORK_ERROR（无法连接后端服务…）`，前端**拿不到任何新结果**——这正说明计算发生在后端。

---

## 2. 技术栈

| 项 | 选型 | 说明 |
| --- | --- | --- |
| 结构 | 原生 HTML5 | 单页 `index.html`，语义化标签 + ARIA 属性 |
| 样式 | 原生 CSS3 | CSS 变量（设计令牌）、Flex/Grid 布局、媒体查询响应式、BEM 命名 |
| 脚本 | 原生 JavaScript（ES5+ 语法风格） | 无框架、无编译、无 polyfill |
| 模块化 | classic script 顺序加载 + IIFE 命名空间 | 每个文件挂载一个 `window.Xxx` 命名空间对象 |
| 依赖 | **零依赖**（无 `package.json`、无 `node_modules`） | 页面只加载 1 个 CSS + 8 个 JS |
| 构建 | **零构建**（无 npm / 打包器 / 转译器） | 源码即产物，双击 `index.html` 即可运行 |
| 通信 | `fetch` + JSON，`AbortController` 实现超时 | 单出口封装在 `js/api.js` |
| 后端 | FastAPI（独立仓库，默认 `http://127.0.0.1:8000`） | 通过 HTTP/JSON 调用 |

### 2.1 浏览器兼容性

| 浏览器 | 最低版本 | 原因 |
| --- | --- | --- |
| Chrome / Edge | 66+ | `AbortController`（Chrome 66）、`Promise.prototype.finally`（Chrome 63）、`Element.closest`（Chrome 41）、`URLSearchParams`（Chrome 49）、`Object.assign`（Chrome 45）、`navigator.clipboard`（Chrome 66，缺失时降级为 toast 提示"当前浏览器不支持自动复制"） |
| Firefox | 57+ | `AbortController` 自 57 起支持 |
| Safari | 12.1+ | `AbortController` 自 12.1 起支持 |
| IE 11 | **不支持** | 无 `fetch` / `Promise`，且未使用任何 polyfill |

其他环境要求：页面需可通过 HTTP 或 `file://` 打开；`localStorage` 不可用时（隐私模式）
主题偏好不持久化，但功能不报错（`try/catch` 兜底）。

### 2.2 为什么坚持零构建

1. **作业约束与可评审性**：助教下载仓库后无需 `npm install`，直接打开即可看到全部源码，
   不存在"源码 → 产物"的中间层，评审时看到的代码与运行的代码完全一致。
2. **部署成本为零**：产物就是静态文件，可直接由后端 `FRONTEND_DIR` 托管，
   也可丢进任意静态服务器（`python -m http.server`），甚至用 `file://` 打开。
3. **课程目标是"前后端分离"而非"前端工程化"**：本作业的重点是接口契约、职责边界与错误处理，
   引入打包器只会增加噪声，掩盖"前端不计算"这一核心结论。
4. **代价可控**：为兼容性放弃 ES Module 与箭头函数，改用 IIFE + `var` + `function`，
   用 `window` 上的命名空间对象做模块边界（详见 [`codestyle.md`](codestyle.md)）。

---

## 3. 目录结构

```text
832401320_calculator_frontend/
├── index.html          # 唯一页面：顶栏、计算器面板、历史面板、扩展工具面板；末尾按顺序加载 8 个脚本
├── css/
│   └── style.css       # 全部样式：设计令牌（:root / [data-theme="dark"]）、BEM 组件、响应式
├── js/
│   ├── config.js       # 部署配置：API 基地址与候选列表、超时、轮询间隔、分页大小、搜索防抖
│   ├── api.js          # API 客户端：唯一通信出口，基地址健康探测与缓存、统一错误模型 ApiError
│   ├── ui.js           # 通用 UI 工具：$ / $$ 查询、escapeHtml 转义、toast、消息条、debounce
│   ├── theme.js        # 主题切换：写入 <html data-theme>，用 localStorage 记住选择（默认深色）
│   ├── calculator.js   # 计算器交互：键盘插入、退格、清空、取反、显示符号转换、发请求、渲染结果
│   ├── history.js      # 历史记录：列表渲染、搜索、分页、收藏、删除、清空、统计
│   ├── tools.js        # 扩展工具：进制转换、单位换算、语法分析、函数速查（数据均来自后端）
│   └── main.js         # 启动装配：初始化各模块、后端在线状态徽标与离线横幅、健康轮询
├── docs/
│   └── DEPLOY.md       # 前端部署手册：后端托管 / 本机静态服务器 / Netlify / Vercel / GitHub Pages
├── README.md           # 本文件：项目介绍、运行方式、功能与接口清单
├── codestyle.md        # 代码规范与提交前自检清单
├── .gitignore          # 忽略依赖与构建目录、.env、编辑器与日志文件（本项目零依赖，保留以防将来引入）
├── netlify.toml        # Netlify 静态部署配置：publish = "."，无构建命令，HTML 不缓存 + SPA 回退
└── vercel.json         # Vercel 静态部署配置：js/css 短缓存 300s，全部路径 rewrite 到 index.html
```

`index.html` 末尾的脚本加载顺序（**存在依赖，不可随意调整**）：

```html
<script src="js/config.js"></script>
<script src="js/api.js"></script>
<script src="js/ui.js"></script>
<script src="js/theme.js"></script>
<script src="js/calculator.js"></script>
<script src="js/history.js"></script>
<script src="js/tools.js"></script>
<script src="js/main.js"></script>
```

- `api.js` 在 IIFE 内即时读取 `global.CALC_CONFIG`，因此必须在 `config.js` 之后；
- `theme.js` / `calculator.js` / `history.js` / `tools.js` 都在 IIFE 内即时读取 `global.UI`、`global.Api`，
  因此必须排在 `ui.js`、`api.js` 之后；
- `main.js` 在结尾初始化全部模块，必须最后加载（它自身在 `DOMContentLoaded` 或立即执行 `init()`）。

---

## 4. 运行方式

三种方式任选其一。**方式一最简单**，也是助教验收推荐路径。

### 方式一（推荐）：后端顺带托管前端，单地址访问

后端设置环境变量 `FRONTEND_DIR` 指向前端目录后，根路径 `/` 会被挂载为静态站点
（后端代码：`app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")`），
前端与 API **同源**，天然没有跨域问题。

```powershell
# 1) 启动后端（在 832401320_calculator_backend 目录下）
cd C:\path\to\832401320_calculator_backend
$env:FRONTEND_DIR = "C:\path\to\832401320_calculator_frontend"
python run.py
```

> **Windows 提示**：如果 `python` 执行后毫无输出（应用商店占位符），把它换成 `py -3`，
> 或直接用虚拟环境里的解释器 `.\.venv\Scripts\python.exe run.py`。详见后端 README 第 5 节。

浏览器访问 **<http://127.0.0.1:8000>** 即可打开计算器；接口文档在 <http://127.0.0.1:8000/docs>。

> 说明：挂载只是"省掉一个域名"，前端仍是独立仓库，两者依旧只通过 HTTP/JSON 通信。

### 方式二：独立静态服务器（真正的前后端分离部署）

后端跑 8000，前端跑 8080，两个源不同，靠后端 **CORS** 放行通信。

```powershell
# 终端 1：后端（不设置 FRONTEND_DIR）
cd C:\path\to\832401320_calculator_backend
python run.py

# 终端 2：前端静态服务器
cd C:\path\to\832401320_calculator_frontend
python -m http.server 8080
```

浏览器访问 **<http://127.0.0.1:8080>**。
前端启动时会依次探测 `API_CANDIDATES`，命中 `http://127.0.0.1:8000` 后顶部徽标显示"后端在线"。
后端默认 `CORS_ORIGINS=*`，若你把它收紧为具体域名，务必把 `http://127.0.0.1:8080` 加进白名单。

### 方式三：直接用浏览器打开 `index.html`（`file://` 协议）

双击 `index.html`，或在资源管理器中把文件拖进浏览器。

```text
file:///C:/path/to/832401320_calculator_frontend/index.html
```

此方式可正常使用，但有以下受限点：

| 受限点 | 现象 / 原因 |
| --- | --- |
| 同源候选失效 | 首选项 `''`（同源）在 `file://` 下没有后端，探测失败后自动回退到 `http://127.0.0.1:8000`。控制台会出现几条 `Access to fetch at 'file:///.../api/health' ... blocked by CORS policy` 报错，这是**预期日志**，不影响后续回退 |
| 必须已启动后端 | 探测全部失败时页面显示离线横幅，点击 `=` 得到 `NETWORK_ERROR` |
| 依赖后端 CORS 放行 `null` 源 | `file://` 页面的 `Origin` 为 `null`；后端默认 `CORS_ORIGINS=*` 可用，收紧后需显式放行 |
| 部分浏览器限制本地文件脚本 | 个别浏览器/企业策略会拦截本地文件的 XHR/fetch，此时请改用方式一或方式二 |

> **已实测结论**：方式三在 Microsoft Edge（Chromium）下**确实可用** —— 打开
> `index.html` 后顶部徽标显示"后端在线 · http://127.0.0.1:8000"，输入 `7*6` 得到后端返回的 `42`。
> 复现命令：`python scripts/check-file-protocol.py`（脚本在项目根的 `scripts/` 下，会自动截图留证）。

### 方式四（补充）：公网静态托管

若需要把前端发布到公网（Netlify / Vercel / GitHub Pages），仓库内已带好配置文件
（`netlify.toml`、`vercel.json`，发布目录均为仓库根目录 `.`，无构建命令）。
此时前端与后端不同源，**必须**在 [`js/config.js`](js/config.js) 中把 `API_BASE_URL`
改成后端公网地址，并把该前端域名加入后端 `CORS_ORIGINS`。
完整步骤见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。

---

## 5. 后端地址配置说明

**唯一需要按部署环境修改的文件是 [`js/config.js`](js/config.js)。**

```js
window.CALC_CONFIG = {
  API_BASE_URL: '',

  /**
   * 候选后端地址。**注意**：`http://127.0.0.1:8000` / `http://localhost:8000`
   * 只在"页面本身就是从本机打开"时才作为候选使用（file:// 或 localhost 站点）。
   * 如果页面部署在公网，这两个地址指向的是**访问者自己的电脑**，
   * 把它们当回退目标会导致两个问题：①健康探测误判、②万一访问者本机 8000 端口
   * 跑着别的服务，前端会连到错误的"后端"上去。因此 api.js 会在部署环境下自动跳过它们。
   */
  API_CANDIDATES: [
    '', // 同源（部署到公网时就是隧道/正式域名自己）
    'http://127.0.0.1:8000', // 仅本地开发用：file:// 打开或静态服务器 + 本机后端
    'http://localhost:8000'
  ],

  /** 单次请求超时（毫秒） */
  REQUEST_TIMEOUT_MS: 8000,

  /**
   * 健康探测超时（毫秒）。
   * 实测：经 Cloudflare 隧道首次访问时，冷连接（TCP + TLS + 回源）可能超过 3 秒，
   * 因此这里给到 8 秒；超时过短会把"慢但可用"误判成"离线"。
   */
  HEALTH_TIMEOUT_MS: 8000,

  /** 后端状态轮询间隔（毫秒） */
  HEALTH_POLL_MS: 15000,

  /** 历史记录每页条数 */
  PAGE_SIZE: 5,

  /** 搜索防抖（毫秒） */
  SEARCH_DEBOUNCE_MS: 300
};
```

### 5.1 两个字段的语义

| 字段 | 语义 |
| --- | --- |
| `API_BASE_URL` | **显式指定的后端基地址**。留空 `''` 表示"与页面同源"（后端托管前端时用这个）。前后端分开部署时填后端地址，例如 `https://xxx-calculator-api.onrender.com`。 |
| `API_CANDIDATES` | **候选基地址列表**，运行时按顺序健康探测，取第一个连通的。空串代表同源。 |

### 5.2 运行时健康探测与自动选择逻辑

实现位于 [`js/api.js`](js/api.js)：

1. **构造候选序列** `resolveBase(force)`：先放 `API_BASE_URL`（若为非空），再按顺序追加
   `API_CANDIDATES`，并用 `indexOf` 去重。
2. **候选过滤（重要）**：如果**页面本身不是从本机打开的**（部署在公网域名/隧道上），
   则跳过所有 loopback 候选（`http://127.0.0.1:*`、`http://localhost:*`）。
   因为此时它们指向的是**访问者自己的电脑**——既会造成"探不通就判离线"的误报，
   也可能让前端连到访问者机器上恰好占着 8000 端口的其它服务。
   判定方式：`location.protocol === 'file:'`，或 hostname 为 `localhost` / `127.0.0.1` / `::1` / 空。
3. **顺序探测**：对每个候选发 `GET {base}/api/health`（超时 `HEALTH_TIMEOUT_MS = 8000` ——
   经 Cloudflare 隧道回源的冷连接实测可能超过 3 秒，超时过短会把"慢但可用"误判成"离线"），
   要求 `response.ok` 且响应体 `status === 'ok'` 才算命中；命中即结束，不再探测后续候选。
4. **返回值三分语义**（关键设计）：
   - 命中返回**字符串**，可能是空串 `''`——表示"与页面同源且在线"；
   - 全部失败返回 **`null`**——表示离线。
   之所以不用空串同时表示离线，是因为 `'' + '/api/health'` 会变成合法的同源地址，两者必须区分。
5. **缓存与失效**：命中的地址缓存在 `activeBase`；请求出现网络层异常时把 `activeBase` 置回 `null`
   并广播离线状态，下次请求会重新探测。
6. **状态广播**：`Api.onStatusChange(listener)` 订阅在线/离线变化，`main.js` 用它更新顶部徽标、
   底部 API 基地址与离线横幅；`HEALTH_POLL_MS = 15000` 定时**强制重新探测**（不能只读缓存，
   否则后端已退出仍会显示"在线"）。

### 5.3 不同部署方式下怎么改

| 场景 | 配置改法 |
| --- | --- |
| 后端托管前端（方式一） | **无需修改**：`API_BASE_URL: ''` 命中同源候选即连通 |
| 本机前端 8080 + 后端 8000（方式二） | **无需修改**：同源候选失败后自动命中 `http://127.0.0.1:8000`（本机页面才会用 loopback 候选） |
| `file://` 打开（方式三） | **无需修改**：自动回退到 `http://127.0.0.1:8000` |
| 前端部署在公网（隧道 / Netlify 等） | 若后端与前端**同源**（后端顺带托管前端）则无需修改；否则必须把 `API_BASE_URL` 填成后端公网地址。注意此场景下 loopback 候选会被自动跳过，属预期行为 |
| 后端在**远程/其他端口** | 改 `API_BASE_URL`，例如 `'https://xxx-calculator-api.onrender.com'` 或 `'http://127.0.0.1:9000'` |
| 只想用远程后端、不要本机回退 | 把 `API_CANDIDATES` 中不需要的项删掉，只保留远程地址 |
| 静态托管（前端与后端不同源且后端非本机） | 必须显式填 `API_BASE_URL`，并确认后端 CORS 放行了前端域名 |

---

## 6. 功能清单

| 分类 | 功能 | 说明 / 涉及元素 |
| --- | --- | --- |
| 标准计算 | 四则运算与括号 | 小键盘 `#keypad`，表达式交给 `POST /api/calculate` |
| 标准计算 | 取反（±）、清空（C）、退格（⌫）、÷100 | `data-action="negate" / "clear" / "backspace"`、`data-insert="/100"` |
| 标准计算 | 复制结果 | `#btn-copy-result`，走 `navigator.clipboard` |
| 科学计算 | 模式切换 | `[data-mode="standard"]` / `[data-mode="scientific"]` 两个 tab，切换后显示 `#sci-keypad` |
| 科学计算 | sin / cos / tan / π / ln / log / √ / e / abs / round / n! / x² | 科学键盘按钮，全部通过 `data-insert` 插入表达式文本，由后端求值 |
| 历史记录 | 列表展示 | `#history-list`，数据来自 `GET /api/history`，后端分页 |
| 历史记录 | 搜索 | `#history-search`，300 ms 防抖后请求；匹配表达式或结果由后端完成 |
| 历史记录 | 分页 | `#history-prev` / `#history-next` / `#history-page-info`，每页 `PAGE_SIZE = 5` |
| 历史记录 | 只看收藏 | `#history-fav-only` 复选框 |
| 历史记录 | 收藏 / 取消收藏 | 卡片上 `data-action="favorite"` → `PATCH /api/history/{id}/favorite` |
| 历史记录 | 删除单条 | `data-action="delete"`，先 `confirm` 再 `DELETE /api/history/{id}` |
| 历史记录 | 清空全部 | `#btn-clear-history`，先 `confirm` 再 `DELETE /api/history` |
| 历史记录 | 手动刷新 | `#btn-refresh-history` 重新拉取列表与统计 |
| 历史记录 | 点击卡片/↩ 回填表达式 | 点击卡片主体或 `data-action="use"` 把表达式填回计算器继续编辑 |
| 统计 | 累计计算 / 今日 / 收藏 / 最常用运算符 / 最近一次计算 | `#stats` 下的 `#stat-total`、`#stat-today`、`#stat-fav`、`#stat-top-op`、`#stat-last`，来自 `GET /api/history/stats` |
| 进制转换 | 任意受支持进制互转 | `#base-value`、`#base-from`、`#base-to`、`#btn-base-convert` → `POST /api/convert/base`；可选进制列表由后端 `supported_bases` 提供 |
| 单位换算 | 多类别单位换算 | `#unit-value`、`#unit-category`、`#unit-from`、`#unit-to`、`#btn-unit-convert` → `POST /api/convert/unit`；类别与单位清单由后端提供 |
| 语法分析 | Token 列表与语法树 | `#parse-input`、`#btn-parse`、`#parse-summary`、`#parse-output` → `POST /api/parse` |
| 函数速查 | 函数/常量清单 | `#function-reference`，来自 `GET /api/meta/functions`，**前端不维护第二份函数表** |
| 主题切换 | 深色 / 浅色 | `#theme-toggle`，写入 `<html data-theme>`，`localStorage` 记忆，默认深色 |
| 后端状态 | 在线徽标 + 手动重试 | `#backend-status`（`data-state="online" / "offline"`），点击强制重新探测 |
| 接口文档 | 打开 Swagger | `#open-api-docs` → `Api.docsUrl()` 即 `{base}/docs` |
| 扩展工具切换 | 4 个工具面板切换 | `[data-tool]` 与 `[data-tool-panel]`：`base` / `unit` / `parse` / `functions` |

### 6.1 键盘快捷键（与 `index.html` 页脚提示一致）

| 按键 | 行为 |
| --- | --- |
| 数字与 `+` `-` `*` `/` `(` `)` `^` `!` `%` `.` | 插入对应字符（焦点不在输入框/文本域/下拉框时生效，且未按 Ctrl/Meta/Alt） |
| `Enter` | 计算（提交表达式给后端） |
| `Backspace` | 退格（删除选区，或删除光标前一个字符） |
| `Esc` | 清空表达式与结果显示 |

> 实现细节：`Enter` / `Esc` 不论焦点在哪都生效；其余按键若焦点已在输入框内
> （`input` / `textarea` / `select`）则交给输入框自身的默认行为，避免"插入两次"。

---

## 7. 界面元素与交互说明

### 7.1 键盘的 `data-insert` / `data-action` 机制

键盘区域（`#keypad` 与 `#sci-keypad`）**没有为每个按钮单独绑定事件**，而是统一使用事件委托：

- 带 `data-insert="文本"` 的按钮：把该文本**插入到输入框当前光标/选区位置**，
  例如 `data-insert="sin("`、`data-insert="^2"`、`data-insert="/100"`、`data-insert="×"`。
- 带 `data-action="动作"` 的按钮：执行动作分支——`clear`（清空）、`backspace`（退格）、
  `negate`（整体取反）、`calculate`（提交计算）。
- 优先级：先判断 `data-action`，只有当 `action` 不匹配任何分支且 `data-insert` 存在时才插入文本。

```js
// js/calculator.js
function handleKeypadClick(event) {
  var button = event.target.closest('button');
  if (!button) {
    return;
  }

  var action = button.getAttribute('data-action');
  var text = button.getAttribute('data-insert');

  if (action === 'clear') {
    clearAll();
  } else if (action === 'backspace') {
    backspace();
  } else if (action === 'negate') {
    negate();
  } else if (action === 'calculate') {
    calculate();
  } else if (text !== null) {
    insert(text);
  }
}
```

### 7.2 主要界面元素

| 区域 | 元素 ID / 选择器 | 作用 |
| --- | --- | --- |
| 顶栏 | `#backend-status`（`.chip__dot[data-state]` + `.chip__text`） | 后端状态徽标，点击强制重新探测 |
| 顶栏 | `#theme-toggle`（`#theme-icon`、`#theme-label`） | 主题切换按钮 |
| 顶栏 | `#open-api-docs` | 新标签页打开 `{base}/docs` |
| 离线横幅 | `#offline-banner`（`#offline-hint`） | 后端不可达时显示，文案明确"界面仍可继续输入，但无法得到计算结果" |
| 显示区 | `#expression-input` | 表达式输入框（`aria-describedby="result-meta"`，配 `.sr-only` label） |
| 显示区 | `#result-value`（`<output aria-live="polite">`） | 后端返回的结果文本，初始为 `—` |
| 显示区 | `#result-meta` | 计算元信息：耗时、语法树节点数/深度、历史记录 id |
| 显示区 | `#btn-copy-result` | 复制最新结果 |
| 消息条 | `#message-area`（`role="status" aria-live="polite"`） | 成功/错误消息；错误会附带后端错误码 `[CODE]` |
| 模式 tab | `[data-mode]` | `standard` / `scientific`，切换还同步 `aria-selected` 与 `#sci-keypad` 的 `hidden` |
| 键盘 | `#keypad`、`#sci-keypad` | 主键盘（4 列 Grid）与科学键盘 |
| 历史 | `#history-list`、`#history-total`、`#history-search`、`#history-fav-only`、`#history-prev`、`#history-next`、`#history-page-info` | 列表、总数徽标、搜索、只看收藏、分页 |
| 统计 | `#stat-total`、`#stat-today`、`#stat-fav`、`#stat-top-op`、`#stat-last` | 统计面板 |
| 工具 | `[data-tool]` / `[data-tool-panel]` | `base` / `unit` / `parse` / `functions` 四个面板 |
| 页脚 | `#footer-api` | 显示当前生效的 API 基地址（"与页面同源" / "未连接"） |
| 轻提示 | `#toast`（`role="status" aria-live="polite"`） | 2.2 秒自动消失的底部提示 |

### 7.3 消息条与离线横幅的区别

- **消息条 `#message-area`**：单次操作的反馈（如"计算成功：…"、`无法连接后端服务…`），
  由 `UI.showMessage(text, type, code)` 写入，会把文本 `escapeHtml` 转义后再拼 `innerHTML`，
  并渲染为 `.message--error` / `.message--success` / `.message--info`。
- **离线横幅 `#offline-banner`**：**持久状态**提示，由 `main.js` 依据 `Api` 的在线状态
  （`banner.hidden = online`）控制显隐；它与具体某次操作无关，只要后端不可达就一直在。

---

## 8. 前后端交互流程

### 8.1 一次计算的完整链路

```text
[用户输入]
   点击小键盘按钮 / 敲物理键盘 / 直接编辑输入框
        │
        ▼
[拼接表达式]
   calculator.js:  insert() 在光标处插入文本 → #expression-input.value
   （显示符号，可能是 (1+2)×3）
        │
        ▼
[转换为传输符号]
   toApiExpression(): × → * 、÷ → / 、− → - 、（）→ ()
   （(1+2)*3，仅字符串替换，不求值）
        │
        ▼
[发起请求]
   Api.calculate(expr) → resolveBase() 选基地址 → POST {base}/api/calculate
   Body: { "expression": "(1+2)*3", "save_history": true }
   超时 8000 ms（AbortController）
        │
        ▼
[后端计算]
   分词 → 语法分析 → 求值 → 写入历史数据库
   返回: { success, expression, result_display, elapsed_ms,
           node_count, max_depth, history_id, ... }
        │
        ▼
[渲染结果]
   renderResult(data.result_display)   → #result-value
   renderMeta('后端计算耗时 X ms · 语法树 N 节点 / 深度 D · 历史记录 #id') → #result-meta
   UI.showMessage('计算成功：… = …', 'success')
        │
        ▼
[刷新历史]
   History.reload() → GET /api/history（当前页/搜索/收藏条件）+ GET /api/history/stats
        │
        ▼
[界面更新完成]
```

出错路径：请求失败 → `catch` → `#result-value` 复位为 `—`、`#result-meta` 显示"计算失败，未写入历史记录"，
消息条提示 `error.message` 与 `error.errorCode`。

### 8.2 停掉后端会发生什么

| 时刻 | 表现 |
| --- | --- |
| 后端进程退出后（最多 15 s 内） | 健康轮询 `HEALTH_POLL_MS` 强制复探失败 → `#backend-status` 变红为"后端离线（点此重试）"，`#offline-banner` 出现，页脚显示"API 基地址：未连接" |
| 此时输入表达式 | **界面完全可用**：键盘、物理键盘、退格、清空、模式切换都正常，输入框内容照常拼接 |
| 此时点击 `=` | 请求失败被归一化为 `ApiError`，`errorCode = 'NETWORK_ERROR'`，消息条显示"无法连接后端服务，请确认后端已启动（计算必须由后端完成）[NETWORK_ERROR]" |
| 结果区 | 显示 `—`，元信息为"计算失败，未写入历史记录"——**前端不提供任何本地兜底计算** |
| 历史面板 | 报错时回退为"无法加载历史记录：…"，统计的"最近一次计算"显示"后端离线" |

这正是本作业要演示的核心结论：**计算能力完全在后端**。

---

## 9. 使用的后端接口清单

下表与 [`js/api.js`](js/api.js) 中的实现一一对应（基地址由 `resolveBase()` 决定，记为 `{base}`）。
所有响应体形如 `{ success: boolean, ... }`，失败时含 `message` / `error_code` / `detail`。

| 方法 | 路径 | 用途 | 前端调用点 |
| --- | --- | --- | --- |
| `GET` | `/api/health` | 健康探测：判定候选基地址是否连通（要求 `status === 'ok'`） | `Api.health()` / `probe()`（基地址解析与轮询） |
| `POST` | `/api/calculate` | **核心**：计算表达式并落库，返回结果与元信息 | `Api.calculate(expression, saveHistory)`，Body `{ expression, save_history }` |
| `POST` | `/api/parse` | 语法分析，返回 Token 列表与语法树 | `Api.parse(expression)`，函数速查/语法分析面板 |
| `GET` | `/api/history` | 分页查询历史，支持 `page`、`page_size`、`keyword`、`favorite_only` | `Api.listHistory(params)` |
| `DELETE` | `/api/history/{id}` | 删除指定历史记录 | `Api.deleteHistory(id)` |
| `DELETE` | `/api/history` | 清空历史；可带 `favorite_only=true` 只清收藏 | `Api.clearHistory(favoriteOnly)` |
| `PATCH` | `/api/history/{id}/favorite` | 切换收藏状态；Body 可选 `{ is_favorite }`，不传表示取反 | `Api.toggleFavorite(id, isFavorite)` |
| `GET` | `/api/history/stats` | 统计：总数、今日、收藏数、最常用运算符、最近一次计算时间 | `Api.stats()` |
| `POST` | `/api/convert/base` | 进制转换，Body `{ value, from_base, to_base }` | `Api.convertBase(value, fromBase, toBase)` |
| `POST` | `/api/convert/unit` | 单位换算，Body `{ value, category, from_unit, to_unit }` | `Api.convertUnit(value, category, fromUnit, toUnit)` |
| `GET` | `/api/meta/functions` | 元数据：支持的进制、单位类别与单位、函数与常量清单 | `Api.meta()`，`Tools.loadMeta()` |
| `GET` | `/docs` | 后端 Swagger 交互式文档（非 JSON 接口） | `Api.docsUrl()`，顶栏"接口文档"按钮 |

统一错误模型（`js/api.js` 的 `ApiError`）：`error.message`（中文可读提示）、
`error.errorCode`（如 `NETWORK_ERROR`、`HTTP_422`，或后端返回的 `error_code`）、
`error.status`（HTTP 状态码）、`error.detail`。请求相关约定：

- `GET` / `DELETE` 参数经 `URLSearchParams` 拼接，值为 `undefined` / `null` / `''` 时不下发；
- 有 Body 的请求固定 `Content-Type: application/json`，并 `JSON.stringify`；
- 请求超时 `REQUEST_TIMEOUT_MS = 8000`（健康探测为 `HEALTH_TIMEOUT_MS = 2500`）；
- 响应体先取 `text()` 再尝试 `JSON.parse`，空响应体归一化为 `{}`。

---

## 10. 安全性说明

| 措施 | 说明 |
| --- | --- |
| 历史记录渲染前转义 | 历史列表用 `innerHTML` 拼接，凡来自后端的用户数据（表达式、结果、时间）一律先过 `UI.escapeHtml()`，防止输入 `<img src=x onerror=...>` 造成 XSS |
| 其他 `innerHTML` 场景同样转义 | `UI.showMessage()` 对文本与错误码转义；`History.renderEmpty()`、`tools.js` 的错误提示与函数卡片（名称/描述/示例）也都转义 |
| 前端不执行任何用户输入 | 代码中**没有** `eval`、`new Function`、`setTimeout('字符串')` 等动态执行；表达式只作为 JSON 字符串发送给后端 |
| 纯文本渲染优先 | 结果、工具结果、语法树输出使用 `textContent` 而不是 `innerHTML`（如 `#result-value`、`#base-result`、`#parse-output`） |
| 无凭据、无敏感存储 | 不使用 Cookie / Token；`localStorage` 只存主题偏好键 `calculator-theme` |
| 错误信息不泄露内部细节 | 界面只展示归一化后的中文提示与错误码，技术细节留在 `ApiError.detail` |

XSS 防护的实现：

```js
// js/ui.js
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

---

## 11. 常见问题（FAQ）

**Q1：打开页面显示"后端离线"，怎么办？**
按顺序排查：
1. 后端是否已启动？访问 <http://127.0.0.1:8000/api/health>，应返回 `{"status":"ok",...}`；
2. 后端端口是否被改过？若改了，请在 [`js/config.js`](js/config.js) 的
   `API_BASE_URL` 或 `API_CANDIDATES` 里填对应地址；
3. 点击顶栏红色徽标"后端离线（点此重试）"强制重新探测，或等待 15 s 自动轮询；
4. 查看 `#offline-banner` 中显示的地址（`#offline-hint`）是不是你期望的地址。

**Q2：控制台报跨域（CORS）错误怎么办？**
方式二/方式三属于跨源访问，必须由**后端**放行：确认后端 `CORS_ORIGINS` 为默认的 `*`，
或显式加入前端来源（如 `http://127.0.0.1:8080`；`file://` 打开的页面来源为 `null`）。
后端 `main.py` 的 `CORSMiddleware` 已放行 `GET / POST / PATCH / DELETE / OPTIONS`。
注意：`ApiError` 会把这类网络层失败统一转成 `NETWORK_ERROR`，所以界面上看到的是
"无法连接后端服务"而不是 CORS 字样，具体原因请看浏览器控制台。

**Q3：端口被占用（`Address already in use` / `OSError: [Errno 98]`）怎么办？**
换端口并同步改前端配置，例如后端 `$env:PORT="9000"; python run.py`，
前端把 `API_BASE_URL` 设为 `http://127.0.0.1:9000`（或把候选列表里的 8000 改成 9000）。
查占用进程：`netstat -ano | findstr :8000`（Windows）。

**Q4：历史记录为空 / 显示"暂无历史记录，先算一道题吧 ~"？**
1. 该提示表示后端已连通但当前筛选条件下没有数据——先算一道题；
2. 检查是否勾选了"只看收藏"（`#history-fav-only`），或搜索关键词（`#history-search`）没清空；
3. 是否点过"清空"？该操作会真正删除**后端数据库**中的记录，不可撤销；
4. 换浏览器/换电脑仍看到相同历史属正常现象——历史只存在于后端数据库，前端不缓存。

**Q5：页面能打开，但点 `=` 一直没有结果？**
界面能打开只说明静态文件可取到，不代表后端可用。请看顶栏徽标与离线横幅；
"无法得到结果"是设计使然——**前端不做任何计算**，没有本地兜底。

**Q6：主题切换后刷新又变回去了？**
主题存在 `localStorage` 的 `calculator-theme` 键；浏览器隐私模式或禁用本地存储时
会静默降级为默认深色主题（代码用 `try/catch` 兜底，不报错）。

**Q7：结果里的 `×` `÷` 和后端收到的符号不一致？**
界面显示 `×` `÷` `−` `（）` 更符合数学书写习惯，发送前由
`Calculator.toApiExpression()` 统一转换为 `*` `/` `-` `()`，
这只是字符替换，不涉及优先级或求值。

---

## 附：相关文档

- 代码规范与提交前自检清单：[`codestyle.md`](codestyle.md)
- 前端部署手册（含 Netlify / Vercel / GitHub Pages 与部署后自检）：[`docs/DEPLOY.md`](docs/DEPLOY.md)
- 后端仓库：`../832401320_calculator_backend`（FastAPI + SQLAlchemy + SQLite）
