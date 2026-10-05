/**
 * 历史记录模块：展示、搜索、分页、删除、收藏、统计。
 *
 * 数据来源**只有后端数据库**：任何操作（包括删除）完成后都重新调用
 * `GET /api/history` 拉取最新数据，本地不缓存、不用 localStorage。
 * 这样刷新页面、换浏览器、重启电脑后看到的历史完全一致。
 *
 * @module History
 */
(function (global) {
  'use strict';

  var UI = global.UI;
  var Api = global.Api;
  var config = global.CALC_CONFIG;

  var state = {
    page: 1,
    pageSize: config.PAGE_SIZE,
    keyword: '',
    favoriteOnly: false,
    total: 0,
    pages: 1,
    items: []
  };

  function renderLoading() {
    UI.$('#history-list').innerHTML = '<p class="empty-state">正在从后端加载历史记录…</p>';
  }

  function renderEmpty(message) {
    UI.$('#history-list').innerHTML = '<p class="empty-state">' + UI.escapeHtml(message) + '</p>';
  }

  function renderItems(items) {
    if (!items.length) {
      renderEmpty('暂无历史记录，先算一道题吧 ~');
      return;
    }

    var html = items
      .map(function (item) {
        return (
          '<article class="history-item" data-id="' + item.id + '">' +
          '<div class="history-item__body">' +
          '<p class="history-item__expression" title="点击填入表达式">' + UI.escapeHtml(item.expression) + '</p>' +
          '<p class="history-item__result">= ' + UI.escapeHtml(item.result) + '</p>' +
          '<p class="history-item__meta"><span>#' + item.id + '</span><span>' +
          UI.escapeHtml(item.created_at) + '</span></p>' +
          '</div>' +
          '<div class="history-item__actions">' +
          '<button type="button" class="icon-action' + (item.is_favorite ? ' icon-action--active' : '') +
          '" data-action="favorite" data-id="' + item.id + '" title="' + (item.is_favorite ? '取消收藏' : '收藏') + '">' +
          (item.is_favorite ? '★' : '☆') + '</button>' +
          '<button type="button" class="icon-action" data-id="' + item.id +
          '" data-action="use" title="填入计算器">↩</button>' +
          '<button type="button" class="icon-action" data-id="' + item.id +
          '" data-action="delete" title="删除这条记录">🗑</button>' +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    UI.$('#history-list').innerHTML = html;
  }

  function renderPagination() {
    UI.$('#history-total').textContent = state.total;
    UI.$('#history-page-info').textContent = '第 ' + state.page + ' / ' + state.pages + ' 页 · 共 ' + state.total + ' 条';
    UI.$('#history-prev').disabled = state.page <= 1;
    UI.$('#history-next').disabled = state.page >= state.pages;
  }

  /** 从后端拉取当前页数据 */
  function load() {
    renderLoading();
    return Api.listHistory({
      page: state.page,
      page_size: state.pageSize,
      keyword: state.keyword,
      favorite_only: state.favoriteOnly
    })
      .then(function (data) {
        state.total = data.total;
        state.pages = data.pages;
        state.items = data.items;

        // 删除完当前页最后一条时，页码可能越界，自动回退一页
        if (!data.items.length && state.page > 1) {
          state.page = Math.max(1, state.page - 1);
          return load();
        }

        renderItems(data.items);
        renderPagination();
      })
      .catch(function (error) {
        state.total = 0;
        state.pages = 1;
        renderEmpty('无法加载历史记录：' + error.message);
        renderPagination();
      });
  }

  /** 加载统计数据（扩展功能） */
  function loadStats() {
    return Api.stats()
      .then(function (data) {
        UI.$('#stat-total').textContent = data.total;
        UI.$('#stat-today').textContent = data.today;
        UI.$('#stat-fav').textContent = data.favorites;
        UI.$('#stat-top-op').textContent = data.most_used_operator || '—';
        UI.$('#stat-last').textContent = data.last_calculated_at || '—';
      })
      .catch(function () {
        UI.$('#stat-last').textContent = '后端离线';
      });
  }

  function reload() {
    return Promise.all([load(), loadStats()]);
  }

  function handleListClick(event) {
    var button = event.target.closest('button');
    var card = event.target.closest('.history-item');
    if (!card) {
      return;
    }
    var id = Number(card.getAttribute('data-id'));

    if (!button) {
      // 点击卡片主体：把表达式填回计算器，方便继续编辑
      var item = state.items.filter(function (entry) {
        return entry.id === id;
      })[0];
      if (item && global.Calculator) {
        global.Calculator.setExpression(item.expression);
        UI.toast('已填入表达式：' + item.expression);
      }
      return;
    }

    var action = button.getAttribute('data-action');

    if (action === 'favorite') {
      Api.toggleFavorite(id)
        .then(function () {
          return reload();
        })
        .catch(function (error) {
          UI.showMessage(error.message, 'error', error.errorCode);
        });
      return;
    }

    if (action === 'delete') {
      if (!global.confirm('确定删除这条历史记录吗？（将从后端数据库中真正删除）')) {
        return;
      }
      Api.deleteHistory(id)
        .then(function (data) {
          UI.toast(data.message);
          return reload();
        })
        .catch(function (error) {
          UI.showMessage(error.message, 'error', error.errorCode);
        });
      return;
    }

    if (action === 'use') {
      var target = state.items.filter(function (entry) {
        return entry.id === id;
      })[0];
      if (target && global.Calculator) {
        global.Calculator.setExpression(target.expression);
      }
    }
  }

  function init() {
    UI.$('#history-list').addEventListener('click', handleListClick);

    UI.$('#history-search').addEventListener(
      'input',
      UI.debounce(function (event) {
        state.keyword = event.target.value.trim();
        state.page = 1;
        load();
      }, config.SEARCH_DEBOUNCE_MS)
    );

    UI.$('#history-fav-only').addEventListener('change', function (event) {
      state.favoriteOnly = event.target.checked;
      state.page = 1;
      load();
    });

    UI.$('#history-prev').addEventListener('click', function () {
      if (state.page > 1) {
        state.page -= 1;
        load();
      }
    });

    UI.$('#history-next').addEventListener('click', function () {
      if (state.page < state.pages) {
        state.page += 1;
        load();
      }
    });

    UI.$('#btn-refresh-history').addEventListener('click', function () {
      reload();
      UI.toast('已从后端重新加载');
    });

    UI.$('#btn-clear-history').addEventListener('click', function () {
      if (!global.confirm('确定清空后端数据库中的全部历史记录吗？该操作不可撤销。')) {
        return;
      }
      Api.clearHistory(false)
        .then(function (data) {
          UI.toast(data.message);
          state.page = 1;
          return reload();
        })
        .catch(function (error) {
          UI.showMessage(error.message, 'error', error.errorCode);
        });
    });

    return reload();
  }

  global.History = { init: init, load: load, loadStats: loadStats, reload: reload };
})(window);
