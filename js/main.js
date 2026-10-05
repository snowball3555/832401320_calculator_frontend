/**
 * 启动模块：负责把各模块装配起来，并维护「后端在线 / 离线」状态。
 *
 * 在线状态是本次作业一个关键的可见证据：
 * 停掉后端进程后，状态徽标变红、离线横幅出现，此时点击 `=` 只会得到
 * "无法连接后端服务"，前端**拿不到任何新结果** —— 说明计算确实在后端。
 *
 * @module Main
 */
(function (global) {
  'use strict';

  var UI = global.UI;
  var Api = global.Api;
  var config = global.CALC_CONFIG;

  var pollTimer = null;

  function updateStatus(status) {
    var online = Boolean(status && status.online);
    var base = (status && status.base) || '';

    var chip = UI.$('#backend-status');
    if (chip) {
      chip.querySelector('.chip__dot').setAttribute('data-state', online ? 'online' : 'offline');
      chip.querySelector('.chip__text').textContent = online
        ? '后端在线 · ' + (base || '同源')
        : '后端离线（点此重试）';
    }

    var banner = UI.$('#offline-banner');
    if (banner) {
      banner.hidden = online;
    }
    var hint = UI.$('#offline-hint');
    if (hint) {
      hint.textContent = config.API_BASE_URL || config.API_CANDIDATES[1] || '同源地址';
    }

    var footer = UI.$('#footer-api');
    if (footer) {
      footer.textContent = 'API 基地址：' + (online ? base || '与页面同源' : '未连接');
    }
  }

  function checkBackend(force) {
    return Api.resolveBase(force !== false).then(function (base) {
      // 判断在线与否必须用 Api.isOnline()，不能用 Boolean(base)：
      // 同源部署时 base 是空字符串，那是"在线"而不是"离线"。
      updateStatus({ online: Api.isOnline(), base: Api.base() });
      return base;
    });
  }

  function init() {
    global.Theme.init();
    global.Calculator.init();
    global.Tools.init();
    global.History.init();

    Api.onStatusChange(updateStatus);

    UI.$('#backend-status').addEventListener('click', function () {
      UI.toast('正在重新检测后端…');
      checkBackend(true).then(function () {
        if (Api.isOnline()) {
          global.History.reload();
          global.Tools.loadMeta();
          UI.toast('后端已连接');
        } else {
          UI.toast('仍然无法连接后端');
        }
      });
    });

    UI.$('#open-api-docs').addEventListener('click', function () {
      global.open(Api.docsUrl(), '_blank');
    });

    checkBackend(true);
    pollTimer = global.setInterval(function () {
      // 必须强制重新探测：只读缓存的话，后端进程已经退出也会一直显示"在线"
      checkBackend(true);
    }, config.HEALTH_POLL_MS);
  }

  global.Main = { init: init, updateStatus: updateStatus, checkBackend: checkBackend, pollTimer: pollTimer };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
