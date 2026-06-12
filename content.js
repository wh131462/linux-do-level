// ==UserScript==
// @name         linux.do 等级查询
// @namespace    https://linux.do/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=linux.do
// @version      1.3.2
// @description  linux.do 等级查询（原版 by ccc9527-c，MIT 修改 by EternalHeart）
// @author       ccc9527-c
// @author       EternalHeart
// @match        https://linux.do/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      connect.linux.do
// @license      MIT
// @homepageURL  https://github.com/wh131462/linux-do-level
// @supportURL   https://github.com/wh131462/linux-do-level/issues
// @downloadURL  https://update.greasyfork.org/scripts/582294/linux.do%20%E7%AD%89%E7%BA%A7%E6%9F%A5%E8%AF%A2%20-%20%E5%A2%9E%E5%BC%BA%E7%89%88.user.js
// @updateURL    https://update.greasyfork.org/scripts/582294/linux.do%20%E7%AD%89%E7%BA%A7%E6%9F%A5%E8%AF%A2%20-%20%E5%A2%9E%E5%BC%BA%E7%89%88.meta.js
// ==/UserScript==

(function () {
    "use strict";

    // === 等级升级要求（硬编码，参考等级小助手） ===
    const LEVEL_REQUIREMENTS = {
        0: {
            // 0级升1级
            topics_entered: { name: "浏览话题", target: 5 },
            posts_read_count: { name: "浏览帖子", target: 30 },
            time_read: { name: "阅读时间", target: 600, unit: "seconds" },
        },
        1: {
            // 1级升2级
            days_visited: { name: "访问天数", target: 15 },
            likes_given: { name: "点赞", target: 1 },
            likes_received: { name: "获赞", target: 1 },
            post_count: { name: "回复不同的话题", target: 3, unit: "topics" },
            topics_entered: { name: "浏览话题", target: 20 },
            posts_read_count: { name: "浏览帖子", target: 100 },
            time_read: { name: "阅读时间", target: 3600, unit: "seconds" },
        },
    };

    // === 样式定义 ===
    // 设计基调：编辑式克制 + 终端血统。无渐变、无毛玻璃、发丝边、锐角、等宽数字。
    GM_addStyle(`
    :root {
      --ld-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --ld-ok: #15803d;
      --ld-bad: #b91c1c;
      --ld-ok-soft: rgba(21, 128, 61, 0.08);
      --ld-bad-soft: rgba(185, 28, 28, 0.08);
    }

    /* 遮罩层：去毛玻璃，仅暗化 */
    .ld-level-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 15, 15, 0.34);
      z-index: 10099;
      opacity: 0;
      transition: opacity 0.18s ease;
    }
    .ld-level-overlay.show { opacity: 1; }

    /* 弹窗：锐角、发丝边、克制阴影 */
    .ld-level-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -48%);
      width: 460px;
      max-width: 92vw;
      max-height: 88vh;
      background: var(--secondary, #ffffff);
      border-radius: 3px;
      border: 1px solid var(--primary-low, rgba(0,0,0,0.1));
      box-shadow: 0 22px 48px -14px rgba(15, 23, 42, 0.22);
      z-index: 10100;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.22s ease;
    }
    .ld-level-modal.show {
      opacity: 1;
      transform: translate(-50%, -50%);
    }

    /* 头部：取消彩色图标盒，改为纯文字标题 + 等宽副标题 */
    .ld-level-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding: 18px 22px 14px;
      border-bottom: 1px solid var(--primary-low, rgba(0,0,0,0.08));
    }
    .ld-level-title {
      display: flex;
      align-items: baseline;
      gap: 10px;
      min-width: 0;
      flex-wrap: wrap;
    }
    .ld-level-title-main {
      font-size: 14px;
      font-weight: 600;
      color: var(--primary, #171717);
      letter-spacing: -0.2px;
    }
    .ld-level-title-sub {
      font-family: var(--ld-mono);
      font-size: 11px;
      color: var(--primary-medium, #737373);
      font-weight: 500;
      display: none;
      letter-spacing: 0;
    }
    .ld-level-title-sub.show { display: inline; }
    .ld-level-title-sub::before {
      content: "/ ";
      opacity: 0.45;
    }
    .ld-level-close {
      width: 26px;
      height: 26px;
      border-radius: 2px;
      background: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-medium, #737373);
      transition: background 0.14s, color 0.14s;
      flex-shrink: 0;
      font-family: var(--ld-mono);
      font-size: 16px;
      font-weight: 400;
      line-height: 1;
      align-self: center;
    }
    .ld-level-close:hover {
      background: var(--primary-low, rgba(0,0,0,0.06));
      color: var(--primary, #171717);
    }

    /* 内容区 */
    .ld-level-body {
      padding: 18px 22px 22px;
      overflow-y: auto;
      flex: 1;
    }
    .ld-level-body::-webkit-scrollbar { width: 5px; }
    .ld-level-body::-webkit-scrollbar-thumb {
      background: var(--primary-low, rgba(0,0,0,0.16));
      border-radius: 0;
    }

    /* 区块标题：去图标盒，改为小型大写 + 发丝下划线 */
    .ld-level-sec-title {
      font-size: 10px;
      font-weight: 600;
      color: var(--primary-medium, #525252);
      margin: 22px 0 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      text-transform: uppercase;
      letter-spacing: 1.4px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--primary-low, rgba(0,0,0,0.08));
    }
    .ld-level-sec-title:first-child { margin-top: 0; }
    .ld-level-sec-title .source-tag {
      margin-left: auto;
      font-family: var(--ld-mono);
      font-size: 9px;
      font-weight: 500;
      color: var(--primary-medium, #a3a3a3);
      letter-spacing: 0.6px;
      text-transform: lowercase;
    }
    .ld-level-sec-title .source-tag::before { content: "["; }
    .ld-level-sec-title .source-tag::after { content: "]"; }

    /* 进度项：扁平、发丝条 */
    .ld-level-item {
      margin-bottom: 14px;
      padding: 0;
      background: transparent;
    }
    .ld-level-item:last-child { margin-bottom: 2px; }
    .ld-level-item-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
      gap: 12px;
    }
    .ld-level-item-name {
      font-size: 13px;
      color: var(--primary, #404040);
      font-weight: 500;
    }
    .ld-level-item-value {
      font-family: var(--ld-mono);
      font-size: 12.5px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .ld-level-item-value .target {
      color: var(--primary-medium, #a3a3a3);
      font-weight: 400;
    }
    .ld-level-item-value .target::before { content: " / "; opacity: 0.65; }
    .ld-level-progress {
      height: 2px;
      background: var(--primary-low, rgba(0,0,0,0.08));
      overflow: hidden;
    }
    .ld-level-progress-fill {
      height: 100%;
      transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* 状态横幅：去圆角胶囊，改为左竖线 + 文本标记 */
    .ld-level-status-banner {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 18px;
    }
    .ld-level-status-tag {
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 10px;
      line-height: 1.4;
      border-left: 2px solid;
      background: var(--primary-very-low, rgba(0,0,0,0.025));
    }
    .ld-level-status-tag.met {
      border-left-color: var(--ld-ok);
      color: var(--ld-ok);
    }
    .ld-level-status-tag.unmet {
      border-left-color: var(--ld-bad);
      color: var(--ld-bad);
    }
    .ld-level-status-tag::before {
      font-family: var(--ld-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      opacity: 0.85;
      flex-shrink: 0;
    }
    .ld-level-status-tag.met::before { content: "[OK]"; }
    .ld-level-status-tag.unmet::before { content: "[--]"; }

    /* 环形：变细、stroke 直角端点、等宽数字 */
    .ld-level-rings {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      padding: 4px 0 2px;
    }
    .ld-level-ring {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .ld-level-ring-circle {
      position: relative;
      width: 64px;
      height: 64px;
    }
    .ld-level-ring-circle svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .ld-level-ring-track {
      fill: none;
      stroke: var(--primary-low, rgba(0,0,0,0.1));
      stroke-width: 2.5;
    }
    .ld-level-ring-fill {
      fill: none;
      stroke-width: 2.5;
      stroke-linecap: butt;
      transition: stroke-dashoffset 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ld-level-ring-fill.met { stroke: var(--ld-ok); }
    .ld-level-ring-fill.unmet { stroke: var(--ld-bad); }
    .ld-level-ring-text {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 1.05;
    }
    .ld-level-ring-cur {
      font-family: var(--ld-mono);
      font-size: 15px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.3px;
    }
    .ld-level-ring-cur.met { color: var(--ld-ok); }
    .ld-level-ring-cur.unmet { color: var(--ld-bad); }
    .ld-level-ring-max {
      font-family: var(--ld-mono);
      font-size: 9.5px;
      color: var(--primary-medium, #a3a3a3);
      font-variant-numeric: tabular-nums;
      font-weight: 400;
      margin-top: 2px;
    }
    .ld-level-ring-label {
      font-size: 11px;
      color: var(--primary-medium, #737373);
      font-weight: 500;
      text-align: center;
      letter-spacing: 0.2px;
    }

    /* 合规网格：发丝分割的扁平网格，无图标盒 */
    .ld-level-status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: var(--primary-low, rgba(0,0,0,0.08));
      border: 1px solid var(--primary-low, rgba(0,0,0,0.08));
    }
    .ld-level-status-card {
      padding: 11px 13px;
      background: var(--secondary, #fff);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .ld-level-status-card .status-marker {
      font-family: var(--ld-mono);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.6px;
      margin-bottom: 2px;
    }
    .ld-level-status-card .status-marker.met { color: var(--ld-ok); }
    .ld-level-status-card .status-marker.unmet { color: var(--ld-bad); }
    .ld-level-status-card .status-label {
      font-size: 11px;
      color: var(--primary-medium, #737373);
      font-weight: 500;
    }
    .ld-level-status-card .status-val {
      font-family: var(--ld-mono);
      font-size: 14px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.2px;
    }
    .ld-level-status-card .status-val.met { color: var(--ld-ok); }
    .ld-level-status-card .status-val.unmet { color: var(--ld-bad); }
    .ld-level-status-desc {
      font-size: 10px;
      color: var(--primary-medium, #a3a3a3);
      margin-top: 1px;
    }

    /* 来源页脚：右对齐 + 等宽小字，无光晕 */
    .ld-level-source-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      padding: 12px 0 0;
      margin-top: 20px;
      border-top: 1px solid var(--primary-low, rgba(0,0,0,0.08));
      font-family: var(--ld-mono);
      font-size: 10px;
      color: var(--primary-medium, #a3a3a3);
      letter-spacing: 0.3px;
    }

    /* 加载状态 */
    .ld-level-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 56px 0;
      gap: 14px;
      color: var(--primary-medium, #737373);
      font-family: var(--ld-mono);
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .ld-level-spinner {
      width: 22px;
      height: 22px;
      border: 1.5px solid var(--primary-low, rgba(0,0,0,0.1));
      border-top-color: var(--primary, #404040);
      border-radius: 50%;
      animation: ld-level-spin 0.85s linear infinite;
    }
    @keyframes ld-level-spin { to { transform: rotate(360deg); } }

    /* 错误状态 */
    .ld-level-error {
      text-align: center;
      padding: 40px 16px 32px;
    }
    .ld-level-error-text {
      font-size: 14px;
      font-weight: 600;
      color: var(--primary, #171717);
      margin-bottom: 6px;
    }
    .ld-level-error-tip {
      font-family: var(--ld-mono);
      font-size: 11px;
      color: var(--primary-medium, #737373);
      margin-bottom: 18px;
      line-height: 1.6;
      letter-spacing: 0.2px;
    }
    .ld-level-retry-btn {
      padding: 8px 18px;
      background: var(--primary, #171717);
      color: var(--secondary, #ffffff);
      border: none;
      border-radius: 2px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.14s, transform 0.1s;
      font-family: inherit;
      letter-spacing: 0.3px;
    }
    .ld-level-retry-btn:hover { opacity: 0.85; }
    .ld-level-retry-btn:active { transform: translateY(1px); }

    /* Connect 外链：去渐变，改为描边按钮 */
    .ld-level-connect-link {
      display: inline-block;
      padding: 8px 18px;
      margin: 0 8px 10px 0;
      background: transparent;
      color: var(--primary, #171717) !important;
      border: 1px solid var(--primary, #404040);
      border-radius: 2px;
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
      transition: background 0.14s, color 0.14s;
      letter-spacing: 0.3px;
    }
    .ld-level-connect-link:hover {
      background: var(--primary, #171717);
      color: var(--secondary, #fff) !important;
    }

    /* 头部 LV 按钮文字：等宽 */
    .ld-lv-btn-text {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: var(--ld-mono);
      font-weight: 700;
      font-size: 1em;
      line-height: 1;
      letter-spacing: 0.4px;
      color: rgb(131, 131, 131);
    }
  `);

    // 编辑式设计：去掉所有彩色图标盒，标题/区块/状态以排版与发丝边表达层级。
    // 仅保留极少量纯文字符号用于功能按钮。

    const CACHE_PREFIX = "ld-level-";

    /**
     * 从 GM 存储读取缓存的等级
     * @param {string} username
     * @returns {number|null}
     */
    function getCachedLevel(username) {
        return GM_getValue(CACHE_PREFIX + username, null);
    }

    /**
     * 将等级写入 GM 存储
     * @param {string} username
     * @param {number} level
     */
    function cacheLevel(username, level) {
        GM_setValue(CACHE_PREFIX + username, level);
    }

    /**
     * 同步获取当前用户名
     * @returns {string|null}
     */
    function getUsernameSync() {
        try {
            return unsafeWindow.Discourse?.User?.current?.().username || null;
        } catch (_) {
            return null;
        }
    }

    /**
     * 获取 CSRF Token
     * @returns {string} CSRF Token
     */
    function getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta?.getAttribute("content") || "";
    }

    /**
     * 获取 Discourse 标准请求头
     * @returns {Object} 请求头对象
     */
    function getDiscourseHeaders() {
        return {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRF-Token": getCsrfToken(),
            "discourse-logged-in": "true",
            "discourse-present": "true",
            "discourse-track-view": "true",
        };
    }

    /**
     * 获取当前登录用户的 session 信息
     * @returns {Promise<Object|null>} 用户信息对象
     */
    async function fetchSessionUser() {
        try {
            let username = unsafeWindow.Discourse?.User?.current?.().username;
            if (username) return username;

            const r = await fetch("/latest.json", {
                headers: getDiscourseHeaders(),
            });
            username = r.headers.get("x-discourse-username");
            return username;
        } catch (_) {
            return null;
        }
    }

    /**
     * 获取用户 summary 数据
     * @param {string} username - 用户名
     * @returns {Promise<Object|null>} summary 数据
     */
    async function fetchUserSummary(username) {
        if (!username) return null;
        try {
            const r = await fetch(`/u/${username}/summary.json`, {
                credentials: "include",
                headers: getDiscourseHeaders(),
            });
            if (!r.ok) return null;
            const data = await r.json();
            return data?.user_summary || null;
        } catch (_) {
            return null;
        }
    }

    /**
     * 获取用户基本信息
     * @param {string} username - 用户名
     * @returns {Promise<Object|null>} 用户信息
     */
    async function fetchUserInfo(username) {
        if (!username) return null;
        try {
            const r = await fetch(`/u/${username}.json`, {
                credentials: "include",
                headers: getDiscourseHeaders(),
            });
            if (!r.ok) return null;
            const data = await r.json();
            return data?.user || null;
        } catch (_) {
            return null;
        }
    }

    /**
     * 获取用户自己创建的话题 ID 集合
     * @param {string} username - 用户名
     * @returns {Promise<Set<number>>} 自创话题 ID 集合
     */
    async function fetchOwnTopicIds(username) {
        if (!username) return new Set();
        try {
            const r = await fetch(`/topics/created-by/${username}.json`, {
                credentials: "include",
                headers: getDiscourseHeaders(),
            });
            if (!r.ok) return new Set();
            const data = await r.json();
            const topics = data?.topic_list?.topics;
            if (!Array.isArray(topics)) return new Set();
            return new Set(topics.map((t) => t.id));
        } catch (_) {
            return new Set();
        }
    }

    /**
     * 通过搜索接口获取用户回复过的不同话题数（排除自己发的帖）
     * @param {string} username - 用户名
     * @returns {Promise<number|null>} topics 数量，失败返回 null
     */
    async function fetchPostCountFromSearch(username) {
        if (!username) return null;
        try {
            const [ownIds, searchR] = await Promise.all([
                fetchOwnTopicIds(username),
                fetch(
                    `/search?q=@${encodeURIComponent(username)} order:latest&page=1`,
                    {
                        credentials: "include",
                        headers: getDiscourseHeaders(),
                    },
                ),
            ]);
            if (!searchR.ok) return null;
            const data = await searchR.json();
            if (!Array.isArray(data?.topics)) return null;
            const filtered = data.topics.filter((t) => !ownIds.has(t.id));
            return filtered.length;
        } catch (_) {
            return null;
        }
    }

    /**
     * 格式化阅读时间
     * @param {number} seconds - 秒数
     * @returns {string} 格式化后的时间字符串
     */
    function formatReadTime(seconds) {
        const s = Number(seconds) || 0;
        if (s < 60) return `${s}秒`;
        const minutes = Math.floor(s / 60);
        if (minutes < 60) return `${minutes}分钟`;
        const hours = Math.floor(minutes / 60);
        const remainMins = minutes % 60;
        return remainMins > 0 ? `${hours}小时${remainMins}分` : `${hours}小时`;
    }

    /**
     * 获取0-1级用户的升级进度（使用 summary + 硬编码要求）
     * @param {string} username - 用户名
     * @param {number} currentLevel - 当前等级
     * @returns {Promise<Object>} 等级进度数据
     */
    async function fetchLowLevelTrustData(username, currentLevel) {
        const summary = await fetchUserSummary(username);
        if (!summary) throw new Error("SummaryError");

        const requirements = LEVEL_REQUIREMENTS[currentLevel];
        if (!requirements) throw new Error("NoRequirements");

        // 等级1时，通过搜索接口获取回复不同话题数
        let searchPostCount = null;
        if (currentLevel === 1) {
            searchPostCount = await fetchPostCountFromSearch(username);
        }

        const items = [];
        let allPassed = true;

        for (const [key, req] of Object.entries(requirements)) {
            let current = summary[key] || 0;
            let target = req.target;
            let currentDisplay = String(current);

            // 等级1时，用搜索接口的 topics 数量作为 post_count
            if (
                req.unit === "topics" &&
                key === "post_count" &&
                searchPostCount !== null
            ) {
                current = searchPostCount;
                currentDisplay = searchPostCount >= 3 ? "已满足" : String(current);
            }

            // 处理时间格式
            if (req.unit === "seconds") {
                currentDisplay = formatReadTime(current);
            }

            const isGood = current >= target;
            if (!isGood) allPassed = false;

            let pct =
                target > 0 ? Math.min((current / target) * 100, 100) : isGood ? 100 : 0;

            let targetDisplay =
                req.unit === "seconds" ? formatReadTime(target) : target;

            items.push({
                name: req.name,
                current: currentDisplay,
                target: targetDisplay,
                isGood,
                pct,
            });
        }

        return {
            level: String(currentLevel),
            isPass: allPassed,
            items,
            source: "summary",
        };
    }

    // === UI 相关 ===

    let overlay = null;
    let modal = null;

    /**
     * 创建弹窗 DOM 结构
     */
    function createModal() {
        // 遮罩层
        overlay = document.createElement("div");
        overlay.className = "ld-level-overlay";
        overlay.addEventListener("click", hideModal);

        // 弹窗
        modal = document.createElement("div");
        modal.className = "ld-level-modal";
        modal.innerHTML = `
      <div class="ld-level-header">
        <div class="ld-level-title">
          <span class="ld-level-title-main">等级查询</span>
          <span class="ld-level-title-sub" id="ld-level-subtitle"></span>
        </div>
        <button class="ld-level-close" id="ld-level-close-btn" aria-label="关闭">×</button>
      </div>
      <div class="ld-level-body" id="ld-level-content">
        <div class="ld-level-loading">
          <div class="ld-level-spinner"></div>
          <span>正在查询...</span>
        </div>
      </div>
    `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // 关闭按钮
        modal
            .querySelector("#ld-level-close-btn")
            .addEventListener("click", hideModal);

        // ESC 关闭
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.classList.contains("show")) {
                hideModal();
            }
        });
    }

    /**
     * 显示弹窗
     */
    function showModal() {
        if (!modal) createModal();

        overlay.style.display = "block";
        modal.style.display = "flex";

        // 触发动画
        requestAnimationFrame(() => {
            overlay.classList.add("show");
            modal.classList.add("show");
        });

        // 加载数据
        loadLevelData();
    }

    /**
     * 隐藏弹窗
     */
    function hideModal() {
        if (!modal) return;
        overlay.classList.remove("show");
        modal.classList.remove("show");

        setTimeout(() => {
            overlay.style.display = "none";
            modal.style.display = "none";
        }, 250);
    }

    /**
     * 更新标题栏显示等级和用户名
     * @param {number|string} level - 信任等级
     * @param {string} username - 用户名
     */
    function updateTitleBar(level, username) {
        const sub = modal?.querySelector("#ld-level-subtitle");
        if (!sub) return;
        const parts = [];
        if (level !== null && level !== undefined) parts.push(`Lv.${level}`);
        if (username) parts.push(`@${username}`);
        if (parts.length > 0) {
            sub.textContent = parts.join(" · ");
            sub.classList.add("show");
        }
    }

    /**
     * 渲染进度条项
     * @param {Object} item - 进度项数据
     * @returns {string} HTML 字符串
     */
    function renderProgressItem(item) {
        let valColor = "var(--primary, #1e293b)";
        let fillColor = "rgba(100, 116, 139, 0.2)";
        let pct = Number(item.pct) || 0;

        if (item.isGood === true) {
            valColor = "#16a34a";
            fillColor = "#22c55e";
        } else if (item.isGood === false) {
            valColor = "#dc2626";
            fillColor = "#ef4444";
        } else {
            // null → 中性展示（summary fallback）
            fillColor = "rgba(100, 116, 139, 0.25)";
            pct = 100;
        }

        return `
      <div class="ld-level-item">
        <div class="ld-level-item-top">
          <span class="ld-level-item-name">${item.name}</span>
          <span class="ld-level-item-value" style="color:${valColor}">
            ${item.current}
            <span class="target">/ ${item.target ?? "-"}</span>
          </span>
        </div>
        <div class="ld-level-progress">
          <div class="ld-level-progress-fill" style="width:${pct}%; background:${fillColor}"></div>
        </div>
      </div>
    `;
    }

    /**
     * 渲染等级信息到弹窗
     * @param {Object} data - 等级数据
     * @param {string} username - 用户名
     */
    function renderLevelInfo(data, username) {
        const content = modal.querySelector("#ld-level-content");
        const { level, items, source } = data;

        // 数据来源标签
        const sourceTag = source === "connect" ? "Connect" : "Summary";

        // 升级要求列表
        let listHtml = "";
        if (items && items.length > 0) {
            const sectionLabel =
                Number(level) <= 1
                    ? `升级到 Lv.${Number(level) + 1} 的要求`
                    : source === "connect"
                        ? `Lv.${level} 升级进度`
                        : `当前数据概览`;
            listHtml = `
        <div class="ld-level-sec-title">
          ${sectionLabel}
          <span class="source-tag">${sourceTag}</span>
        </div>
        ${items.map(renderProgressItem).join("")}
      `;
        }

        content.innerHTML = listHtml;

        // 更新标题栏显示等级和用户名
        updateTitleBar(level, username);
    }

    /**
     * 渲染错误状态
     * @param {string} title - 错误标题
     * @param {string} tip - 错误提示
     * @param {boolean} showConnectLink - 是否显示 connect.linux.do 链接
     */
    function renderError(title, tip, showConnectLink = false) {
        const content = modal.querySelector("#ld-level-content");
        const connectLinkHtml = showConnectLink ? `
      <a href="https://connect.linux.do/" target="_blank" class="ld-level-connect-link">
        前往 connect.linux.do
      </a>
    ` : '';
        content.innerHTML = `
      <div class="ld-level-error">
        <div class="ld-level-error-text">${title}</div>
        <div class="ld-level-error-tip">${tip}</div>
        ${connectLinkHtml}
        <button class="ld-level-retry-btn" id="ld-level-retry">重新查询</button>
      </div>
    `;
        content
            .querySelector("#ld-level-retry")
            .addEventListener("click", loadLevelData);
    }

    // === SVG 图标 ===
    // 合规记录已改为纯文本标记 [OK] / [--]，无需 check/cross 图标。

    /**
     * 生成环形进度 SVG
     * @param {number} val - 当前值
     * @param {number} max - 目标值
     * @param {boolean} met - 是否达标
     * @returns {string} SVG HTML
     */
    function buildRingSvg(val, max, met) {
        const r = 33;
        const circumference = 2 * Math.PI * r;
        const pct = max > 0 ? Math.min(val / max, 1) : met ? 1 : 0;
        const offset = circumference * (1 - pct);
        const cls = met ? "met" : "unmet";
        return `
      <svg viewBox="0 0 76 76">
        <circle class="ld-level-ring-track" cx="38" cy="38" r="${r}"/>
        <circle class="ld-level-ring-fill ${cls}" cx="38" cy="38" r="${r}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"/>
      </svg>`;
    }

    /**
     * 格式化数字（加千分位逗号）
     * @param {number} n - 数字
     * @returns {string}
     */
    function fmtNum(n) {
        return Number(n).toLocaleString();
    }

    /**
     * 从 connect.linux.do HTML 中解析结构化数据
     * @param {Document} doc - 解析后的 DOM
     * @returns {Object} 结构化等级数据
     */
    function parseConnectHtml(doc) {
        const data = { rings: [], bars: [], quotas: [], vetos: [] };

        // 解析环形进度（活跃程度）
        doc.querySelectorAll(".tl3-ring").forEach((el) => {
            const circle = el.querySelector(".tl3-ring-circle");
            const label =
                el.querySelector(".tl3-ring-label")?.textContent?.trim() || "";
            const cur =
                el.querySelector(".tl3-ring-current")?.textContent?.trim() || "0";
            const style = circle?.getAttribute("style") || "";
            const valMatch = style.match(/--val:\s*(\d+)/);
            const maxMatch = style.match(/--max:\s*(\d+)/);
            const val = valMatch
                ? parseInt(valMatch[1])
                : parseInt(cur.replace(/,/g, "")) || 0;
            const max = maxMatch ? parseInt(maxMatch[1]) : 0;
            const met = circle?.classList.contains("met") ?? false;
            data.rings.push({ label, val, max, met });
        });

        // 解析进度条（互动参与）
        doc.querySelectorAll(".tl3-bar-item").forEach((el) => {
            const label =
                el.querySelector(".tl3-bar-label")?.textContent?.trim() || "";
            const nums = el.querySelector(".tl3-bar-nums")?.textContent?.trim() || "";
            const fill = el.querySelector(".tl3-bar-fill");
            const style = fill?.getAttribute("style") || "";
            const valMatch = style.match(/--val:\s*(\d+)/);
            const maxMatch = style.match(/--max:\s*(\d+)/);
            const val = valMatch ? parseInt(valMatch[1]) : 0;
            const max = maxMatch ? parseInt(maxMatch[1]) : 0;
            const met = fill?.classList.contains("met") ?? false;
            data.bars.push({ label, nums, val, max, met });
        });

        // 解析配额卡片（合规记录 - 被举报/举报用户）
        doc.querySelectorAll(".tl3-quota-card").forEach((el) => {
            const label =
                el.querySelector(".tl3-quota-label")?.textContent?.trim() || "";
            const nums =
                el.querySelector(".tl3-quota-nums")?.textContent?.trim() || "";
            const met = el.classList.contains("met");
            data.quotas.push({ label, nums, met });
        });

        // 解析否决项（合规记录 - 被禁言/被封禁）
        doc.querySelectorAll(".tl3-veto-item").forEach((el) => {
            const met = el.classList.contains("met");
            // Connect 页面里 veto 项有 front/back 两套 DOM。
            // 达标时展示 front；未达标（例如被封禁次数为 1）时展示 back。
            // 直接 el.querySelector 会拿到隐藏面的第一个值，可能把 1 解析成 0。
            const face =
                el.querySelector(met ? ".tl3-veto-front" : ".tl3-veto-back") || el;
            const label =
                face.querySelector(".tl3-veto-label")?.textContent?.trim() ||
                el.querySelector(".tl3-veto-label")?.textContent?.trim() ||
                "";
            const desc =
                face.querySelector(".tl3-veto-desc")?.textContent?.trim() ||
                el.querySelector(".tl3-veto-desc")?.textContent?.trim() ||
                "";
            const value =
                face.querySelector(".tl3-veto-value")?.textContent?.trim() ||
                el.querySelector(".tl3-veto-value")?.textContent?.trim() ||
                "0";
            data.vetos.push({ label, desc, value, met });
        });

        // 解析状态文本（例如：“还需 XX 天”、“信任等级 3 已达成”）
        const statusTexts = [];
        doc.querySelectorAll(".status-unmet, .status-met").forEach((el) => {
            const text = el.textContent?.trim();
            if (text) {
                statusTexts.push({
                    text,
                    met: el.classList.contains("status-met"),
                });
            }
        });
        data.statusTexts = statusTexts;

        return data;
    }

    /**
     * 渲染解析后的 Connect 数据
     * @param {Object} parsed - 解析后的数据
     * @param {number} trustLevel - 信任等级
     * @param {string} username - 用户名
     */
    function renderParsedConnect(parsed, trustLevel, username) {
        const content = modal.querySelector("#ld-level-content");

        // === 顶部成就/要求状态文本 ===
        let statusBannerHtml = "";
        if (parsed.statusTexts && parsed.statusTexts.length > 0) {
            statusBannerHtml = `
        <div class="ld-level-status-banner">
          ${parsed.statusTexts
                    .map(
                        (s) => `
            <div class="ld-level-status-tag ${s.met ? "met" : "unmet"}">
              ${s.text}
            </div>
          `,
                    )
                    .join("")}
        </div>
      `;
        }

        // === 环形进度区（活跃程度）===
        let ringsHtml = "";
        if (parsed.rings.length > 0) {
            ringsHtml = `
        <div class="ld-level-sec-title">活跃程度</div>
        <div class="ld-level-rings">
          ${parsed.rings
                    .map(
                        (r) => `
            <div class="ld-level-ring">
              <div class="ld-level-ring-circle">
                ${buildRingSvg(r.val, r.max, r.met)}
                <div class="ld-level-ring-text">
                  <span class="ld-level-ring-cur ${r.met ? "met" : "unmet"}">${fmtNum(r.val)}</span>
                  <span class="ld-level-ring-max">/ ${fmtNum(r.max)}</span>
                </div>
              </div>
              <div class="ld-level-ring-label">${r.label}</div>
            </div>
          `,
                    )
                    .join("")}
        </div>`;
        }

        // === 进度条区（互动参与）===
        let barsHtml = "";
        if (parsed.bars.length > 0) {
            barsHtml = `
        <div class="ld-level-sec-title">互动参与</div>
        ${parsed.bars
                    .map((b) => {
                        const pct =
                            b.max > 0
                                ? Math.min((b.val / b.max) * 100, 100)
                                : b.met
                                    ? 100
                                    : 0;
                        const valColor = b.met ? "#16a34a" : "#dc2626";
                        const fillColor = b.met ? "#22c55e" : "#ef4444";
                        return `
            <div class="ld-level-item">
              <div class="ld-level-item-top">
                <span class="ld-level-item-name">${b.label}</span>
                <span class="ld-level-item-value" style="color:${valColor}">
                  ${fmtNum(b.val)}
                  <span class="target">/ ${fmtNum(b.max)}</span>
                </span>
              </div>
              <div class="ld-level-progress">
                <div class="ld-level-progress-fill" style="width:${pct}%; background:${fillColor}"></div>
              </div>
            </div>`;
                    })
                    .join("")}`;
        }

        // === 合规记录区 ===
        let complianceHtml = "";
        const statusItems = [...parsed.quotas, ...parsed.vetos];
        if (statusItems.length > 0) {
            complianceHtml = `
        <div class="ld-level-sec-title">合规记录</div>
        <div class="ld-level-status-grid">
          ${parsed.quotas
                    .map(
                        (q) => `
            <div class="ld-level-status-card">
              <div class="status-marker ${q.met ? "met" : "unmet"}">${q.met ? "[OK]" : "[--]"}</div>
              <div class="status-label">${q.label}</div>
              <div class="status-val ${q.met ? "met" : "unmet"}">${q.nums}</div>
            </div>
          `,
                    )
                    .join("")}
          ${parsed.vetos
                    .map(
                        (v) => `
            <div class="ld-level-status-card">
              <div class="status-marker ${v.met ? "met" : "unmet"}">${v.met ? "[OK]" : "[--]"}</div>
              <div class="status-label">${v.label}</div>
              <div class="status-val ${v.met ? "met" : "unmet"}">${v.value}</div>
              ${v.desc ? `<div class="ld-level-status-desc">${v.desc}</div>` : ""}
            </div>
          `,
                    )
                    .join("")}
        </div>`;
        }

        content.innerHTML = `
      ${statusBannerHtml}
      ${ringsHtml}
      ${barsHtml}
      ${complianceHtml}
      <div class="ld-level-source-footer">
        <span>SOURCE / connect.linux.do</span>
      </div>
    `;

        // 更新标题栏显示等级和用户名
        updateTitleBar(trustLevel, username);
    }

    /**
     * 请求 connect.linux.do 的 HTML，解析数据后自渲染（高等级用户）
     * @param {number} trustLevel - 信任等级
     * @param {string} username - 用户名
     */
    function renderConnectHtml(trustLevel, username) {
        const content = modal.querySelector("#ld-level-content");
        content.innerHTML = `
      <div class="ld-level-loading">
        <div class="ld-level-spinner"></div>
        <span>正在加载 Connect 数据...</span>
      </div>
    `;

        GM_xmlhttpRequest({
            method: "GET",
            url: "https://connect.linux.do",
            withCredentials: true,
            anonymous: false,
            headers: {
                Referer: "https://connect.linux.do/",
                "Cache-Control": "no-cache",
            },
            timeout: 15000,
            onload: (response) => {
                try {
                    if (response.status < 200 || response.status >= 300) {
                        renderError("加载失败", `HTTP ${response.status}，请稍后重试`, true);
                        return;
                    }
                    const doc = new DOMParser().parseFromString(
                        response.responseText,
                        "text/html",
                    );

                    // 解析数据
                    const parsed = parseConnectHtml(doc);

                    // 自渲染
                    renderParsedConnect(parsed, trustLevel, username);
                } catch (e) {
                    console.error("[LD-Level] Connect 解析失败:", e);
                    renderError("解析失败", "Connect 页面内容解析异常" + e.message, true);
                }
            },
            onerror: () => {
                renderError("网络错误", "无法连接到 connect.linux.do，请检查网络", true);
            },
            ontimeout: () => {
                renderError("请求超时", "connect.linux.do 响应超时，请稍后重试", true);
            },
        });
    }

    /**
     * 更新头部按钮文字为 LV.{level}
     * @param {number} level
     */
    function updateButtonText(level) {
        const btn = document.getElementById(LEVEL_HEADER_BTN_ID);
        if (btn) {
            const span = btn.querySelector(".ld-lv-btn-text");
            if (span) span.textContent = `LV.${level}`;
        }
    }

    /**
     * 加载等级数据（核心流程）
     */
    async function loadLevelData() {
        const content = modal.querySelector("#ld-level-content");
        content.innerHTML = `
      <div class="ld-level-loading">
        <div class="ld-level-spinner"></div>
        <span>正在查询等级信息...</span>
      </div>
    `;

        try {
            // 1) 获取用户 session
            const username = await fetchSessionUser();

            // 未登录
            if (!username) {
                renderError("尚未登录社区", "请先登录 linux.do 后再查询等级信息");
                return;
            }

            // 2) 通过 user info 获取等级
            const userInfo = await fetchUserInfo(username);
            const trustLevel = userInfo?.trust_level ?? null;

            if (trustLevel === null) {
                renderError("无法获取等级信息", "请稍后重试或检查网络连接");
                return;
            }

            // 缓存等级 & 更新按钮
            cacheLevel(username, trustLevel);
            updateButtonText(trustLevel);

            // 3) 根据等级策略获取数据
            let data = null;

            if (trustLevel <= 1) {
                // 低等级：直接使用 summary + 硬编码要求
                try {
                    data = await fetchLowLevelTrustData(username, trustLevel);
                } catch (e) {
                    renderError("暂时无法获取数据", "请稍后重试" + e.message);
                    return;
                }
            } else {
                // 高等级：请求 connect.linux.do 的 HTML 直接渲染
                renderConnectHtml(trustLevel, username);
                return;
            }

            // 4) 渲染
            renderLevelInfo(data, username);
        } catch (e) {
            console.error("[LD-Level]", e);
            renderError("查询出错", "请稍后重试" + e.message);
        }
    }

    // === 注册到功能按钮集合 ===

    /**
     * 注册等级查询按钮到功能按钮
     */
    function registerToFuncBtns() {
        if (unsafeWindow.__LD_FUNC_BTNS__) {
            unsafeWindow.__LD_FUNC_BTNS__.register({
                id: "level-checker",
                icon: "LV",
                label: "等级查询",
                title: "查看当前信任等级与升级进度",
                order: 20,
                onClick: () => showModal(),
            });
            // 移除等級查詢按鈕
            const existing = document.getElementById(LEVEL_HEADER_BTN_ID);
            if (existing) existing.remove();
        }
    }

    // === 注入头部菜单按钮 ===

    const LEVEL_HEADER_BTN_ID = "header-button-level-checker";

    /**
     * 向头部菜单栏注入等级查询入口
     */
    function injectHeaderButton() {
        // 如果按钮组存在，则不在此处显示入口
        if (document.querySelector(".ld-func-dropdown")) {
            const existing = document.getElementById(LEVEL_HEADER_BTN_ID);
            if (existing) existing.remove();
            return;
        }

        const headerButtons = document.querySelector(".header-buttons");
        if (!headerButtons || headerButtons.querySelector(`#${LEVEL_HEADER_BTN_ID}`)) return;

        const btn = document.createElement("button");
        btn.className = "btn btn-flat btn-icon no-text header-dropdown-toggle ld-level-header-btn";
        btn.id = LEVEL_HEADER_BTN_ID;
        btn.title = "等级查询";
        btn.setAttribute("aria-label", "等级查询");
        const username = getUsernameSync();
        const cachedLevel = username ? getCachedLevel(username) : null;
        const btnText = cachedLevel !== null ? `LV.${cachedLevel}` : "LV";
        btn.innerHTML = `<span class="ld-lv-btn-text">${btnText}</span>`;

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            showModal();
        });

        // 插入到头部按钮栏
        headerButtons.appendChild(btn);
    }

    /**
     * 监听头部菜单，注入按钮
     */
    function observeHeader() {
        const observer = new MutationObserver(() => {
            injectHeaderButton();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // 尝试注册（function-btns 可能已加载或尚未加载）
    registerToFuncBtns();
    unsafeWindow.addEventListener("ld-func-btns-ready", () =>
        registerToFuncBtns(),
    );

    // 启动头部菜单按钮注入监听
    observeHeader();
})();
