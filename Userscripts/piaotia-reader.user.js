// ==UserScript==
// @name         Piaotia Reader Mode (飘天文学阅读模式)
// @description  飘天文学章节阅读页排版优化：正文自动重排为段落、隐藏广告与杂项、暗色沉浸式排版、底部快捷翻页栏、右上角开关。
// @namespace    zywu
// @author       zywu
// @license      MIT
// @version      1.0.0
// @match        *://*.piaotia.com/html/*
// @include      /^https?:\/\/(?:www\.)?piaotia\.com\/html\/[^/]+\/[^/]+\/[^/]+\.html(?:\?.*)?$/
// @run-at       document-idle
// @grant        GM.addStyle
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    /* 阅读模式开关：默认开启，选择持久化在 localStorage（每章页面都自动进入阅读模式） */
    const LS_KEY = 'pt_reader_mode';
    let readerOn = localStorage.getItem(LS_KEY) !== '0';

    /* ---------- 阅读模式样式 ---------- */
    const READER_CSS = `
/* ===== 阅读模式：暗色沉浸式排版 ===== */
html.pt-reader-on body {
    background: #101418 !important;
    color: #c6cfd9 !important;
    color-scheme: dark;
    min-width: 0 !important;
    width: 100% !important;
    max-width: none !important;
    padding-bottom: 4rem !important;
}
html.pt-reader-on #main {
    max-width: 46rem !important;
    width: auto !important;
    margin: 0 auto !important;
    background: transparent !important;
    border: 0 !important;
}
html.pt-reader-on #guild,
html.pt-reader-on #shop,
html.pt-reader-on #feit2,
html.pt-reader-on #Commenddiv,
html.pt-reader-on center,
html.pt-reader-on .share,
html.pt-reader-on ins,
html.pt-reader-on iframe {
    display: none !important;
}
html.pt-reader-on #content {
    width: auto !important;
    padding: 1rem 1.4rem 3rem !important;
    font-size: 19px !important;
    line-height: 1.95 !important;
    color: #c6cfd9 !important;
    text-align: justify;
    word-break: break-word;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB",
                 "Microsoft YaHei", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif !important;
}
html.pt-reader-on #content h1 {
    font-size: 1.35em !important;
    line-height: 1.5 !important;
    color: #e8eef5 !important;
    margin: 1.2rem 0 0.9rem !important;
    text-align: center;
}
html.pt-reader-on #content h1 a {
    color: #e8eef5 !important;
}
html.pt-reader-on #content p {
    text-indent: 2em !important;
    margin: 0 0 0.7em !important;
    line-height: 1.95 !important;
}
html.pt-reader-on .toplink,
html.pt-reader-on .bottomlink {
    display: flex !important;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    margin: 1rem 0 !important;
    padding: 0 !important;
}
html.pt-reader-on .toplink a,
html.pt-reader-on .bottomlink a {
    display: inline-block !important;
    padding: 0.35em 1.1em !important;
    border-radius: 999px !important;
    background: #1a212b !important;
    border: 1px solid #2f3a48 !important;
    color: #7db4f0 !important;
    font-size: 15px !important;
    line-height: 1.5 !important;
    text-decoration: none !important;
}
html.pt-reader-on .bottomlink span {
    display: none !important;
}

/* ===== 底部快捷翻页栏 ===== */
#pt-reader-bar {
    position: fixed !important;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483000;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 4.5rem calc(0.5rem + env(safe-area-inset-bottom));
    background: rgba(13, 17, 23, 0.94);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border-top: 1px solid #2f3a48;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.35);
}
#pt-reader-bar a {
    color: #7db4f0 !important;
    text-decoration: none !important;
    padding: 0.4em 1em !important;
    border-radius: 999px;
    background: #1a212b;
    border: 1px solid #2f3a48;
    font-size: 14px !important;
    line-height: 1.4 !important;
    white-space: nowrap;
}
#pt-reader-bar a:hover {
    background: #222b37;
}

/* ===== 右上角开关按钮 ===== */
#pt-reader-fab {
    position: fixed !important;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 2147483001;
    padding: 0.45em 0.95em;
    border-radius: 999px;
    border: 1px solid #3a4656;
    background: rgba(26, 33, 43, 0.92);
    color: #c6cfd9;
    font-size: 13px !important;
    line-height: 1.4 !important;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif !important;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}
#pt-reader-fab:hover {
    background: #222b37;
}
`;

    /* GM.addStyle 不可用时降级为直接插入 <style> */
    function addStyle(css) {
        try {
            if (typeof GM !== 'undefined' && GM.addStyle) {
                GM.addStyle(css);
                return;
            }
        } catch (e) { /* 忽略，走降级路径 */ }
        const el = document.createElement('style');
        el.textContent = css;
        (document.head || document.documentElement).appendChild(el);
    }

    /* 等待 #content 出现（页面脚本 document.write 生成） */
    function waitForContent(timeout = 8000) {
        return new Promise((resolve) => {
            const probe = () => document.getElementById('content');
            const el = probe();
            if (el) return resolve(el);
            const t0 = Date.now();
            const iv = setInterval(() => {
                const found = probe();
                if (found) { clearInterval(iv); resolve(found); }
                else if (Date.now() - t0 > timeout) { clearInterval(iv); resolve(null); }
            }, 50);
        });
    }

    /*
     * 正文重排：站点正文是一串文本节点 + <br>（段落间为 <br><br>，段首为 &nbsp; 缩进）。
     * 移除广告表格/脚本后，把文本按双换行切分为 <p> 段落。
     */
    function extractParagraphs(container) {
        container.querySelectorAll('table, center, script, ins, iframe, form, object, embed')
            .forEach((n) => n.remove());

        const paras = [];
        let buf = '';
        let brStreak = 0;

        const flush = () => {
            const t = buf.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
            if (t) paras.push(t);
            buf = '';
        };

        const walk = (node) => {
            for (const child of node.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    buf += child.textContent;
                    brStreak = 0;
                } else if (child.nodeName === 'BR') {
                    brStreak += 1;
                    if (brStreak >= 2) flush();   // 双换行 = 段落结束
                    else buf += ' ';              // 单换行 = 段内软换行
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const tag = child.tagName;
                    if (tag === 'P' || tag === 'DIV') {
                        // 块级容器边界视为可能的段落边界（兼容 <p>/<div> 排版的书源）
                        flush();
                        walk(child);
                        flush();
                    } else if (tag === 'SPAN') {
                        walk(child);
                    }
                }
            }
        };

        walk(container);
        flush();

        /* 过滤章节末尾的“请收藏/最快更新”广告行 */
        return paras.filter((p) => !/请大家收藏|请收藏本站|更新速度全网最快/.test(p));
    }

    function main() {
        /* 仅章节正文页进入阅读模式：排除章节目录 /index.html 与 #BookText 列表页 */
        if (!/^\/html\/[^/]+\/[^/]+\/[^/]+\.html$/.test(location.pathname)) return;
        if (/\/index\.html$/.test(location.pathname)) return;

        addStyle(READER_CSS);

        waitForContent().then((content) => {
            if (!content) return;
            if (document.getElementById('BookText')) return; // 列表形态目录页

            const originalHTML = content.innerHTML;
            let bar = null;

            /* 重排正文并进入阅读模式 */
            const applyReader = () => {
                if (document.documentElement.classList.contains('pt-reader-on')) return;

                /* 先摘出标题与顶部翻页链接，避免其文本混入正文段落 */
                const h1 = content.querySelector('h1');
                const topLink = content.querySelector('.toplink');
                if (h1) h1.remove();
                if (topLink) topLink.remove();

                const paras = extractParagraphs(content);

                if (paras.length) {
                    const wrap = document.createElement('div');
                    wrap.id = 'pt-reader-body';
                    for (const p of paras) {
                        const el = document.createElement('p');
                        el.textContent = p;
                        wrap.appendChild(el);
                    }
                    content.innerHTML = '';
                    if (h1) content.appendChild(h1);
                    if (topLink) content.appendChild(topLink);
                    content.appendChild(wrap);
                }

                document.documentElement.classList.add('pt-reader-on');
                if (!bar) bar = buildBar(toggleHandler);
                document.body.appendChild(bar);
                syncFab();
            };

            /* 退出阅读模式：恢复原始 DOM */
            const restoreOriginal = () => {
                document.documentElement.classList.remove('pt-reader-on');
                content.innerHTML = originalHTML;
                if (bar) { bar.remove(); bar = null; }
                syncFab();
            };

            const toggleHandler = () => {
                readerOn = !readerOn;
                localStorage.setItem(LS_KEY, readerOn ? '1' : '0');
                if (readerOn) applyReader();
                else restoreOriginal();
            };

            /* 底部快捷翻页栏：上一章 / 目录 / 下一章 / 返回书页 */
            const buildBar = (onToggle) => {
                const el = document.createElement('div');
                el.id = 'pt-reader-bar';

                const mk = (href, label) => {
                    const a = document.createElement('a');
                    a.href = href;
                    a.textContent = label;
                    return a;
                };

                const bottom = document.querySelector('.bottomlink');
                if (bottom) {
                    let prev = null, toc = null, next = null, book = null;
                    bottom.querySelectorAll('a').forEach((a) => {
                        const t = a.textContent.replace(/\s+/g, '');
                        if (/上一章/.test(t)) prev = a.href;
                        else if (/目录/.test(t)) toc = a.href;
                        else if (/下一章/.test(t)) next = a.href;
                        else if (/书页/.test(t)) book = a.href;
                    });
                    if (prev) el.appendChild(mk(prev, '← 上一章'));
                    if (toc) el.appendChild(mk(toc, '目录'));
                    if (next) el.appendChild(mk(next, '下一章 →'));
                    if (book) el.appendChild(mk(book, '返回书页'));
                }

                const btn = document.createElement('button');
                btn.textContent = '退出阅读';
                btn.addEventListener('click', onToggle);
                el.appendChild(btn);
                return el;
            };

            /* 右上角开关：任何状态下都可切换 */
            const fab = document.createElement('button');
            fab.id = 'pt-reader-fab';
            fab.addEventListener('click', toggleHandler);
            document.body.appendChild(fab);

            const syncFab = () => {
                fab.textContent = readerOn ? '退出阅读模式' : '进入阅读模式';
            };

            if (readerOn) applyReader();
            else syncFab();
        });
    }

    main();
})();
