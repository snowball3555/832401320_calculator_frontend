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

  /** 查询多个元素（返回真数组，方便 forEach / map） */
  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  /**
   * 转义 HTML 特殊字符。
   * 历史记录里的表达式来自用户输入，直接拼进 innerHTML 会有 XSS 风险
   * （例如输入 <img src=x onerror=...>），因此渲染前必须转义。
   * @param {*} value
   * @returns {string}
   */
  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var toastTimer = null;

  /** 底部轻提示 */
  function toast(message) {
    var node = $('#toast');
    if (!node) {
      return;
    }
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.hidden = true;
    }, 2200);
  }

  /**
   * 显示消息条。
   * @param {string} text 文本
   * @param {'error'|'success'|'info'} [type]
   * @param {string} [code] 后端错误码，展示出来便于对照接口文档
   */
  function showMessage(text, type, code) {
    var node = $('#message-area');
    if (!node) {
      return;
    }
    node.className = 'message message--' + (type || 'info');
    node.innerHTML = escapeHtml(text) + (code ? ' <code>[' + escapeHtml(code) + ']</code>' : '');
    node.hidden = false;
  }

  function hideMessage() {
    var node = $('#message-area');
    if (node) {
      node.hidden = true;
    }
  }

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

  global.UI = {
    $: $,
    $$: $$,
    escapeHtml: escapeHtml,
    toast: toast,
    showMessage: showMessage,
    hideMessage: hideMessage,
    debounce: debounce
  };
})(window);
