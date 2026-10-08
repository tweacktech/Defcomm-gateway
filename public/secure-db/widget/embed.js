(function () {
    'use strict';

    var script = document.currentScript || document.querySelector('script[data-widget-key]');
    if (!script) return;

    var widgetKey = script.getAttribute('data-widget-key');
    if (!widgetKey) return;

    var gatewayUrl = (script.src || '').replace(/\/secure-db\/widget\/embed\.js(\?.*)?$/, '') || window.location.origin;
    var apiBase = gatewayUrl + '/api/secure-db/widget';
    var token = null;
    var config = null;
    var algorithms = {};
    var jobTimer = null;

    var STORAGE_PREFIX = 'defcomm_sdb_' + widgetKey + '_';
    var SHIELD_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
    var SPINNER_ICON = '<span class="sdb-spinner sdb-spinner-lg"></span>';

    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(function (k) {
            if (k === 'className') node.className = attrs[k];
            else if (k === 'text') node.textContent = attrs[k];
            else if (k === 'html') node.innerHTML = attrs[k];
            else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
            else node.setAttribute(k, attrs[k]);
        });
        (children || []).forEach(function (c) {
            if (typeof c === 'string') node.appendChild(document.createTextNode(c));
            else if (c) node.appendChild(c);
        });
        return node;
    }

    function api(path, method, body, useToken) {
        var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (useToken && token) headers['X-Widget-Token'] = token;
        return fetch(apiBase + path, {
            method: method || 'GET',
            headers: headers,
            body: body ? JSON.stringify(body) : undefined,
        }).then(function (r) {
            return r.json().then(function (d) {
                if (!r.ok) throw new Error(d.message || 'Request failed');
                return d;
            });
        });
    }

    function setBusy(btn, busy, idleLabel, busyLabel) {
        if (!btn) return;
        btn.disabled = !!busy;
        btn.innerHTML = busy
            ? '<span class="sdb-spinner"></span> ' + (busyLabel || 'Working…')
            : (idleLabel || btn.getAttribute('data-label') || 'Submit');
    }

    function stopJobPoll() {
        if (jobTimer) {
            clearInterval(jobTimer);
            jobTimer = null;
        }
    }

    function timeAgo(value) {
        if (!value) return '';
        var date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        var seconds = Math.round((Date.now() - date.getTime()) / 1000);
        if (seconds < 0) seconds = 0;
        if (seconds < 10) return 'just now';
        if (seconds < 60) return seconds + ' seconds ago';
        var minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes === 1 ? '1 minute ago' : minutes + ' minutes ago';
        var hours = Math.floor(minutes / 60);
        if (hours < 24) return hours === 1 ? '1 hour ago' : hours + ' hours ago';
        var days = Math.floor(hours / 24);
        if (days < 7) return days === 1 ? '1 day ago' : days + ' days ago';
        var weeks = Math.floor(days / 7);
        if (weeks < 5) return weeks === 1 ? '1 week ago' : weeks + ' weeks ago';
        var months = Math.floor(days / 30);
        if (months < 12) return months === 1 ? '1 month ago' : months + ' months ago';
        var years = Math.floor(days / 365);
        return years === 1 ? '1 year ago' : years + ' years ago';
    }

    var EXPAND_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    var COLLAPSE_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

    var styles = document.createElement('style');
    styles.textContent = [
        '#defcomm-sdb-btn{position:fixed;right:20px;bottom:20px;z-index:999999;width:52px;height:52px;border-radius:50%;',
        'background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(37,99,235,.45);',
        'display:flex;align-items:center;justify-content:center;transition:transform .2s}',
        '#defcomm-sdb-btn:hover{transform:scale(1.08)}',
        '#defcomm-sdb-btn.loading{pointer-events:none;opacity:.85}',
        '#defcomm-sdb-panel{position:fixed;right:20px;bottom:84px;z-index:999999;width:420px;height:min(80vh,640px);max-height:80vh;',
        'background:#fff;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.18);font-family:system-ui,-apple-system,sans-serif;',
        'font-size:13px;color:#1e293b;display:none;flex-direction:column;overflow:hidden;transition:width .2s,height .2s,bottom .2s}',
        '#defcomm-sdb-panel.open{display:flex}',
        '#defcomm-sdb-panel.expanded{width:min(860px,calc(100vw - 32px));height:min(92vh,920px);max-height:92vh;bottom:16px;right:16px}',
        '#defcomm-sdb-panel.expanded .sdb-log{max-height:none;flex:1}',
        '.sdb-hdr{padding:14px 16px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-weight:600;font-size:14px;display:flex;justify-content:space-between;align-items:center}',
        '.sdb-hdr-actions{display:flex;align-items:center;gap:6px}',
        '.sdb-body{padding:16px;overflow-y:auto;flex:1}',
        '.sdb-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:8px}',
        '.sdb-tab{padding:6px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;color:#64748b;background:transparent;border:none}',
        '.sdb-tab.active{background:#eff6ff;color:#2563eb}',
        '.sdb-input{width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box}',
        '.sdb-btn{width:100%;padding:9px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;margin-top:4px}',
        '.sdb-btn:disabled{opacity:.7;cursor:wait}',
        '.sdb-btn-primary{background:#2563eb;color:#fff}.sdb-btn-primary:hover{background:#1d4ed8}',
        '.sdb-btn-secondary{background:#f1f5f9;color:#475569;margin-top:6px}',
        '.sdb-btn-danger{background:#dc2626;color:#fff;margin-top:6px}',
        '.sdb-label{display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.03em}',
        '.sdb-msg{padding:8px 10px;border-radius:8px;font-size:12px;margin-bottom:8px}',
        '.sdb-msg-err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}',
        '.sdb-msg-ok{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}',
        '.sdb-log{max-height:180px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px}',
        '.sdb-views-logs{display:flex;flex-direction:column;min-height:0;flex:1}',
        '.sdb-log-item{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}',
        '.sdb-log-item:last-child{border-bottom:none}',
        '.sdb-key-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-family:monospace;font-size:10px;word-break:break-all;max-height:140px;overflow-y:auto;margin:8px 0}',
        '.sdb-key-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:8px}',
        '.sdb-key-row .sdb-btn{width:auto;margin:0;padding:6px 10px;font-size:11px}',
        '.sdb-guide{font-size:12px;color:#64748b;margin:0 0 10px;line-height:1.45}',
        '.sdb-code{background:#0f172a;color:#e2e8f0;border-radius:8px;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;white-space:pre-wrap;word-break:break-word;margin:8px 0;max-height:260px;overflow:auto}',
        '.sdb-icon-btn,.sdb-close{background:none;border:none;color:#fff;cursor:pointer;font-size:18px;line-height:1;padding:4px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center}',
        '.sdb-icon-btn:hover,.sdb-close:hover{background:rgba(255,255,255,.15)}',
        '.sdb-icon-btn svg{display:block}',
        '.sdb-spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:sdbspin .6s linear infinite;vertical-align:-2px}',
        '.sdb-spinner-lg{width:22px;height:22px;border-width:3px}',
        '.sdb-spinner-dark{border-color:#cbd5e1;border-top-color:#2563eb}',
        '@keyframes sdbspin{to{transform:rotate(360deg)}}',
        '.sdb-progress-wrap{margin:10px 0 4px}',
        '.sdb-progress{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden}',
        '.sdb-progress>span{display:block;height:100%;width:0;background:linear-gradient(90deg,#2563eb,#7c3aed);transition:width .25s}',
        '.sdb-progress-label{font-size:11px;color:#64748b;margin-top:4px}',
        '.sdb-enc-item{border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:8px}',
        '.sdb-enc-item strong{display:block;margin-bottom:4px}',
        '.sdb-enc-meta{font-size:11px;color:#64748b;margin-bottom:6px}',
    ].join('');
    document.head.appendChild(styles);

    var panel, bodyEl, msgEl, fab;

    function showMsg(text, ok) {
        if (!msgEl) return;
        msgEl.className = 'sdb-msg ' + (ok ? 'sdb-msg-ok' : 'sdb-msg-err');
        msgEl.textContent = text;
        msgEl.style.display = text ? 'block' : 'none';
    }

    function makeProgress() {
        var wrap = el('div', { className: 'sdb-progress-wrap', style: 'display:none' });
        var bar = el('div', { className: 'sdb-progress' }, [el('span')]);
        var label = el('div', { className: 'sdb-progress-label' });
        wrap.appendChild(bar);
        wrap.appendChild(label);
        return { wrap: wrap, fill: bar.firstChild, label: label };
    }

    function updateProgress(ui, percent, message) {
        if (!ui) return;
        ui.wrap.style.display = 'block';
        ui.fill.style.width = Math.max(0, Math.min(100, percent || 0)) + '%';
        ui.label.textContent = (percent || 0) + '% — ' + (message || 'Working…');
    }

    function watchJob(uuid, progressUi, btn, idleLabel, onDone) {
        stopJobPoll();
        function tick() {
            api('/jobs/' + uuid, 'GET', null, true).then(function (d) {
                updateProgress(progressUi, d.percent, d.message || d.table || d.status);
                if (d.status === 'completed') {
                    stopJobPoll();
                    setBusy(btn, false, idleLabel);
                    updateProgress(progressUi, 100, d.message || 'Done.');
                    showMsg(d.message || 'Job completed.', true);
                    if (onDone) onDone(d);
                } else if (d.status === 'failed') {
                    stopJobPoll();
                    setBusy(btn, false, idleLabel);
                    showMsg(d.error_message || d.message || 'Job failed.', false);
                }
            }).catch(function (e) {
                stopJobPoll();
                setBusy(btn, false, idleLabel);
                showMsg(e.message, false);
            });
        }
        tick();
        jobTimer = setInterval(tick, 1200);
    }

    function renderAuth() {
        bodyEl.innerHTML = '';
        msgEl = el('div', { className: 'sdb-msg', style: 'display:none' });
        var secretInput = el('input', { className: 'sdb-input', type: 'password', placeholder: 'Enter your widget secret key' });
        var authBtn = el('button', { className: 'sdb-btn sdb-btn-primary', text: 'Authenticate' });
        authBtn.setAttribute('data-label', 'Authenticate');
        authBtn.addEventListener('click', function () {
            showMsg('', true);
            setBusy(authBtn, true, 'Authenticate', 'Authenticating…');
            api('/authenticate', 'POST', { widget_key: widgetKey, secret_key: secretInput.value })
                .then(function (d) {
                    token = d.token;
                    config = d.widget;
                    algorithms = d.algorithms || {};
                    sessionStorage.setItem(STORAGE_PREFIX + 'token', token);
                    refreshDashboard();
                })
                .catch(function (e) {
                    setBusy(authBtn, false, 'Authenticate');
                    showMsg(e.message, false);
                });
        });
        bodyEl.appendChild(msgEl);
        bodyEl.appendChild(el('p', { text: 'Authenticate with the secret key generated on DefComm Gateway.', style: 'margin:0 0 12px;color:#64748b;font-size:12px' }));
        bodyEl.appendChild(el('label', { className: 'sdb-label', text: 'Secret Key' }));
        bodyEl.appendChild(secretInput);
        bodyEl.appendChild(authBtn);
    }

    var connected = false;
    var defaultPort = 3306;
    var dbLabel = '';

    function renderDashboard(connStatus) {
        stopJobPoll();
        bodyEl.innerHTML = '';
        msgEl = el('div', { className: 'sdb-msg', style: 'display:none' });
        bodyEl.appendChild(msgEl);

        connected = connStatus && connStatus.connected;
        defaultPort = connStatus ? (connStatus.default_port || 3306) : (config.default_port || 3306);
        dbLabel = config.database_label || config.database_type || 'Database';

        var connInfo = connected
            ? '<span style="color:#16a34a">● Connected to ' + connStatus.connection.host + '/' + connStatus.connection.database_name + '</span>'
            : '<span style="color:#f59e0b">● Not connected — set up your ' + dbLabel + ' below</span>';

        bodyEl.appendChild(el('div', { html: '<strong>' + (config.name || 'Secure DB') + '</strong><br><span style="color:#64748b;font-size:11px">' +
            dbLabel + ' · ' + (config.language || '') + '</span><br>' + connInfo,
            style: 'margin-bottom:12px' }));

        var tabs = el('div', { className: 'sdb-tabs' });
        var views = {};
        var tabKeys = ['connect', 'encrypt', 'database', 'encrypted', 'logs', 'key'];
        var tabLabels = ['Connect', 'Encrypt', 'Database', 'Encrypted', 'Logs', 'Key'];
        var active = connected ? 'encrypt' : 'connect';

        function switchTab(name) {
            active = name;
            tabs.querySelectorAll('.sdb-tab').forEach(function (t, i) {
                t.className = 'sdb-tab' + (tabKeys[i] === name ? ' active' : '');
            });
            Object.keys(views).forEach(function (k) { views[k].style.display = k === name ? (k === 'logs' ? 'flex' : 'block') : 'none'; });
            if (name === 'encrypted') loadEncrypted();
            if (name === 'key') loadAppKeys();
        }

        tabLabels.forEach(function (label, i) {
            tabs.appendChild(el('button', { className: 'sdb-tab' + (tabKeys[i] === active ? ' active' : ''), text: label, onclick: function () { switchTab(tabKeys[i]); } }));
        });
        bodyEl.appendChild(tabs);

        views.connect = el('div');
        views.connect.appendChild(el('p', { text: 'Connect your ' + dbLabel + ' database. Credentials are encrypted and never shown in the widget.', style: 'font-size:12px;color:#64748b;margin:0 0 10px' }));

        if (connected && connStatus.connection) {
            views.connect.appendChild(el('div', { className: 'sdb-msg sdb-msg-ok', text: 'Connected to ' + connStatus.connection.host + ' — ' + connStatus.connection.database_name }));
            var discBtn = el('button', { className: 'sdb-btn sdb-btn-secondary', text: 'Disconnect' });
            discBtn.addEventListener('click', function () {
                setBusy(discBtn, true, 'Disconnect', 'Disconnecting…');
                api('/disconnect', 'POST', null, true).then(function () {
                    showMsg('Disconnected.', true);
                    refreshDashboard();
                }).catch(function (e) {
                    setBusy(discBtn, false, 'Disconnect');
                    showMsg(e.message, false);
                });
            });
            views.connect.appendChild(discBtn);
        } else {
            var hostInput = el('input', { className: 'sdb-input', placeholder: 'Host (e.g. 127.0.0.1)' });
            var portInput = el('input', { className: 'sdb-input', placeholder: 'Port', value: String(defaultPort) });
            var dbInput = el('input', { className: 'sdb-input', placeholder: 'Database name' });
            var userInput = el('input', { className: 'sdb-input', placeholder: 'Username' });
            var passInput = el('input', { className: 'sdb-input', type: 'password', placeholder: 'Password' });
            views.connect.appendChild(el('label', { className: 'sdb-label', text: 'Host' }));
            views.connect.appendChild(hostInput);
            views.connect.appendChild(el('label', { className: 'sdb-label', text: 'Port' }));
            views.connect.appendChild(portInput);
            if (config.database_type !== 'redis') {
                views.connect.appendChild(el('label', { className: 'sdb-label', text: 'Database' }));
                views.connect.appendChild(dbInput);
            }
            views.connect.appendChild(el('label', { className: 'sdb-label', text: 'Username' }));
            views.connect.appendChild(userInput);
            views.connect.appendChild(el('label', { className: 'sdb-label', text: 'Password' }));
            views.connect.appendChild(passInput);
            views.connect.appendChild(el('label', { html: '<input type="checkbox" id="sdb-ssl-cb"> SSL Enabled', style: 'font-size:12px;text-transform:none;letter-spacing:0' }));
            var connectBtn = el('button', { className: 'sdb-btn sdb-btn-primary', text: 'Connect to ' + dbLabel });
            connectBtn.addEventListener('click', function () {
                var sslEl = document.getElementById('sdb-ssl-cb');
                setBusy(connectBtn, true, 'Connect to ' + dbLabel, 'Connecting…');
                api('/connect', 'POST', {
                    host: hostInput.value,
                    port: parseInt(portInput.value, 10) || defaultPort,
                    database_name: dbInput.value || '0',
                    username: userInput.value,
                    password: passInput.value,
                    ssl_enabled: sslEl ? sslEl.checked : false,
                }, true).then(function (d) {
                    showMsg(d.message || 'Connected!', true);
                    refreshDashboard();
                }).catch(function (e) {
                    setBusy(connectBtn, false, 'Connect to ' + dbLabel);
                    showMsg(e.message, false);
                });
            });
            views.connect.appendChild(connectBtn);
        }

        views.encrypt = el('div');
        if (!connected) {
            views.encrypt.appendChild(el('p', { text: 'Connect your database first to use encryption.', style: 'color:#64748b;font-size:12px' }));
        } else {
            var encInput = el('textarea', { className: 'sdb-input', placeholder: 'Value to encrypt or decrypt', style: 'min-height:60px;resize:vertical' });
            var algoSelect = el('select', { className: 'sdb-input' });
            Object.keys(algorithms).forEach(function (k) {
                algoSelect.appendChild(el('option', { value: k, text: algorithms[k] }));
            });
            var encResult = el('div', { className: 'sdb-key-box', style: 'display:none' });
            var encBtn = el('button', { className: 'sdb-btn sdb-btn-primary', text: 'Encrypt Value' });
            var decValBtn = el('button', { className: 'sdb-btn sdb-btn-secondary', text: 'Decrypt Value' });
            encBtn.addEventListener('click', function () {
                setBusy(encBtn, true, 'Encrypt Value', 'Encrypting…');
                api('/encrypt', 'POST', { value: encInput.value, algorithm: algoSelect.value }, true)
                    .then(function (d) {
                        encResult.style.display = 'block';
                        encResult.textContent = d.encrypted;
                        showMsg('Encrypted successfully.', true);
                    })
                    .catch(function (e) { showMsg(e.message, false); })
                    .finally(function () { setBusy(encBtn, false, 'Encrypt Value'); });
            });
            decValBtn.addEventListener('click', function () {
                setBusy(decValBtn, true, 'Decrypt Value', 'Decrypting…');
                api('/decrypt', 'POST', { value: encInput.value }, true)
                    .then(function (d) {
                        encResult.style.display = 'block';
                        encResult.textContent = d.decrypted;
                        showMsg('Decrypted successfully.', true);
                    })
                    .catch(function (e) { showMsg(e.message, false); })
                    .finally(function () { setBusy(decValBtn, false, 'Decrypt Value'); });
            });
            views.encrypt.appendChild(el('label', { className: 'sdb-label', text: 'Encryption Type' }));
            views.encrypt.appendChild(algoSelect);
            views.encrypt.appendChild(el('label', { className: 'sdb-label', text: 'Value' }));
            views.encrypt.appendChild(encInput);
            views.encrypt.appendChild(encBtn);
            views.encrypt.appendChild(decValBtn);
            views.encrypt.appendChild(encResult);
        }

        views.database = el('div');
        var dbProgress = makeProgress();
        if (!connected) {
            views.database.appendChild(el('p', { text: 'Connect your database first.', style: 'color:#64748b;font-size:12px' }));
        } else {
            var dbScope = el('select', { className: 'sdb-input' });
            [['database', 'Whole Database'], ['table', 'Single Table / Collection']].forEach(function (o) {
                dbScope.appendChild(el('option', { value: o[0], text: o[1] }));
            });
            var dbAlgo = el('select', { className: 'sdb-input' });
            Object.keys(algorithms).forEach(function (k) {
                dbAlgo.appendChild(el('option', { value: k, text: algorithms[k] }));
            });
            var tableInput = el('input', { className: 'sdb-input', placeholder: 'Table or collection name' });
            var dbEncBtn = el('button', { className: 'sdb-btn sdb-btn-primary', text: 'Start Encryption' });
            dbEncBtn.addEventListener('click', function () {
                var payload = { scope: dbScope.value, algorithm: dbAlgo.value };
                if (dbScope.value === 'table') payload.table_name = tableInput.value;
                setBusy(dbEncBtn, true, 'Start Encryption', 'Encrypting…');
                updateProgress(dbProgress, 2, 'Queuing encryption…');
                api('/encrypt-database', 'POST', payload, true)
                    .then(function (d) {
                        showMsg(d.message || 'Encryption started.', true);
                        if (d.job && d.job.uuid) {
                            watchJob(d.job.uuid, dbProgress, dbEncBtn, 'Start Encryption', function () {
                                switchTab('encrypted');
                            });
                        } else {
                            setBusy(dbEncBtn, false, 'Start Encryption');
                        }
                    })
                    .catch(function (e) {
                        setBusy(dbEncBtn, false, 'Start Encryption');
                        showMsg(e.message, false);
                    });
            });
            views.database.appendChild(el('label', { className: 'sdb-label', text: 'Scope' }));
            views.database.appendChild(dbScope);
            views.database.appendChild(el('label', { className: 'sdb-label', text: 'Encryption Type' }));
            views.database.appendChild(dbAlgo);
            views.database.appendChild(el('label', { className: 'sdb-label', text: 'Table / Collection' }));
            views.database.appendChild(tableInput);
            views.database.appendChild(dbEncBtn);
            views.database.appendChild(dbProgress.wrap);
            views.database.appendChild(el('p', { text: 'Progress updates live while the job runs.', style: 'font-size:11px;color:#64748b;margin-top:8px' }));
        }

        views.encrypted = el('div');
        var encList = el('div');
        var encProgress = makeProgress();
        views.encrypted.appendChild(el('p', { text: 'Encrypted tables and collections. Decrypt restores original values.', style: 'font-size:12px;color:#64748b;margin:0 0 10px' }));
        views.encrypted.appendChild(encProgress.wrap);
        views.encrypted.appendChild(encList);

        function loadEncrypted() {
            if (!connected) {
                encList.innerHTML = '';
                encList.appendChild(el('p', { text: 'Connect your database first.', style: 'color:#64748b;font-size:12px' }));
                return;
            }
            encList.innerHTML = '<div style="color:#64748b;font-size:12px"><span class="sdb-spinner sdb-spinner-dark"></span> Loading…</div>';
            api('/encrypted-objects', 'GET', null, true).then(function (d) {
                encList.innerHTML = '';
                var objects = d.objects || [];
                if (!objects.length) {
                    encList.appendChild(el('p', { text: 'No encrypted tables or collections yet.', style: 'color:#64748b;font-size:12px' }));
                    return;
                }
                objects.forEach(function (obj) {
                    var item = el('div', { className: 'sdb-enc-item' });
                    item.appendChild(el('strong', { text: obj.name }));
                    item.appendChild(el('div', { className: 'sdb-enc-meta', text:
                        (obj.object_type || 'table') + ' · ' + (obj.encryption_scope || '') +
                        ' · ' + (obj.encrypted_values || 0) + ' values · ' + (obj.algorithm || '') }));
                    var decBtn = el('button', { className: 'sdb-btn sdb-btn-danger', text: 'Decrypt ' + obj.name });
                    decBtn.addEventListener('click', function () {
                        if (!confirm('Decrypt "' + obj.name + '" back to plaintext?')) return;
                        setBusy(decBtn, true, 'Decrypt ' + obj.name, 'Decrypting…');
                        updateProgress(encProgress, 2, 'Queuing decryption…');
                        api('/decrypt-database', 'POST', { scope: 'table', table_name: obj.name }, true)
                            .then(function (res) {
                                showMsg(res.message || 'Decryption started.', true);
                                if (res.job && res.job.uuid) {
                                    watchJob(res.job.uuid, encProgress, decBtn, 'Decrypt ' + obj.name, function () {
                                        loadEncrypted();
                                    });
                                } else {
                                    setBusy(decBtn, false, 'Decrypt ' + obj.name);
                                    loadEncrypted();
                                }
                            })
                            .catch(function (e) {
                                setBusy(decBtn, false, 'Decrypt ' + obj.name);
                                showMsg(e.message, false);
                            });
                    });
                    item.appendChild(decBtn);
                    encList.appendChild(item);
                });
            }).catch(function (e) {
                encList.innerHTML = '';
                showMsg(e.message, false);
            });
        }

        views.logs = el('div', { className: 'sdb-views-logs' });
        var logBox = el('div', { className: 'sdb-log' });
        var logBtn = el('button', { className: 'sdb-btn sdb-btn-secondary', text: 'Refresh Logs' });
        function loadLogs() {
            setBusy(logBtn, true, 'Refresh Logs', 'Loading…');
            api('/audit-logs', 'GET', null, true).then(function (d) {
                logBox.innerHTML = '';
                (d.logs || []).forEach(function (log) {
                    logBox.appendChild(el('div', { className: 'sdb-log-item', html:
                        '<strong>' + log.action + '</strong> ' + (log.success ? '✓' : '✗') + '<br>' +
                        log.description + '<br><span style="color:#94a3b8" title="' + (log.created_at || '') + '">' + timeAgo(log.created_at) + '</span>' }));
                });
                if (!(d.logs || []).length) logBox.appendChild(el('div', { className: 'sdb-log-item', text: 'No logs yet.' }));
            }).catch(function (e) { showMsg(e.message, false); })
            .finally(function () { setBusy(logBtn, false, 'Refresh Logs'); });
        }
        logBtn.addEventListener('click', loadLogs);
        views.logs.appendChild(logBox);
        views.logs.appendChild(logBtn);
        loadLogs();

        views.key = el('div');
        var keyName = el('input', { className: 'sdb-input', placeholder: 'App name, e.g. Mobile API or Billing service' });
        keyName.setAttribute('type', 'text');
        var keyList = el('div');
        var newKeyBox = el('div', { className: 'sdb-key-box', style: 'display:none' });
        var usageBox = el('pre', { className: 'sdb-code' });
        var keyBtn = el('button', { className: 'sdb-btn sdb-btn-primary', text: 'Generate API key' });
        var copyUsageBtn = el('button', { className: 'sdb-btn sdb-btn-secondary', text: 'Copy usage snippet' });

        function appApiBase() {
            return String(gatewayUrl || '').replace(/\/$/, '') + '/api/secure-db/app';
        }

        function usageSnippet(plainKey) {
            var key = plainKey || 'sdbk_YOUR_APP_KEY';
            var base = appApiBase();
            return [
                'Use a different API key for each app. Keep it secret — it is shown only once.',
                '',
                'Header:',
                '  X-Secure-DB-App-Key: ' + key,
                '  Content-Type: application/json',
                '',
                'List tables',
                '  GET ' + base + '/tables',
                '',
                'Query (decrypts encrypted tables automatically)',
                '  POST ' + base + '/query',
                '  { "table": "pages", "search": "", "page": 1, "per_page": 25, "decrypt": true }',
                '',
                'Decrypt one value',
                '  POST ' + base + '/decrypt',
                '  { "value": "<encrypted-cell>" }',
                '',
                'fetch example:',
                'fetch("' + base + '/query", {',
                '  method: "POST",',
                '  headers: {',
                '    "Content-Type": "application/json",',
                '    "X-Secure-DB-App-Key": "' + key + '"',
                '  },',
                '  body: JSON.stringify({ table: "pages", decrypt: true })',
                '}).then(r => r.json())',
            ].join('\n');
        }

        function setUsage(plainKey) {
            usageBox.textContent = usageSnippet(plainKey);
        }

        function copyText(text, btn, doneLabel) {
            var label = btn.textContent;
            var ok = function () {
                btn.textContent = doneLabel || 'Copied';
                setTimeout(function () { btn.textContent = label; }, 1600);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(ok).catch(function () {
                    showMsg('Could not copy. Select the text instead.', false);
                });
            } else {
                showMsg('Copy is not available in this browser.', false);
            }
        }

        function loadAppKeys() {
            api('/app-keys', 'GET', null, true).then(function (d) {
                keyList.innerHTML = '';
                var keys = d.keys || [];
                if (!keys.length) {
                    keyList.appendChild(el('div', { className: 'sdb-enc-meta', text: 'No app keys yet. Generate one per application.' }));
                    return;
                }
                keys.forEach(function (item) {
                    var row = el('div', { className: 'sdb-key-row' });
                    var meta = el('div');
                    meta.appendChild(el('strong', { text: item.name || 'App' }));
                    var details = el('div', { className: 'sdb-enc-meta' });
                    details.appendChild(document.createTextNode((item.key_prefix || '') + '…'));
                    details.appendChild(el('br'));
                    details.appendChild(document.createTextNode('Created ' + timeAgo(item.created_at)));
                    details.appendChild(el('br'));
                    details.appendChild(document.createTextNode(item.last_used_at ? 'Last used ' + timeAgo(item.last_used_at) : 'Never used'));
                    meta.appendChild(details);
                    var revoke = el('button', { className: 'sdb-btn sdb-btn-danger', text: 'Revoke' });
                    revoke.addEventListener('click', function () {
                        if (!confirm('Revoke this key? The app using it will stop working.')) return;
                        setBusy(revoke, true, 'Revoke', 'Revoking…');
                        api('/app-keys/' + item.uuid, 'DELETE', null, true).then(function () {
                            showMsg('API key revoked.', true);
                            loadAppKeys();
                        }).catch(function (e) {
                            setBusy(revoke, false, 'Revoke');
                            showMsg(e.message, false);
                        });
                    });
                    row.appendChild(meta);
                    row.appendChild(revoke);
                    keyList.appendChild(row);
                });
            }).catch(function (e) {
                showMsg(e.message, false);
            });
        }

        keyBtn.addEventListener('click', function () {
            var name = (keyName.value || '').trim();
            if (!name) {
                showMsg('Enter an app name first.', false);
                return;
            }
            setBusy(keyBtn, true, 'Generate API key', 'Generating…');
            api('/app-keys', 'POST', { name: name }, true).then(function (d) {
                keyName.value = '';
                newKeyBox.style.display = 'block';
                newKeyBox.textContent = d.plain_key;
                setUsage(d.plain_key);
                showMsg(d.message || 'Save this key now. It will not be shown again.', true);
                loadAppKeys();
            }).catch(function (e) {
                showMsg(e.message, false);
            }).finally(function () {
                setBusy(keyBtn, false, 'Generate API key');
            });
        });

        copyUsageBtn.addEventListener('click', function () {
            copyText(usageBox.textContent, copyUsageBtn, 'Copied');
        });

        newKeyBox.addEventListener('click', function () {
            if (newKeyBox.textContent) copyText(newKeyBox.textContent, copyUsageBtn, 'Copied key');
        });

        views.key.appendChild(el('p', { className: 'sdb-guide', text: 'Create one API key per app. When that app queries a table, the gateway checks whether it is encrypted, decrypts matching cells, and returns plaintext. Connect the database in this widget first.' }));
        views.key.appendChild(el('label', { className: 'sdb-label', text: 'App name' }));
        views.key.appendChild(keyName);
        views.key.appendChild(keyBtn);
        views.key.appendChild(el('p', { className: 'sdb-guide', text: 'New key (click to copy — shown only once):', style: 'margin-top:10px' }));
        views.key.appendChild(newKeyBox);
        views.key.appendChild(el('p', { className: 'sdb-guide', html: '<strong>Existing keys</strong>' }));
        views.key.appendChild(keyList);
        views.key.appendChild(el('p', { className: 'sdb-guide', html: '<strong>How to use the key</strong>', style: 'margin-top:12px' }));
        views.key.appendChild(usageBox);
        views.key.appendChild(copyUsageBtn);
        setUsage();
        if (active === 'key') loadAppKeys();

        Object.keys(views).forEach(function (k) {
            views[k].style.display = k === active ? (k === 'logs' ? 'flex' : 'block') : 'none';
            bodyEl.appendChild(views[k]);
        });

        var signOutBtn = el('button', { className: 'sdb-btn sdb-btn-secondary', text: 'Sign Out', style: 'margin-top:12px' });
        signOutBtn.addEventListener('click', function () {
            setBusy(signOutBtn, true, 'Sign Out', 'Signing out…');
            api('/logout', 'POST', null, true).finally(function () {
                token = null;
                connected = false;
                stopJobPoll();
                sessionStorage.removeItem(STORAGE_PREFIX + 'token');
                renderAuth();
            });
        });
        bodyEl.appendChild(signOutBtn);

        if (connected && active === 'encrypted') loadEncrypted();
    }

    function refreshDashboard() {
        api('/connection-status', 'GET', null, true).then(function (status) {
            renderDashboard(status);
        }).catch(function () {
            renderDashboard({ connected: false });
        });
    }

    function setFabLoading(loading) {
        if (!fab) return;
        fab.classList.toggle('loading', !!loading);
        fab.innerHTML = loading ? SPINNER_ICON : SHIELD_ICON;
    }

    function openPanel() {
        panel.classList.add('open');
        setFabLoading(true);
        var done = function () { setFabLoading(false); };
        if (token) {
            api('/config', 'GET', null, true).then(function (d) {
                config = d.widget;
                algorithms = d.algorithms || {};
                refreshDashboard();
            }).catch(function () {
                token = null;
                sessionStorage.removeItem(STORAGE_PREFIX + 'token');
                renderAuth();
            }).finally(done);
        } else {
            renderAuth();
            done();
        }
    }

    panel = el('div', { id: 'defcomm-sdb-panel' });
    var expandBtn = el('button', { className: 'sdb-icon-btn', title: 'Expand' });
    function syncExpandIcon() {
        var expanded = panel.classList.contains('expanded');
        expandBtn.title = expanded ? 'Shrink' : 'Expand';
        expandBtn.innerHTML = expanded ? COLLAPSE_ICON : EXPAND_ICON;
    }
    expandBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        panel.classList.toggle('expanded');
        sessionStorage.setItem(STORAGE_PREFIX + 'expanded', panel.classList.contains('expanded') ? '1' : '0');
        syncExpandIcon();
    });
    panel.appendChild(el('div', { className: 'sdb-hdr' }, [
        el('span', { text: 'DefComm Secure DB' }),
        el('div', { className: 'sdb-hdr-actions' }, [
            expandBtn,
            el('button', { className: 'sdb-close', title: 'Close', text: '×', onclick: function () { stopJobPoll(); panel.classList.remove('open'); } }),
        ]),
    ]));
    if (sessionStorage.getItem(STORAGE_PREFIX + 'expanded') === '1') {
        panel.classList.add('expanded');
    }
    syncExpandIcon();
    bodyEl = el('div', { className: 'sdb-body' });
    panel.appendChild(bodyEl);

    fab = el('button', { id: 'defcomm-sdb-btn', title: 'DefComm Secure DB' });
    fab.innerHTML = SHIELD_ICON;
    fab.addEventListener('click', function () {
        if (panel.classList.contains('open')) {
            stopJobPoll();
            panel.classList.remove('open');
            setFabLoading(false);
            return;
        }
        openPanel();
    });

    document.body.appendChild(panel);
    document.body.appendChild(fab);

    var savedToken = sessionStorage.getItem(STORAGE_PREFIX + 'token');
    if (savedToken) token = savedToken;
})();
