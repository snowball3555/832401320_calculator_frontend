/**
 * 计算器交互模块。
 *
 * ⚠️ 重要边界：**本模块不做任何数值计算。**
 * 它只负责：把用户点击/键盘输入拼成表达式字符串 → 调用后端 → 渲染后端返回的结果。
 * 甚至 `=` 按钮的逻辑也只是"发请求"，没有任何四则运算代码。
 * 这样才满足作业要求：停掉后端后，前端无法独立得到新结果。
 *
 * 唯一的字符串处理是**显示符号到传输符号的映射**（× → *、÷ → /），
 * 这属于展示层格式转换，不产生数值结果。
 *
 * @module Calculator
 */
(function (global) {
  'use strict';

  var UI = global.UI;
  var Api = global.Api;

  var state = { busy: false, mode: 'standard', lastResult: '' };

  function inputNode() {
    return UI.$('#expression-input');
  }

  function getExpression() {
    return inputNode().value;
  }

  function setExpression(value) {
    var node = inputNode();
    node.value = value;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }

  /**
   * 展示符号 → 传输符号。
   * 界面上显示 × ÷ 更符合数学书写习惯，但 API 约定使用 * /，
   * 因此发送前统一转换。注意：这里只是字符替换，不涉及优先级或求值。
   * @param {string} text
   * @returns {string}
   */
  function toApiExpression(text) {
    return text
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/[−–—]/g, '-')
      .replace(/（/g, '(')
      .replace(/）/g, ')');
  }

  function insert(text) {
    var node = inputNode();
    var start = typeof node.selectionStart === 'number' ? node.selectionStart : node.value.length;
    var end = typeof node.selectionEnd === 'number' ? node.selectionEnd : node.value.length;
    node.value = node.value.slice(0, start) + text + node.value.slice(end);
    var caret = start + text.length;
    node.focus();
    node.setSelectionRange(caret, caret);
  }

  function backspace() {
    var node = inputNode();
    var start = typeof node.selectionStart === 'number' ? node.selectionStart : node.value.length;
    var end = typeof node.selectionEnd === 'number' ? node.selectionEnd : node.value.length;
    if (start === end && start > 0) {
      node.value = node.value.slice(0, start - 1) + node.value.slice(end);
      caretTo(node, start - 1);
    } else {
      node.value = node.value.slice(0, start) + node.value.slice(end);
      caretTo(node, start);
    }
    node.focus();
  }

  function caretTo(node, position) {
    node.setSelectionRange(position, position);
  }

  function clearAll() {
    inputNode().value = '';
    renderResult('—');
    renderMeta('等待计算…');
    UI.hideMessage();
    inputNode().focus();
  }

  /** 正负号：对整个表达式取反，行为可预期（避免在复杂表达式里猜测该给谁加负号） */
  function negate() {
    var text = getExpression().trim();
    if (!text) {
      insert('-');
      return;
    }
    if (text.charAt(0) === '-') {
      setExpression(text.slice(1));
    } else if (text.charAt(0) === '(' && text.lastIndexOf(')') === text.length - 1) {
      setExpression('-(' + text.replace(/^\(/, '').replace(/\)$/, '') + ')');
    } else {
      setExpression('-(' + text + ')');
    }
  }

  function renderResult(text) {
    UI.$('#result-value').textContent = text;
  }

  function renderMeta(text) {
    UI.$('#result-meta').textContent = text;
  }

  function setBusy(busy) {
    state.busy = busy;
    var button = UI.$('#btn-equals');
    if (button) {
      button.disabled = busy;
      button.textContent = busy ? '计算中…' : '= 计算';
    }
  }

  /**
   * 核心动作：把表达式交给后端计算。
   * 前端只做"非空校验"这种界面级检查，真正的合法性校验、求值、落库全在后端。
   */
  function calculate() {
    if (state.busy) {
      return Promise.resolve();
    }

    var raw = getExpression().trim();
    if (!raw) {
      UI.showMessage('请先输入要计算的表达式', 'error', 'EMPTY_EXPRESSION');
      inputNode().focus();
      return Promise.resolve();
    }

    setBusy(true);
    UI.hideMessage();
    renderResult('…');
    renderMeta('正在请求后端计算…');

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
  }

  function copyResult() {
    if (!state.lastResult) {
      UI.toast('还没有可复制的结果');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.lastResult).then(function () {
        UI.toast('已复制结果：' + state.lastResult);
      });
    } else {
      UI.toast('当前浏览器不支持自动复制');
    }
  }

  function switchMode(mode) {
    state.mode = mode;
    UI.$$('[data-mode]').forEach(function (tab) {
      var active = tab.getAttribute('data-mode') === mode;
      tab.classList.toggle('tab--active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    var sci = UI.$('#sci-keypad');
    if (sci) {
      sci.hidden = mode !== 'scientific';
    }
  }

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

  /** 全局快捷键：焦点在输入框内时仍可用 Enter / Esc，其余按键交给输入框自身 */
  function handleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      calculate();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      clearAll();
      return;
    }

    var tag = (event.target.tagName || '').toLowerCase();
    var inField = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (inField || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      backspace();
      return;
    }
    if ('0123456789+-*/()^!%.'.indexOf(event.key) >= 0 && event.key.length === 1) {
      event.preventDefault();
      insert(event.key);
    }
  }

  function init() {
    UI.$('#keypad').addEventListener('click', handleKeypadClick);
    UI.$('#sci-keypad').addEventListener('click', handleKeypadClick);
    UI.$('#btn-copy-result').addEventListener('click', copyResult);
    document.addEventListener('keydown', handleKeydown);
    UI.$$('[data-mode]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchMode(tab.getAttribute('data-mode'));
      });
    });
    inputNode().focus();
  }

  global.Calculator = {
    init: init,
    calculate: calculate,
    insert: insert,
    getExpression: getExpression,
    setExpression: setExpression,
    toApiExpression: toApiExpression,
    switchMode: switchMode
  };
})(window);
