# 代码规范（Frontend Code Style）

> 适用仓库：`832401320_calculator_frontend`（零构建原生前端）
> 本文档描述本仓库**实际遵守**的规范，示例代码全部摘自本仓库真实源码，可直接对照。

---

## 0. 规范来源与本项目的取舍

### 0.1 来源

| 领域 | 主要参考 | 本项目采纳的部分 |
| --- | --- | --- |
| JavaScript | **Google JavaScript Style Guide** | 2 空格缩进、行宽上限、单引号、必须写分号、命名大小写规则、JSDoc 注释块、禁止隐式全局变量、`===` 优先 |
| JavaScript | **Airbnb JavaScript Style Guide** | 函数表达式与 IIFE、`'use strict'`、变量声明置于作用域顶部、`Array.prototype.forEach/map/filter` 优先于 `for`、早返回（early return）、禁止直接改 DOM 集合而转数组 |
| CSS | **BEM**（Block__Element--Modifier） | 组件类命名：`.history-item__result`、`.key--equals`、`.ghost-button--danger` |
| CSS | 设计令牌思路（Design Tokens） | 颜色/圆角/阴影/间距集中在 `:root` 与 `[data-theme="dark"]` |
| 通用 | 12-Factor App（配置外置） | 可变的部署配置集中在 `js/config.js` 一处 |

### 0.2 零构建约束下的取舍（**本项目与上述规范的差异，属有意为之**）

| 规范原味做法 | 本项目做法 | 取舍原因 |
| --- | --- | --- |
| ES Module（`import` / `export`） | `classic script` 顺序加载 + IIFE + `window` 命名空间对象（`UI` / `Api` / `Theme` / `Calculator` / `History` / `Tools` / `Main`） | 不使用打包器；`file://` 直接打开时 ES Module 会因 CORS 被拒，且需要改 `index.html` 的 `type="module"` 与相对路径 |
| `let` / `const`、箭头函数、模板字符串 | 统一 `var` + `function` 表达式 + 字符串拼接 | 兼容性优先（可覆盖到较老的浏览器），且避免在无转译链路下手写 ES6 带来的隐性兼容风险 |
| `class` / 继承 | 构造函数 + 原型链（`ApiError`） | 同样的兼容性理由；`ApiError` 是本仓库唯一的自定义错误类型 |
| 异步 `async` / `await` | `Promise` 链（`.then` / `.catch` / `.finally`） | 避免 `async` 关键字与 `try/catch` 混用导致的错误吞没；Promise 链的 `.catch` 位置在评审时更直观 |
| 每个模块单独文件 + 严格依赖图 | 文件内 IIFE 顶部即时读取 `global.X`，**用加载顺序表达依赖** | 无模块系统；依赖关系写在 `index.html` 的 `<script>` 顺序里，并在各模块 JSDoc 中说明 |
| 私有字段 `#name` / 闭包内 `const` 常量 | IIFE 内部 `var` 闭包变量（对外不暴露） | 达到同样的"模块私有"效果，且无需语言新特性 |

**一句话原则**：在本仓库里，**凡是可以换来"零依赖、零构建、可双击运行"的写法优先**；
一旦某项规范与兼容性或零构建冲突，以兼容性和零构建为准，并在 JSDoc 中写明理由。

---

## 1. 文件与模块组织

### 1.1 一个文件 = 一个模块 = 一个 IIFE + `'use strict'`

每个 `js/*.js` 文件的结构固定为：文件头 JSDoc（说明模块职责与设计理由）→
IIFE（接收 `global` 参数）→ `'use strict'` → 模块私有变量与函数 → 挂载单一命名空间对象。

```js
/**
 * 通用 UI 小工具：DOM 查询、HTML 转义、轻提示。
 *
 * 单独抽出来的原因：这些函数被 calculator / history / tools 三个模块共用，
 * 放在各自的模块里会出现三份重复实现（违反 DRY）。
 *
 * @module UI
 */
(function (global) {
  'use strict';

  /** 查询单个元素 */
  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }
```

- IIFE 参数命名为 `global`，结尾统一传 `window`：`})(window);`
- `'use strict'` 必须位于 IIFE 函数体第一行（不能只在文件顶层，否则对其他文件无效）
- 命名空间挂载点在文件末尾集中出现，便于一眼确认模块的公开 API
- 私有状态用 IIFE 内的 `var` 持有，且**不**挂到命名空间上（如 `api.js` 的 `activeBase`、`offline`、`statusListeners`）

### 1.2 单一职责

| 文件 | 唯一职责 | 不允许出现 |
| --- | --- | --- |
| `config.js` | 部署配置常量 | 任何逻辑与 DOM 操作 |
| `api.js` | 与后端通信 + 统一错误模型 | DOM 操作、界面文案以外的渲染 |
| `ui.js` | DOM 查询/转义/提示等通用工具 | 业务规则、API 调用 |
| `theme.js` | 主题切换与持久化 | 计算、历史相关逻辑 |
| `calculator.js` | 计算器的输入与结果渲染 | 数值计算（**强约束**） |
| `history.js` | 历史记录的查询与展示 | 计算、单位换算 |
| `tools.js` | 扩展工具（进制/单位/语法/函数清单） | 数值换算算法（全部走后端） |
| `main.js` | 模块装配与后端在线状态 | 业务细节实现 |

### 1.3 加载顺序依赖（有依赖，禁止随意调整）

`api.js` 在 IIFE 内**立即**读取 `global.CALC_CONFIG`，`theme.js` / `calculator.js` / `history.js` / `tools.js`
在 IIFE 内**立即**读取 `global.UI`、`global.Api`，因此脚本顺序为：

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

- 规则：**被依赖者必须先加载**；新增模块时，必须在 `index.html` 中确认它在所有使用者的前面。
- 规则：需要跨模块调用时，**在函数内部**通过命名空间访问（惰性解析），不要在 IIFE 顶部抓取循环依赖对象：

```js
// js/calculator.js —— 惰性访问，避免与 History 形成加载顺序死锁
if (global.History) {
  global.History.reload();
}
```

- 规则：`main.js` 必须最后加载；它自身负责在 `DOMContentLoaded`（或文档已就绪时立即）调用 `init()`：

```js
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

---

## 2. 命名规范

| 对象 | 规则 | 真实示例 |
| --- | --- | --- |
| 变量 / 函数 | `camelCase` | `activeBase`、`statusListeners`、`renderPagination`、`toApiExpression` |
| 常量（模块级、全大写） | `UPPER_SNAKE_CASE` | `STORAGE_KEY`、`THEMES`、`PAGE_SIZE`、`REQUEST_TIMEOUT_MS`、`SEARCH_DEBOUNCE_MS` |
| 构造函数 / 命名空间 | `PascalCase` | `ApiError`、`UI`、`Api`、`Theme`、`Calculator`、`History`、`Tools`、`Main`、`CALC_CONFIG` |
| 配置对象字段 | `UPPER_SNAKE_CASE` | `API_BASE_URL`、`API_CANDIDATES`、`HEALTH_POLL_MS` |
| 模块私有变量 | `camelCase`，不暴露 | `offline`、`pollTimer`、`metaCache`、`toastTimer` |
| DOM id | `kebab-case`，语义化前缀 `btn-` | `expression-input`、`result-value`、`btn-equals`、`history-page-info`、`stat-top-op`、`sci-keypad` |
| CSS 类 | BEM（见第 9 节） | `panel__header`、`history-item__meta`、`key--op`、`icon-action--active` |
| `data-*` 属性 | 语义化、全小写、描述行为而非外观 | `data-insert`、`data-action`、`data-mode`、`data-tool`、`data-tool-panel`、`data-id`、`data-state` |
| 布尔值 | `is` / `has` 前缀 | `isFavorite`、`favoriteOnly`、`is_favorite`（后端字段保持原样） |

常量定义示例（`js/config.js`、`js/theme.js`）：

```js
// js/theme.js
var STORAGE_KEY = 'calculator-theme';
var THEMES = { dark: '🌙 深色', light: '☀️ 浅色' };
```

```js
// js/config.js
  /** 历史记录每页条数 */
  PAGE_SIZE: 5,

  /** 搜索防抖（毫秒） */
  SEARCH_DEBOUNCE_MS: 300
```

**过渡到 DOM 的命名映射**：DOM id 用 kebab-case，JS 变量用 camelCase，
两者通过"查询表达式"连接，不要为同一元素起两套名字：

```js
function renderPagination() {
  UI.$('#history-total').textContent = state.total;
  UI.$('#history-page-info').textContent = '第 ' + state.page + ' / ' + state.pages + ' 页 · 共 ' + state.total + ' 条';
  UI.$('#history-prev').disabled = state.page <= 1;
  UI.$('#history-next').disabled = state.page >= state.pages;
}
```

---

## 3. 注释与文档块

### 3.1 每个模块顶部必须有 JSDoc 文件头

必须包含：**模块职责** + **为什么这样设计**（不只是"做了什么"）+ `@module` 标签。

```js
/**
 * API 客户端：前端与后端之间**唯一**的通信出口。
 *
 * 设计要点
 * --------
 * 1. **所有计算相关的请求都只发表达式**，客户端从不计算最终结果；
 *    这里唯一做的字符串处理是"显示符号 → 传输符号"（× → *，÷ → /），
 *    属于展示层格式转换，不产生任何数值结果。
 * 2. **统一错误模型**：HTTP 状态码 / 业务错误码 / 中文提示被归一化成 ApiError，
 *    UI 层只需要 `error.message` 与 `error.errorCode`。
 * 3. **基地址自动探测**：见 config.js 说明，探测失败即视为"后端离线"，
 *    并广播状态变化事件，让界面显示离线横幅（这正是作业要求的
 *    "停掉后端就无法得到新结果"的可视化证据）。
 *
 * @module Api
 */
```

### 3.2 函数注释：非平凡函数必须有 JSDoc，且必须写"为什么"

```js
/**
 * 显示消息条。
 * @param {string} text 文本
 * @param {'error'|'success'|'info'} [type]
 * @param {string} [code] 后端错误码，展示出来便于对照接口文档
 */
function showMessage(text, type, code) {
```

```js
  /**
   * 解析可用基地址：优先显式配置，其次逐个候选探测。
   *
   * 返回值约定（很重要）：
   *   - 字符串（可能是空串 ""）→ 连通，空串表示"与页面同源"
   *   - null → 所有候选都不可达，判定为离线
   * 之所以不用空串同时表示"离线"，是因为 `"" + "/api/health"` 会变成合法的同源地址，
   * 两者必须区分开。
   *
   * @param {boolean} [force] 忽略缓存强制重新探测
   * @returns {Promise<string|null>}
   */
  function resolveBase(force) {
```

### 3.3 反直觉代码必须留"为什么"注释

凡是"看起来写错了、其实是对的"的行，必须紧邻注释说明，防止后人"顺手改坏"：

```js
  function notifyStatus(isOnline, base) {
    // 注意：offline 表示"上一步的离線状态"，状态没变化时不必通知订阅者。
    // 这里必须写成 offline === !isOnline，否则首次"上线"会被误判为"无变化"而丢掉。
    if (offline === !isOnline) {
      return;
    }
```

```js
      // 判断在线与否必须用 Api.isOnline()，不能用 Boolean(base)：
      // 同源部署时 base 是空字符串，那是"在线"而不是"离线"。
      updateStatus({ online: Api.isOnline(), base: Api.base() });
```

---

## 4. 排版、缩进与语句

| 规则 | 约定 | 依据 |
| --- | --- | --- |
| 缩进 | **2 个空格**，禁止 Tab（`index.html`、CSS 同样 2 空格） | Google JS Style |
| 行宽上限 | **120 字符**；超出时用运算符换行并让续行缩进 4 空格 | Google JS Style |
| 分号 | **必须写**，不依赖 ASI | Google JS Style |
| 引号 | JS 一律**单引号**；含单引号的字符串改用双引号；HTML 属性用双引号 | Google / Airbnb |
| 相等判断 | 一律 `===` / `!==`，禁止 `==` / `!=` | Airbnb |
| 尾随逗号 | **不写**（对象/数组字面量最后一个元素后不加逗号） | 兼容老引擎 |
| 花括号 | 单行 `if` 也**必须**带花括号 | Airbnb |
| 空行 | 逻辑段落之间空一行；函数之间恰好一个空行 | Google JS Style |
| 文件结尾 | 保留一个换行符，不留多余空行 | 通用 |

长表达式换行的真实写法（续行缩进 4 空格，运算符置于行尾）：

```js
        renderMeta(
          '后端计算耗时 ' + data.elapsed_ms + ' ms · 语法树 ' + data.node_count + ' 节点 / 深度 ' +
            data.max_depth + ' · 历史记录 #' + (data.history_id === null ? '未保存' : data.history_id)
        );
```

```js
          '<button type="button" class="icon-action' + (item.is_favorite ? ' icon-action--active' : '') +
          '" data-action="favorite" data-id="' + item.id + '" title="' + (item.is_favorite ? '取消收藏' : '收藏') + '">' +
```

---

## 5. 字符串拼接与模板

### 5.1 本项目不用模板字符串，用 `+` 拼接

| 场景 | 写法 | 原因 |
| --- | --- | --- |
| 普通文本拼接 | `'第 ' + state.page + ' / ' + state.pages + ' 页'` | 统一 `var` + 字符串拼接，保持全套 ES5 语法风格，避免"一半 ES5 一半 ES6"的混杂 |
| 拼 HTML 片段 | `+` 拼接，**所有插值必须 `UI.escapeHtml()`** | 拼 HTML 是为了批量渲染；插值转义是 XSS 强制要求 |
| 纯文本渲染 | 优先 `textContent`，不要拼 HTML | 无需转义、无 XSS 面 |

```js
    var html = items
      .map(function (item) {
        return (
          '<article class="history-item" data-id="' + item.id + '">' +
          '<div class="history-item__body">' +
          '<p class="history-item__expression" title="点击填入表达式">' + UI.escapeHtml(item.expression) + '</p>' +
          '<p class="history-item__result">= ' + UI.escapeHtml(item.result) + '</p>' +
```

```js
        UI.$('#base-result').textContent = data.value + ' (' + data.from_base + '进制) = ' + data.result +
          ' (' + data.to_base + '进制)';
```

### 5.2 例外与规则

- 例外：CSS 选择器、URL、正则等"结构性字符串"仍用单引号普通字符串，不用拼接。
- 规则：**不要在循环里做字符串 `+=` 累积**；改用 `map(...).join('')` 一次性生成：

```js
        )
      )
      .join('');
    UI.$('#function-reference').innerHTML = html;
```

- 规则：拼接结果若来自后端（`data.*`）且要进 `innerHTML`，**必须先转义**；
  非字符串数字（如 `item.id`、`data.from_base`）可不转义，但不得直接来自未校验的自由文本。

---

## 6. DOM 操作规范

### 6.1 统一走 `UI.$` / `UI.$$`

禁止在业务模块中直接写 `document.querySelector`（`ui.js` 自身除外，它是实现层）。

```js
  /** 查询单个元素 */
  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  /** 查询多个元素（返回真数组，方便 forEach / map） */
  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }
```

- `UI.$$` 返回**真数组**（`Array.prototype.slice.call`），因此可以直接 `.forEach` / `.map` / `.filter`。
- 查询到的元素节点在**使用点查询**还是缓存，规则是：**只查一次且只用一次 → 直接查；
  同一函数内多次使用 → 先赋值给局部变量**，避免在循环里反复查询 DOM：

```js
  function setBusy(busy) {
    state.busy = busy;
    var button = UI.$('#btn-equals');
    if (button) {
      button.disabled = busy;
      button.textContent = busy ? '计算中…' : '= 计算';
    }
  }
```

### 6.2 事件委托优先，禁止为列表项逐个绑定

列表内容随数据重建，逐项绑定会随每次重渲染而泄漏/失效。因此容器上只绑一次，
用 `event.target.closest()` 判定真实目标：

```js
  function handleListClick(event) {
    var button = event.target.closest('button');
    var card = event.target.closest('.history-item');
    if (!card) {
      return;
    }
    var id = Number(card.getAttribute('data-id'));
```

```js
  function init() {
    UI.$('#keypad').addEventListener('click', handleKeypadClick);
    UI.$('#sci-keypad').addEventListener('click', handleKeypadClick);
    UI.$('#btn-copy-result').addEventListener('click', copyResult);
    document.addEventListener('keydown', handleKeydown);
```

- 规则：所有事件绑定集中在模块的 `init()` 内，方便一眼审查"这个模块监听了什么"。
- 规则：初始化函数统一命名 `init()`，并挂到命名空间：`global.Tools = { init: init, loadMeta: loadMeta };`
- 规则：`init()` 若需要等待数据，返回 `Promise`（`main.js` 依赖这一点来组织装配顺序）。

### 6.3 渲染：`textContent` 优先，`innerHTML` 仅在批量渲染时使用

| 场景 | 用什么 |
| --- | --- |
| 单一文本结果（结果、备注、统计值） | `textContent` |
| 列表/卡片批量渲染 | `innerHTML` + `escapeHtml` |
| 语法树 JSON 输出 | `textContent = JSON.stringify(...)` |
| 表单控件 | `value`；下拉用 `appendChild(option)` |

```js
  function renderResult(text) {
    UI.$('#result-value').textContent = text;
  }
```

```js
        UI.$('#parse-output').textContent = JSON.stringify({ tokens: data.tokens, tree: data.tree }, null, 2);
```

- 规则：用 `hidden` 属性控制显隐（配套 CSS `[hidden] { display: none !important; }` 兜底），
  不要用 `style.display` 或内联样式：

```js
    var sci = UI.$('#sci-keypad');
    if (sci) {
      sci.hidden = mode !== 'scientific';
    }
```

- 规则：创建下拉项用 `document.createElement` + `textContent`，不要拼 HTML 字符串：

```js
  function option(value, label) {
    var element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
  }
```

### 6.4 状态集中在一个 `state` 对象

模块的界面状态收拢为单个 `var state = {...}`，禁止散落的全局标记：

```js
  var state = {
    page: 1,
    pageSize: config.PAGE_SIZE,
    keyword: '',
    favoriteOnly: false,
    total: 0,
    pages: 1,
    items: []
  };
```

---

## 7. 异步规范

### 7.1 统一使用 Promise 链，不用 `async/await`

```js
    return Api.calculate(toApiExpression(raw))
      .then(function (data) {
        state.lastResult = data.result_display;
        renderResult(data.result_display);
        renderMeta(
          '后端计算耗时 ' + data.elapsed_ms + ' ms · 语法树 ' + data.node_count + ' 节点 / 深度 ' +
            data.max_depth + ' · 历史记录 #' + (data.history_id === null ? '未保存' : data.history_id)
        );
        UI.showMessage('计算成功：' + data.expression + ' = ' + data.result_display, 'success');
        if (global.History) {
          global.History.reload();
        }
      })
      .catch(function (error) {
        renderResult('—');
        renderMeta('计算失败，未写入历史记录');
        UI.showMessage(error.message, 'error', error.errorCode);
      })
      .then(function () {
        setBusy(false);
      });
```

- 规则：`.catch` 拒绝**吞掉**错误——必须转成用户可读提示（`error.message` + `error.errorCode`）。
- 规则：收尾动作（恢复按钮、解除 loading）放在链尾的 `.then`，保证成功失败都会执行。
- 规则：并发且互不依赖的请求用 `Promise.all`：

```js
  function reload() {
    return Promise.all([load(), loadStats()]);
  }
```

- 规则：需要的中间数据先取局部变量，不要深链 `.then(...).then(...)` 传递多个值。
- 规则：**不能在 `.catch` 里静默 `return`**；至少要更新界面。若确实可忽略（如隐私模式下的存储失败），
  必须写注释并保证功能降级：

```js
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* 隐私模式下 localStorage 可能不可用，忽略即可 */
    }
```

### 7.2 所有错误统一为 `ApiError`

禁止把 `TypeError`、`Response`、字符串等异类错误抛给 UI 层；网络层与 HTTP 层异常都要归一化：

```js
  function ApiError(message, meta) {
    var info = meta || {};
    this.name = 'ApiError';
    this.message = message;
    this.errorCode = info.errorCode || 'UNKNOWN_ERROR';
    this.status = info.status || 0;
    this.detail = info.detail || '';
    this.stack = new Error(message).stack;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;
```

- `errorCode` 约定：网络不可达为 `NETWORK_ERROR`；HTTP 层为 `HTTP_<status>`；
  后端业务错误用后端返回的 `error_code`；兜底 `UNKNOWN_ERROR`。
- UI 层的调用范式固定为：`UI.showMessage(error.message, 'error', error.errorCode);`

### 7.3 超时与取消

带超时的请求统一用 `AbortController`，且**必须在 `finally` 中清理定时器**，避免泄漏：

```js
  function fetchWithTimeout(url, options, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    var init = Object.assign({}, options, { signal: controller.signal, mode: 'cors' });

    return fetch(url, init).finally(function () {
      clearTimeout(timer);
    });
  }
```

### 7.4 防抖用于高频事件

搜索框输入必须防抖（`SEARCH_DEBOUNCE_MS = 300`），避免每敲一个字符打一次接口：

```js
  /** 防抖：搜索框输入时避免每敲一个字符就打一次接口 */
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  }
```

---

## 8. API 调用规范

### 8.1 唯一出口：`js/api.js`

**禁止任何业务模块直接使用 `fetch` / `XMLHttpRequest`。**
`calculator.js` / `history.js` / `tools.js` 只能调用 `Api.*` 方法：

```js
    Api.convertUnit(value, UI.$('#unit-category').value, UI.$('#unit-from').value, UI.$('#unit-to').value)
      .then(function (data) {
        UI.$('#unit-result').textContent =
          data.value + ' ' + data.from_name + ' = ' + data.result_display + ' ' + data.to_name;
        UI.$('#unit-formula').textContent = '换算过程：' + data.formula;
      })
```

由 `api.js` 统一负责：基地址解析、`Content-Type: application/json` 与序列化、超时、
查询串拼接、错误归一化、在线状态广播。

### 8.2 新增接口的标准步骤

1. 在 `Api` 对象中新增一个**动词命名**的方法（`listHistory`、`convertBase`、`toggleFavorite`…）；
2. 有 Body 的写 `body: {...}`，查询参数用 `withQuery(path, params)`；
3. 路径参数必须 `encodeURIComponent`；
4. 方法上写一行 JSDoc 说明用途；
5. 业务模块只消费返回值，并 `.catch` 转成用户提示。

```js
    /** 删除指定历史记录 */
    deleteHistory: function (id) {
      return request('/api/history/' + encodeURIComponent(id), { method: 'DELETE' });
    },
```

```js
    /** 收藏 / 取消收藏（不传 isFavorite 表示取反） */
    toggleFavorite: function (id, isFavorite) {
      var body = {};
      if (typeof isFavorite === 'boolean') {
        body.is_favorite = isFavorite;
      }
      return request('/api/history/' + encodeURIComponent(id) + '/favorite', {
        method: 'PATCH',
        body: body
      });
    },
```

### 8.3 字段命名：请求体用 `snake_case`，JS 变量用 `camelCase`

后端契约字段保持原样（`save_history`、`page_size`、`favorite_only`、`from_base`、`is_favorite`），
方法参数名用 camelCase，转换发生在方法体内部：

```js
    calculate: function (expression, saveHistory) {
      return request('/api/calculate', {
        method: 'POST',
        body: { expression: expression, save_history: saveHistory !== false }
      });
    },
```

### 8.4 查询参数：空值不下发

```js
  function withQuery(path, params) {
    var search = new URLSearchParams();
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        search.append(key, value);
      }
    });
    var query = search.toString();
    return query ? path + '?' + query : path;
  }
```

### 8.5 前端不做计算的硬约束

- 唯一允许的字符串处理是显示符号映射：`×`→`*`、`÷`→`/`、`−`→`-`、`（）`→`()`。
- 禁止出现任何算术求值：`eval`、`new Function`、手写四则/幂/阶乘/三角函数、
  进制换算、单位换算（包括"顺手算一下百分比"这类小聪明）。
- 允许的客户端"检查"仅限**界面级**：是否为空、是否正在请求中（防重复提交）：

```js
    var raw = getExpression().trim();
    if (!raw) {
      UI.showMessage('请先输入要计算的表达式', 'error', 'EMPTY_EXPRESSION');
      inputNode().focus();
      return Promise.resolve();
    }
```

- 反例（**严禁**出现）：`var result = eval(expr);`、`var area = w * h;`、
  `if (fromBase === 16) { ... parseInt(...) ... }`。

---

## 9. CSS 规范

### 9.1 BEM 命名

`block__element--modifier`，全小写，多词用 `-` 连接：

| 类型 | 形式 | 示例 |
| --- | --- | --- |
| Block | `.block` | `.panel`、`.topbar`、`.key`、`.history-item`、`.function-card` |
| Element | `.block__element` | `.panel__header`、`.history-item__result`、`.function-card__desc`、`.chip__dot` |
| Modifier | `.block--mod` / `.block__element--mod` | `.panel--tools`、`.key--equals`、`.tab--active`、`.ghost-button--danger` |
| 状态属性 | 用 `data-*` 属性选择器，不新增类 | `.chip__dot[data-state="online"]`、`.key[disabled]` |

```css
.history-item__result {
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

```css
.chip__dot[data-state="online"] {
  background: var(--color-success);
  box-shadow: 0 0 0 4px rgba(23, 178, 106, 0.18);
}
```

### 9.2 设计令牌集中在 `:root` 与 `[data-theme="dark"]`

颜色、圆角、阴影、间距、字体**只允许**定义在这两个块中，业务规则里只能通过 `var()` 消费：

```css
:root {
  --color-bg: #f4f6fb;
  --color-surface: #ffffff;
  --color-border: #e3e8f2;
  --color-text: #1c2333;
  --color-primary: #4f7cff;
  --shadow-md: 0 10px 30px rgba(20, 30, 60, 0.08);
  --radius-md: 12px;
  --space-3: 12px;
  --font-mono: "Cascadia Mono", "JetBrains Mono", Consolas, "Courier New", monospace;
}
```

```css
[data-theme="dark"] {
  --color-bg: #0f1420;
  --color-surface: #161d2c;
  --color-border: #26314a;
  --color-text: #e8edf7;
  --shadow-md: 0 14px 34px rgba(0, 0, 0, 0.45);
}
```

- 规则：深色主题是**变量覆盖**，不是另写一套选择器；组件样式对两套主题共用。
- 规则：新增颜色必须同时补进 `:root` 与 `[data-theme="dark"]`（若不需随主题变化，用 `--color-*` 之外的语义名并在注释说明）。
- 规则：`data-theme` 由 `theme.js` 写在 `<html>` 元素上（`document.documentElement`）。

### 9.3 禁止内联样式

- 禁止 `style="..."` 属性（`index.html` 中没有任何内联样式）。
- 禁止 JS 写 `element.style.*`；显隐一律用 `hidden` 属性，状态一律用 `classList` 或 `data-*`：

```js
      var active = tab.getAttribute('data-mode') === mode;
      tab.classList.toggle('tab--active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
```

### 9.4 选择器层级不超过 2 层

- 禁止 `#id` 选择器、禁止 `!important`（**唯一例外**见 9.5）、禁止元素选择器嵌套超过 2 层。
- 允许的形态：单个类、`block element`（后代 2 层）、`.stats dt` / `.field > span`（1 层后代）、
  属性选择器修饰。

```css
.stats dd {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
}
```

```css
.field > span {
  color: var(--color-text-muted);
  font-size: 12px;
}
```

### 9.5 `[hidden]` 兜底规则：为什么必须存在

```css
/**
 * 关键修复：浏览器默认样式里的 [hidden]{display:none} 优先级很低，
 * 只要组件自己写了 display:flex/grid（如 .offline-banner、.sci-keypad），
 * hidden 属性就会失效、元素照样显示。这里统一兜底，避免"隐藏开关失灵"。
 */
[hidden] {
  display: none !important;
}
```

- 原因：组件类如 `.offline-banner { display: flex; }`、`.sci-keypad { display: grid; }`、
  `.toast { position: fixed; }` 的优先级高于浏览器默认的 `[hidden] { display: none; }`，
  导致 `element.hidden = true` 不生效。
- 这是**全仓库唯一**允许的 `!important`；不得在别处使用。
- 因此 JS 侧统一用 `node.hidden = true/false` 控制显隐，不需要额外加类。

### 9.6 组织顺序

文件顶部注释列出章节顺序，正文按序排列：设计令牌 → 重置与排版 → 组件 → 响应式。

```css
/* ============================================================================
 * 前后端分离计算器 · 样式表
 *
 * 组织方式：
 *   1. 设计令牌（CSS 变量）—— 颜色、圆角、阴影、间距集中定义，便于换主题
 *   2. 基础重置与排版
 *   ...
 * 命名约定：BEM（block__element--modifier），详见 codestyle.md
 * ========================================================================== */
```

- 响应式集中在文件末尾的 `@media (max-width: 980px)` / `@media (max-width: 560px)`，
  不散落在各组件定义之间。

---

## 10. 可访问性（a11y）

| 要求 | 做法 | 真实示例 |
| --- | --- | --- |
| 动态区域必须 `aria-live` | 结果、消息条、toast 都要能被读屏播报 | `<output class="display__result" id="result-value" aria-live="polite">`、`<div class="message" id="message-area" role="status" aria-live="polite" hidden>`、`<div class="toast" id="toast" role="status" aria-live="polite" hidden>` |
| 输入框必须有标签 | 视觉标签可隐藏，但必须存在并可关联 | `<label class="sr-only" for="expression-input">表达式</label>` + `aria-describedby="result-meta"` |
| 语义化角色 | 面板用 `section` + `aria-label`；tab 组用 `role="tablist"` / `role="tab"` 并同步 `aria-selected` | `<section class="panel panel--calculator" aria-label="计算器">` |
| 纯装饰内容对读屏隐藏 | 图标用 `aria-hidden="true"` | `<span class="topbar__logo" aria-hidden="true">÷×</span>` |
| 按钮必须 `type="button"` | 防止在表单语境下意外提交 | 全部 `<button type="button">` |
| 图标按钮要有文字/标题 | 用 `title` + 可见文字标签 | `<button type="button" class="icon-button" id="theme-toggle" title="切换深色 / 浅色主题">` |
| 键盘可操作 | 全局快捷键 + 输入框内 Enter 直达 | `Enter` 计算、`Esc` 清空、`Backspace` 退格；`#base-value` / `#parse-input` 内 Enter 触发对应工具 |
| 视觉隐藏但保留读屏 | `.sr-only` 工具类 | `.sr-only { position: absolute; width: 1px; height: 1px; ... }` |
| 首屏焦点 | 初始化时把焦点放到表达式输入框 | `inputNode().focus();`、`inputNode().focus()` 在 `init()` 末尾 |

```js
  /** 全局快捷键：焦点在输入框内时仍可用 Enter / Esc，其余按键交给输入框自身 */
  function handleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      calculate();
      return;
    }
```

`aria-selected` 必须与视觉激活态同步更新，二者不能脱节：

```js
    UI.$$('[data-tool]').forEach(function (tab) {
      var active = tab.getAttribute('data-tool') === name;
      tab.classList.toggle('tab--active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
```

---

## 11. 安全

### 11.1 `escapeHtml` 的使用场景

**凡是"外部数据 + `innerHTML`"的组合，插值必须过 `UI.escapeHtml()`。** 触发场景包括：

| 场景 | 数据来源 | 代码位置 |
| --- | --- | --- |
| 历史列表：表达式、结果、时间 | 后端数据库（含用户输入） | `history.js` `renderItems()` |
| 空状态/错误文案 | 后端返回的 `message` | `history.js` `renderEmpty()`、`tools.js` `loadMeta()` 的 catch |
| 消息条文本与错误码 | 后端错误信息 | `ui.js` `showMessage()` |
| 函数速查卡片：名称、描述、参数、示例 | 后端 `GET /api/meta/functions` | `tools.js` `renderFunctions()` |

```js
  /**
   * 转义 HTML 特殊字符。
   * 历史记录里的表达式来自用户输入，直接拼进 innerHTML 会有 XSS 风险
   * （例如输入 <img src=x onerror=...>），因此渲染前必须转义。
   */
  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
```

```js
  function renderEmpty(message) {
    UI.$('#history-list').innerHTML = '<p class="empty-state">' + UI.escapeHtml(message) + '</p>';
  }
```

### 11.2 安全红线

1. **前端不执行任何用户输入**：禁止 `eval`、`new Function`、`document.write`、
   把用户输入当选择器/URL/属性名使用。
2. **能 `textContent` 就不 `innerHTML`**：单值渲染一律 `textContent`（如 `#result-value`、`#parse-output`、`#base-result`）。
3. **不引入第三方脚本**：页面无 CDN、无外链 JS（`<link rel="icon">` 用的内联 data URI SVG 除外）。
4. **不存储敏感信息**：`localStorage` 只允许写主题键 `calculator-theme`；禁止写入表达式、结果或任何凭据。
5. **链接与跳转固定来源**：外部跳转只允许 `Api.docsUrl()`（后端 `/docs`），不做用户可控的 URL 拼接。
6. **错误信息不外泄内部细节**：界面只显示归一化中文提示与错误码。

---

## 11.5 规范的可校验性（`scripts/check-frontend-style.py`）

前面所有条目如果只能靠"人工评审"，规范就很容易在后期腐化。因此项目根目录的
`scripts/` 下提供了一份**零依赖**的规则检查器（用 Python 实现，不需要 Node / npm / ESLint）：

```bash
cd <项目根目录>
python scripts/check-frontend-style.py
# → 全部通过 ✅（8 个文件，20 类规则）
```

**为什么不用 ESLint？** 本项目明确的设计目标是"前端零依赖、零构建"：助教不装 Node 生态
就能双击 `index.html` 运行与评阅。为检查规范而引入 `package.json` + `node_modules`，
反而破坏了这条约束。ESLint 是更标准的选择，但当项目有意避开 npm 工具链时，
用项目本来就有的 Python 环境实现一份轻量检查器是更一致的做法。若将来引入构建步骤，
应当换成 ESLint（Google / Airbnb 官方配置）。

检查器固化的规则（对应本文档章节）：

| 规则 | 对应章节 |
| --- | --- |
| IIFE + `'use strict'`（`js/config.js` 因是纯配置字面量而豁免，已在脚本中注明理由） | 1.1 |
| 禁止 `eval` / `new Function` / `document.write` | 11.2 |
| 禁止越界语法：箭头函数、`let`/`const`、模板字符串、`class`、`async`/`await`、`?.`、`??` | 0.2、5.1、7.1 |
| JS 字符串统一单引号（HTML 属性与正则字面量里的双引号不算违规） | 4 |
| 行宽 ≤ 120 列、缩进 2 空格、无 Tab、无行尾空白、文件以换行结尾 | 4 |
| 禁止 `console.log`（保留 `console.error` / `console.warn`） | 3 |
| 只有 `js/api.js` 可以直接调用 `fetch` | 8.1 |

> 检查器本身也踩过坑：最初"禁止双引号"这条规则把 `escapeHtml` 里的
> `.replace(/"/g, '&quot;')` 判成了违规 —— 那个双引号在**正则字面量**里，是必须写的。
> 修正方式是匹配前先剥掉单引号字符串与正则字面量的内容，只对"结构性代码"判定。
> 这件事本身也说明：**规则要落到脚本里跑一遍，才知道它是不是真的合理。**

---

## 12. 提交前自检清单

### 结构与加载

- [ ] 新增/修改的文件是 `js/*.js` 或 `css/style.css`，且**没有引入** `package.json`、`node_modules`、任何构建产物
- [ ] `index.html` 的 `<script>` 顺序仍满足"config → api → ui → theme/calculator/history/tools → main"
- [ ] 新模块仍是"IIFE + `'use strict'` + 单一 `window` 命名空间"结构，未污染全局作用域
- [ ] 未新增隐式全局变量（所有变量都有 `var`，无未声明赋值）

### 规范

- [ ] 已有 `python scripts/check-frontend-style.py` 全部通过（IIFE/严格模式、禁用语法、引号、行宽、缩进、日志、fetch 唯一出口）
- [ ] 缩进 2 空格、行宽 ≤ 120、语句末尾有分号、字符串用单引号
- [ ] DOM id 使用 kebab-case；`data-*` 属性语义化；CSS 类符合 BEM
- [ ] 命名空间/构造函数用 PascalCase，常量用 `UPPER_SNAKE_CASE`，其余 camelCase
- [ ] 每个模块顶部有 JSDoc 文件头（含"为什么"），非平凡函数有 JSDoc
- [ ] 反直觉代码旁有解释性注释

### DOM / 异步 / 接口

- [ ] DOM 查询走 `UI.$` / `UI.$$`，未在循环中反复查询；列表使用事件委托
- [ ] 显隐使用 `hidden` 属性；**没有**内联样式，**没有** JS 写 `element.style`
- [ ] 异步使用 Promise 链，`.catch` 一定把错误转成 `UI.showMessage(error.message, 'error', error.errorCode)`
- [ ] 高频输入有防抖；请求有超时且定时器在 `finally` 清理
- [ ] 业务模块**没有**直接调用 `fetch` / `XMLHttpRequest`，全部经 `Api.*`
- [ ] 新增接口方法写好了 JSDoc，路径参数 `encodeURIComponent`，Body 字段为 `snake_case`

### 可访问性与安全

- [ ] 动态输出区有 `aria-live` / `role="status"`；`aria-selected` 与激活态同步
- [ ] 新按钮 `type="button"`；图标按钮有 `title` 与可读标签；表单控件有关联 label
- [ ] 新增的 `innerHTML` 插值全部经过 `UI.escapeHtml()`；能 `textContent` 的没用 `innerHTML`
- [ ] 未引入 `eval` / `new Function` / 外链脚本；`localStorage` 未存敏感或业务数据
- [ ] **确认前端没有任何计算逻辑**：无四则/幂/阶乘/三角函数/进制换算/单位换算实现，
      无 `eval`；唯一的字符串处理是显示符号映射（`×`→`*`、`÷`→`/`、`−`→`-`、`（）`→`()`），
      所有结果均来自后端 API 返回值 <!-- 本清单最重要的一条 -->
- [ ] 停掉后端进程后手工验证：界面仍可输入，点 `=` 得到 `NETWORK_ERROR`，前端**不会**给出任何本地结果

### 跨浏览器

- [ ] 未使用 `let` / `const` / 箭头函数 / 模板字符串 / `class` / `async`（与零构建 + 兼容性约定一致）
- [ ] 新用到的浏览器 API 已确认在 README「浏览器兼容性」表覆盖的版本内；否则需降级并提供兜底提示
