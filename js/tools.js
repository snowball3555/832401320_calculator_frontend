/**
 * 扩展功能模块：进制转换、单位换算、语法分析、函数速查。
 *
 * 这里的所有换算与解析同样**全部调用后端接口**：
 * * 进制转换 → `POST /api/convert/base`
 * * 单位换算 → `POST /api/convert/unit`
 * * 语法分析 → `POST /api/parse`
 * * 函数/常量/单位清单 → `GET /api/meta/functions`（前端不维护第二份清单）
 *
 * @module Tools
 */
(function (global) {
  'use strict';

  var UI = global.UI;
  var Api = global.Api;

  var metaCache = null;

  function option(value, label) {
    var element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
  }

  function fillSelect(select, entries, selected) {
    select.innerHTML = '';
    entries.forEach(function (entry) {
      select.appendChild(option(entry.value, entry.label));
    });
    if (selected !== undefined) {
      select.value = String(selected);
    }
  }

  // ------------------------------------------------------------------ 进制
  function fillBaseSelects(bases) {
    var entries = bases.map(function (base) {
      return { value: base, label: base + ' 进制' };
    });
    fillSelect(UI.$('#base-from'), entries, 10);
    fillSelect(UI.$('#base-to'), entries, 2);
  }

  function convertBase() {
    var value = UI.$('#base-value').value.trim();
    if (!value) {
      UI.$('#base-result').textContent = '请输入待转换的数值';
      return;
    }
    Api.convertBase(value, UI.$('#base-from').value, UI.$('#base-to').value)
      .then(function (data) {
        UI.$('#base-result').textContent = data.value + ' (' + data.from_base + '进制) = ' + data.result +
          ' (' + data.to_base + '进制)';
        UI.$('#base-note').textContent = '十进制等值：' + data.decimal_value + ' · ' + data.note;
      })
      .catch(function (error) {
        UI.$('#base-result').textContent = '转换失败';
        UI.$('#base-note').textContent = error.message;
      });
  }

  // ------------------------------------------------------------------ 单位
  function fillUnitCategories(categories) {
    var select = UI.$('#unit-category');
    fillSelect(
      select,
      categories.map(function (category) {
        return { value: category.key, label: category.name };
      }),
      categories[0] ? categories[0].key : ''
    );
    refreshUnits();
  }

  function currentCategory() {
    var key = UI.$('#unit-category').value;
    if (!metaCache) {
      return null;
    }
    return metaCache.unit_categories.filter(function (category) {
      return category.key === key;
    })[0];
  }

  function refreshUnits() {
    var category = currentCategory();
    if (!category) {
      return;
    }
    var entries = category.units.map(function (unit) {
      return { value: unit.code, label: unit.name + ' (' + unit.code + ')' };
    });

    // 默认值策略：优先用该类别在后端的基准单位作为"从"，再挑一个不同单位作为"到"；
    // 温度是仿射变换，单独指定 摄氏度 → 华氏度。
    var defaults;
    if (category.key === 'temperature') {
      defaults = ['degC', 'degF'];
    } else {
      var codes = category.units.map(function (unit) {
        return unit.code;
      });
      var from = codes.indexOf(category.base_unit) >= 0 ? category.base_unit : codes[0];
      var to = codes.filter(function (code) {
        return code !== from;
      })[0];
      defaults = [from, to];
    }

    fillSelect(UI.$('#unit-from'), entries, defaults[0]);
    fillSelect(UI.$('#unit-to'), entries, defaults[1]);
  }

  function convertUnit() {
    var value = UI.$('#unit-value').value;
    if (value === '') {
      UI.$('#unit-result').textContent = '请输入待换算的数值';
      return;
    }
    Api.convertUnit(value, UI.$('#unit-category').value, UI.$('#unit-from').value, UI.$('#unit-to').value)
      .then(function (data) {
        UI.$('#unit-result').textContent =
          data.value + ' ' + data.from_name + ' = ' + data.result_display + ' ' + data.to_name;
        UI.$('#unit-formula').textContent = '换算过程：' + data.formula;
      })
      .catch(function (error) {
        UI.$('#unit-result').textContent = '换算失败';
        UI.$('#unit-formula').textContent = error.message;
      });
  }

  // -------------------------------------------------------------- 语法分析
  function parseExpression() {
    var expression = UI.$('#parse-input').value.trim();
    if (!expression) {
      UI.$('#parse-output').textContent = '请输入表达式';
      return;
    }
    UI.$('#parse-summary').textContent = '正在请求后端解析…';
    Api.parse(expression)
      .then(function (data) {
        UI.$('#parse-summary').textContent =
          '后端还原：' + data.infix + ' · 节点数 ' + data.node_count + ' · 树深度 ' + data.max_depth +
          ' · Token 数 ' + data.tokens.length;
        UI.$('#parse-output').textContent = JSON.stringify({ tokens: data.tokens, tree: data.tree }, null, 2);
      })
      .catch(function (error) {
        UI.$('#parse-summary').textContent = '解析失败：' + error.message;
        UI.$('#parse-output').textContent = '';
      });
  }

  // -------------------------------------------------------------- 函数速查
  function renderFunctions(functions, constants) {
    var html = constants
      .map(function (constant) {
        return (
          '<div class="function-card">' +
          '<p class="function-card__name">' + UI.escapeHtml(constant.name) + '</p>' +
          '<p class="function-card__desc">' + UI.escapeHtml(constant.description) + '</p>' +
          '<p class="function-card__example">≈ ' + Number(constant.value).toFixed(8) + '</p>' +
          '</div>'
        );
      })
      .concat(
        functions.map(function (item) {
          return (
            '<div class="function-card">' +
            '<p class="function-card__name">' + UI.escapeHtml(item.name) + '()</p>' +
            '<p class="function-card__desc">' + UI.escapeHtml(item.description) +
            ' · ' + UI.escapeHtml(item.arity) + '</p>' +
            '<p class="function-card__example">' + UI.escapeHtml(item.example) + '</p>' +
            '</div>'
          );
        })
      )
      .join('');
    UI.$('#function-reference').innerHTML = html;
  }

  function loadMeta() {
    return Api.meta()
      .then(function (data) {
        metaCache = data;
        fillBaseSelects(data.supported_bases);
        fillUnitCategories(data.unit_categories);
        renderFunctions(data.functions, data.constants);
      })
      .catch(function (error) {
        UI.$('#function-reference').innerHTML =
          '<p class="empty-state">无法从后端获取函数清单：' + UI.escapeHtml(error.message) + '</p>';
      });
  }

  // ------------------------------------------------------------------ 初始化
  function switchTool(name) {
    UI.$$('[data-tool]').forEach(function (tab) {
      var active = tab.getAttribute('data-tool') === name;
      tab.classList.toggle('tab--active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    UI.$$('[data-tool-panel]').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-tool-panel') !== name;
    });
  }

  function init() {
    UI.$$('[data-tool]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchTool(tab.getAttribute('data-tool'));
      });
    });

    UI.$('#btn-base-convert').addEventListener('click', convertBase);
    UI.$('#btn-unit-convert').addEventListener('click', convertUnit);
    UI.$('#btn-parse').addEventListener('click', parseExpression);
    UI.$('#unit-category').addEventListener('change', refreshUnits);
    UI.$('#base-value').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        convertBase();
      }
    });
    UI.$('#parse-input').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        parseExpression();
      }
    });

    return loadMeta().then(function () {
      convertBase();
      convertUnit();
      parseExpression();
    });
  }

  global.Tools = { init: init, loadMeta: loadMeta };
})(window);
