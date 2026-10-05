/**
 * 主题切换（扩展功能）。
 *
 * 用 localStorage 记住用户选择，刷新页面后保持；默认深色主题。
 *
 * @module Theme
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'calculator-theme';
  var THEMES = { dark: '🌙 深色', light: '☀️ 浅色' };

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var icon = global.UI.$('#theme-icon');
    var label = global.UI.$('#theme-label');
    var text = THEMES[theme] || THEMES.dark;
    if (icon) {
      icon.textContent = text.split(' ')[0];
    }
    if (label) {
      label.textContent = theme === 'dark' ? '深色' : '浅色';
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* 隐私模式下 localStorage 可能不可用，忽略即可 */
    }
  }

  function current() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch (error) {
      return 'dark';
    }
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark');
  }

  function init() {
    apply(current());
    var button = global.UI.$('#theme-toggle');
    if (button) {
      button.addEventListener('click', toggle);
    }
  }

  global.Theme = { init: init, apply: apply, toggle: toggle, current: current };
})(window);
