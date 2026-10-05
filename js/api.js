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
(function (global) {
  'use strict';

  var config = global.CALC_CONFIG;

  /** 当前生效的后端基地址（探测成功后缓存） */
  var activeBase = null;

  /** 当前是否判定为离线 */
  var offline = true;

  /** 状态变化订阅者 */
  var statusListeners = [];

  /**
   * 统一的 API 错误。
   * @param {string} message 面向用户的中文提示
   * @param {{errorCode?: string, status?: number, detail?: string}} [meta]
   */
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

  function notifyStatus(isOnline, base) {
    // 注意：offline 表示"上一步的离線状态"，状态没变化时不必通知订阅者。
    // 这里必须写成 offline === !isOnline，否则首次"上线"会被误判为"无变化"而丢掉。
    if (offline === !isOnline) {
      return;
    }
    offline = !isOnline;
    statusListeners.forEach(function (listener) {
      try {
        listener({ online: isOnline, base: base === null || base === undefined ? '' : base });
      } catch (error) {
        console.error('[api] 状态监听器异常', error);
      }
    });
  }

  /** 带超时的 fetch 封装 */
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

  /**
   * 探测某个基地址上是否有健康的后端。
   * @param {string} base
   * @returns {Promise<string|null>}
   */
  function probe(base) {
    return fetchWithTimeout(base + '/api/health', { method: 'GET' }, config.HEALTH_TIMEOUT_MS)
      .then(function (response) {
        if (!response.ok) {
          return null;
        }
        return response.json().then(function (body) {
          return body && body.status === 'ok' ? base : null;
        });
      })
      .catch(function () {
        return null;
      });
  }

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
    if (activeBase !== null && !force) {
      return Promise.resolve(activeBase);
    }

    var candidates = [];
    if (config.API_BASE_URL) {
      candidates.push(config.API_BASE_URL);
    }

    // 判断页面是不是"从本机打开的"：只有这种情况才允许把 127.0.0.1 / localhost 当候选。
    // 页面部署在公网时，这两个地址指向的是**访问者自己的电脑**——
    // 既会造成"探不通就判离线"的误报，也可能让前端连到访问者机器上恰好占着 8000 端口的
    // 其它服务上去。这是实测公网部署时发现的坑（见 blog 坑 14）。
    var hostname = global.location ? global.location.hostname : '';
    var pageProtocol = global.location ? global.location.protocol : '';
    var isLocalPage =
      pageProtocol === 'file:' ||
      hostname === '' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1';

    config.API_CANDIDATES.forEach(function (item) {
      if (candidates.indexOf(item) !== -1) {
        return;
      }
      var isLoopback = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(item);
      if (isLoopback && !isLocalPage) {
        return; // 公网页面不尝试访问者本机
      }
      candidates.push(item);
    });

    // 顺序探测：本地/同源通常排在前面，命中即结束
    return candidates.reduce(function (chain, base) {
      return chain.then(function (found) {
        if (found !== null) {
          return found;
        }
        return probe(base);
      });
    }, Promise.resolve(null)).then(function (found) {
      if (found === null) {
        activeBase = null;
        notifyStatus(false, null);
        return null;
      }
      activeBase = found;
      notifyStatus(true, found);
      return found;
    });
  }

  /**
   * 发起一次 API 请求并解析统一响应体。
   * @param {string} path 以 /api 开头的路径
   * @param {{method?: string, body?: object, timeout?: number}} [options]
   * @returns {Promise<object>}
   */
  function request(path, options) {
    var opts = options || {};
    var method = opts.method || 'GET';

    return resolveBase().then(function (base) {
      if (base === null) {
        throw new ApiError('无法连接后端服务，请确认后端已启动（计算必须由后端完成）', {
          errorCode: 'NETWORK_ERROR'
        });
      }

      var init = { method: method };
      if (opts.body !== undefined) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(opts.body);
      }

      return fetchWithTimeout(base + path, init, opts.timeout || config.REQUEST_TIMEOUT_MS)
        .catch(function () {
          // 网络层失败：可能是后端没启动、端口不通、或跨域被拒
          activeBase = null;
          notifyStatus(false, base);
          throw new ApiError('无法连接后端服务，请确认后端已启动（计算必须由后端完成）', {
            errorCode: 'NETWORK_ERROR'
          });
        })
        .then(function (response) {
          notifyStatus(true, base);
          return response.text().then(function (text) {
            var payload = null;
            if (text) {
              try {
                payload = JSON.parse(text);
              } catch (error) {
                payload = null;
              }
            }

            if (!response.ok || (payload && payload.success === false)) {
              throw new ApiError(
                (payload && payload.message) || '请求失败（HTTP ' + response.status + '）',
                {
                  errorCode: (payload && payload.error_code) || 'HTTP_' + response.status,
                  status: response.status,
                  detail: payload && payload.detail
                }
              );
            }
            return payload === null ? {} : payload;
          });
        });
    });
  }

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

  var Api = {
    ApiError: ApiError,

    /** 当前生效的基地址（未探测时为 ''） */
    base: function () {
      return activeBase === null ? '' : activeBase;
    },

    /** 当前是否在线 */
    isOnline: function () {
      return !offline;
    },

    resolveBase: resolveBase,

    /** 订阅在线/离线状态变化 */
    onStatusChange: function (listener) {
      statusListeners.push(listener);
      return function () {
        statusListeners = statusListeners.filter(function (item) {
          return item !== listener;
        });
      };
    },

    /** 健康检查 */
    health: function () {
      return request('/api/health', { timeout: config.HEALTH_TIMEOUT_MS });
    },

    /**
     * 计算表达式（核心接口）。
     * @param {string} expression 用户输入的表达式
     * @param {boolean} [saveHistory]
     */
    calculate: function (expression, saveHistory) {
      return request('/api/calculate', {
        method: 'POST',
        body: { expression: expression, save_history: saveHistory !== false }
      });
    },

    /** 只做语法分析，返回 Token 与语法树 */
    parse: function (expression) {
      return request('/api/parse', { method: 'POST', body: { expression: expression } });
    },

    /** 分页查询历史 */
    listHistory: function (params) {
      return request(withQuery('/api/history', params));
    },

    /** 删除指定历史记录 */
    deleteHistory: function (id) {
      return request('/api/history/' + encodeURIComponent(id), { method: 'DELETE' });
    },

    /** 清空历史记录 */
    clearHistory: function (favoriteOnly) {
      return request(withQuery('/api/history', { favorite_only: favoriteOnly ? true : undefined }), {
        method: 'DELETE'
      });
    },

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

    /** 统计信息 */
    stats: function () {
      return request('/api/history/stats');
    },

    /** 进制转换 */
    convertBase: function (value, fromBase, toBase) {
      return request('/api/convert/base', {
        method: 'POST',
        body: { value: String(value), from_base: Number(fromBase), to_base: Number(toBase) }
      });
    },

    /** 单位换算 */
    convertUnit: function (value, category, fromUnit, toUnit) {
      return request('/api/convert/unit', {
        method: 'POST',
        body: {
          value: Number(value),
          category: category,
          from_unit: fromUnit,
          to_unit: toUnit
        }
      });
    },

    /** 函数 / 常量 / 单位清单 */
    meta: function () {
      return request('/api/meta/functions');
    },

    /** 后端 Swagger 文档地址 */
    docsUrl: function () {
      var base = activeBase === null ? config.API_BASE_URL || '' : activeBase;
      return base + '/docs';
    }
  };

  global.Api = Api;
})(window);
