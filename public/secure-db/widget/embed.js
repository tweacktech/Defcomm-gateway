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

    var STORAGE_PREFIX = 'defcomm_sdb_' + widgetKey + '_';

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

    var styles = document.createElement('style');
    styles.textContent = [
        '#defcomm-sdb-btn{position:fixed;right:20px;bottom:20px;z-index:999999;width:52px;height:52px;border-radius:50%;',
        'background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(37,99,235,.45);',
        'display:flex;align-items:center;justify-content:center;transition:transform .2s}',
        '#defcomm-sdb-btn:hover{transform:scale(1.08)}',
        '#defcomm-sdb-panel{position:fixed;right:20px;bottom:84px;z-index:999999;width:380px;max-height:80vh;',
        'background:#fff;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.18);font-family:system-ui,-apple-system,sans-serif;',
        'font-size:13px;color:#1e293b;display:none;flex-direction:column;overflow:hidden}',
        '#defcomm-sdb-panel.open{display:flex}',
        '.sdb-hdr{padding:14px 16px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-weight:600;font-size:14px;display:flex;justify-content:space-between;align-items:center}',
        '.sdb-body{padding:16px;overflow-y:auto;flex:1}',
        '.sdb-tabs{display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:8px}',
        '.sdb-tab{padding:6px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;color:#64748b;background:transparent;border:none}',
        '.sdb-tab.active{background:#eff6ff;color:#2563eb}',
        '.sdb-input{width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box}',
        '.sdb-btn{width:100%;padding:9px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;margin-top:4px}',
        '.sdb-btn-primary{background:#2563eb;color:#fff}.sdb-btn-primary:hover{background:#1d4ed8}',
        '.sdb-btn-secondary{background:#f1f5f9;color:#475569;margin-top:6px}',
        '.sdb-label{display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.03em}',
        '.sdb-msg{padding:8px 10px;border-radius:8px;font-size:12px;margin-bottom:8px}',
        '.sdb-msg-err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}',
        '.sdb-msg-ok{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}',
        '.sdb-log{max-height:180px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px}',
        '.sdb-log-item{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}',
        '.sdb-log-item:last-child{border-bottom:none}',
        '.sdb-key-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-family:monospace;font-size:10px;word-break:break-all;max-height:100px;overflow-y:auto;margin:8px 0}',
        '.sdb-close{background:none;border:none;color:#fff;cursor:pointer;font-size:18px;line-height:1;padding:0}',
    ].join('');
    document.head.appendChild(styles);

    var panel, bodyEl, msgEl;

    function showMsg(text, ok) {
        if (!msgEl) return;
        msgEl.className = 'sdb-msg ' + (ok ? 'sdb-msg-ok' : 'sdb-msg-err');
        msgEl.textContent = text;
        msgEl.style.display = text ? 'block' : 'none';
    }

    function renderAuth() {
        bodyEl.innerHTML = '';
        msgEl = el('div', { className: 'sdb-msg', style: 'display:none' });
        var secretInput = el('input', { className: 'sdb-input', type: 'password', placeholder: 'Enter your widget secret key' });
        bodyEl.appendChild(msgEl);
        bodyEl.appendChild(el('p', { text: 'Authenticate with the secret key generated on DefComm Gateway.', style: 'margin:0 0 12px;color:#64748b;font-size:12px' }));
        bodyEl.appendChild(el('label', { className: 'sdb-label', text: 'Secret Key' }));
        bodyEl.appendChild(secretInput);
        bodyEl.appendChild(el('button', {
            className: 'sdb-btn sdb-btn-primary', text: 'Authenticate',
            onclick: function () {
                showMsg('', true);
                api('/authenticate', 'POST', { widget_key: widgetKey, secret_key: secretInput.value })
                    .then(function (d) {
                        token = d.token;
                        config = d.widget;
                        algorithms = d.algorithms || {};
                        sessionStorage.setItem(STORAGE_PREFIX + 'token', token);
                        refreshDashboard();
                    })
                    .catch(function (e) { showMsg(e.message, false); });
            },
        }));
    }

    var connected = false;
    var defaultPort = 3306;
    var dbLabel = '';

    function renderDashboard(connStatus) {
        bodyEl.innerHTML = '';
        msgEl = el('div', { className: 'sdb-msg', style: 'display:none' });
        bodyEl.appendChild(msgEl);

        connected = connStatus && connStatus.connected;
        defaultPort = connStatus ? (connStatus.default_port || 3306) : (config.default_port || 3306);
        dbLabel = config.database_label || config.database_type || 'Database';

        var connInfo = connected
            ? '<span style="color:#16a34a">● Connected to ' + connStatus.connection.host + '/' + connStatus.connection.database_name + '</span>'
            : '<span style="color:#f59e0b">● Not connected — set up your ' + dbLabel + ' below</span>';

        var info = el('div', { html: '<strong>' + (config.name || 'Secure DB') + '</strong><br><span style="color:#64748b;font-size:11px">' +
            dbLabel + ' · ' + (config.language || '') + '</span><br>' + connInfo,
            style: 'margin-bottom:12px' });
        bodyEl.appendChild(info);

        var tabs = el('div', { className: 'sdb-tabs' });
        var views = {};
        var tabKeys = ['connect', 'encrypt', 'database', 'logs', 'key'];
        var tabLabels = ['Connect', 'Encrypt', 'Database', 'Logs', 'Key'];
        var active = connected ? 'encrypt' : 'connect';

        function switchTab(name) {
            active = name;
            tabs.querySelectorAll('.sdb-tab').forEach(function (t, i) {
                t.className = 'sdb-tab' + (tabKeys[i] === name ? ' active' : '');
            });
            Object.keys(views).forEach(function (k) { views[k].style.display = k === name ? 'block' : 'none'; });
        }

        tabLabels.forEach(function (label, i) {
            tabs.appendChild(el('button', { className: 'sdb-tab' + (tabKeys[i] === active ? ' active' : ''), text: label, onclick: function () { switchTab(tabKeys[i]); } }));
        });
        bodyEl.appendChild(tabs);

        // Connect tab — client enters their own DB credentials
        views.connect = el('div');
        views.connect.appendChild(el('p', { text: 'Connect your ' + dbLabel + ' database. Credentials are encrypted and never shown in the widget.', style: 'font-size:12px;color:#64748b;margin:0 0 10px' }));

        if (connected && connStatus.connection) {
            views.connect.appendChild(el('div', { className: 'sdb-msg sdb-msg-ok', text: 'Connected to ' + connStatus.connection.host + ' — ' + connStatus.connection.database_name }));
            views.connect.appendChild(el('button', {
                className: 'sdb-btn sdb-btn-secondary', text: 'Disconnect',
                onclick: function () {
                    api('/disconnect', 'POST', null, true).then(function () {
                        showMsg('Disconnected.', true);
                        refreshDashboard();
                    });
                },
            }));
        } else {
            var hostInput = el('input', { className: 'sdb-input', placeholder: 'Host (e.g. 127.0.0.1)' });
            var portInput = el('input', { className: 'sdb-input', placeholder: 'Port', value: String(defaultPort) });
            var dbInput = el('input', { className: 'sdb-input', placeholder: 'Database name' });
            var userInput = el('input', { className: 'sdb-input', placeholder: 'Username' });
            var passInput = el('input', { className: 'sdb-input', type: 'password', placeholder: 'Password' });
            var sslCheck = el('input', { type: 'checkbox', id: 'sdb-ssl' });

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
            views.connect.appendChild(el('button', {
                className: 'sdb-btn sdb-btn-primary', text: 'Connect to ' + dbLabel,
                onclick: function () {
                    var sslEl = document.getElementById('sdb-ssl-cb');
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
                    }).catch(function (e) { showMsg(e.message, false); });
                },
            }));
        }

        // Encrypt tab
        views.encrypt = el('div');
        if (!connected) {
            views.encrypt.appendChild(el('p', { text: 'Connect your database first to use encryption.', style: 'color:#64748b;font-size:12px' }));
        } else {
            var encInput = el('textarea', { className: 'sdb-input', placeholder: 'Value to encrypt', style: 'min-height:60px;resize:vertical' });
            var algoSelect = el('select', { className: 'sdb-input' });
            Object.keys(algorithms).forEach(function (k) {
                algoSelect.appendChild(el('option', { value: k, text: algorithms[k] }));
            });
            var encResult = el('div', { className: 'sdb-key-box', style: 'display:none' });
            views.encrypt.appendChild(el('label', { className: 'sdb-label', text: 'Encryption Type' }));
            views.encrypt.appendChild(algoSelect);
            views.encrypt.appendChild(el('label', { className: 'sdb-label', text: 'Plaintext' }));
            views.encrypt.appendChild(encInput);
            views.encrypt.appendChild(el('button', {
                className: 'sdb-btn sdb-btn-primary', text: 'Encrypt Value',
                onclick: function () {
                    api('/encrypt', 'POST', { value: encInput.value, algorithm: algoSelect.value }, true)
                        .then(function (d) {
                            encResult.style.display = 'block';
                            encResult.textContent = d.encrypted;
                            showMsg('Encrypted successfully.', true);
                        })
                        .catch(function (e) { showMsg(e.message, false); });
                },
            }));
            views.encrypt.appendChild(encResult);
        }

        // Database encryption tab
        views.database = el('div');
        if (!connected) {
            views.database.appendChild(el('p', { text: 'Connect your database first.', style: 'color:#64748b;font-size:12px' }));
        } else {
            var dbScope = el('select', { className: 'sdb-input' });
            [['database', 'Whole Database'], ['table', 'Single Table']].forEach(function (o) {
                dbScope.appendChild(el('option', { value: o[0], text: o[1] }));
            });
            var dbAlgo = el('select', { className: 'sdb-input' });
            Object.keys(algorithms).forEach(function (k) {
                dbAlgo.appendChild(el('option', { value: k, text: algorithms[k] }));
            });
            var tableInput = el('input', { className: 'sdb-input', placeholder: 'Table name (for table scope)' });
            views.database.appendChild(el('label', { className: 'sdb-label', text: 'Scope' }));
            views.database.appendChild(dbScope);
            views.database.appendChild(el('label', { className: 'sdb-label', text: 'Encryption Type' }));
            views.database.appendChild(dbAlgo);
            views.database.appendChild(el('label', { className: 'sdb-label', text: 'Table Name' }));
            views.database.appendChild(tableInput);
            views.database.appendChild(el('button', {
                className: 'sdb-btn sdb-btn-primary', text: 'Queue Database Encryption',
                onclick: function () {
                    var payload = { scope: dbScope.value, algorithm: dbAlgo.value };
                    if (dbScope.value === 'table') payload.table_name = tableInput.value;
                    api('/encrypt-database', 'POST', payload, true)
                        .then(function (d) { showMsg(d.message || 'Encryption queued.', true); })
                        .catch(function (e) { showMsg(e.message, false); });
                },
            }));
            views.database.appendChild(el('p', { text: 'Runs in background. Email sent when complete.', style: 'font-size:11px;color:#64748b;margin-top:8px' }));
        }

        // Logs tab
        views.logs = el('div');
        var logBox = el('div', { className: 'sdb-log' });
        views.logs.appendChild(logBox);
        views.logs.appendChild(el('button', {
            className: 'sdb-btn sdb-btn-secondary', text: 'Refresh Logs',
            onclick: loadLogs,
        }));
        function loadLogs() {
            api('/audit-logs', 'GET', null, true).then(function (d) {
                logBox.innerHTML = '';
                (d.logs || []).forEach(function (log) {
                    logBox.appendChild(el('div', { className: 'sdb-log-item', html:
                        '<strong>' + log.action + '</strong> ' + (log.success ? '✓' : '✗') + '<br>' +
                        log.description + '<br><span style="color:#94a3b8">' + (log.created_at || '') + '</span>' }));
                });
                if (!(d.logs || []).length) logBox.appendChild(el('div', { className: 'sdb-log-item', text: 'No logs yet.' }));
            }).catch(function (e) { showMsg(e.message, false); });
        }
        loadLogs();

        // Private key tab
        views.key = el('div');
        var keyBox = el('div', { className: 'sdb-key-box', style: 'display:none' });
        var savedKey = localStorage.getItem(STORAGE_PREFIX + 'private_key');
        if (savedKey) { keyBox.style.display = 'block'; keyBox.textContent = savedKey; }
        views.key.appendChild(el('p', { text: 'Generate a one-time private key. Save it securely.', style: 'font-size:12px;color:#64748b;margin:0 0 10px' }));
        views.key.appendChild(keyBox);
        views.key.appendChild(el('button', {
            className: 'sdb-btn sdb-btn-primary', text: savedKey ? 'Regenerate Private Key' : 'Generate Private Key',
            onclick: function () {
                if (savedKey && !confirm('Replace existing key?')) return;
                var arr = new Uint8Array(32);
                crypto.getRandomValues(arr);
                var key = btoa(String.fromCharCode.apply(null, arr));
                localStorage.setItem(STORAGE_PREFIX + 'private_key', key);
                keyBox.style.display = 'block';
                keyBox.textContent = key;
                showMsg('Private key generated.', true);
            },
        }));

        Object.keys(views).forEach(function (k) {
            views[k].style.display = k === active ? 'block' : 'none';
            bodyEl.appendChild(views[k]);
        });

        bodyEl.appendChild(el('button', {
            className: 'sdb-btn sdb-btn-secondary', text: 'Sign Out', style: 'margin-top:12px',
            onclick: function () {
                api('/logout', 'POST', null, true).finally(function () {
                    token = null;
                    connected = false;
                    sessionStorage.removeItem(STORAGE_PREFIX + 'token');
                    renderAuth();
                });
            },
        }));
    }

    function refreshDashboard() {
        api('/connection-status', 'GET', null, true).then(function (status) {
            renderDashboard(status);
        }).catch(function () {
            renderDashboard({ connected: false });
        });
    }

    function openPanel() {
        panel.classList.add('open');
        if (token) {
            api('/config', 'GET', null, true).then(function (d) {
                config = d.widget;
                algorithms = d.algorithms || {};
                refreshDashboard();
            }).catch(function () {
                token = null;
                sessionStorage.removeItem(STORAGE_PREFIX + 'token');
                renderAuth();
            });
        } else {
            renderAuth();
        }
    }

    // Build UI
    panel = el('div', { id: 'defcomm-sdb-panel' });
    panel.appendChild(el('div', { className: 'sdb-hdr', html: '', }, [
        el('span', { text: 'DefComm Secure DB' }),
        el('button', { className: 'sdb-close', text: '×', onclick: function () { panel.classList.remove('open'); } }),
    ]));
    bodyEl = el('div', { className: 'sdb-body' });
    panel.appendChild(bodyEl);

    var btn = el('button', { id: 'defcomm-sdb-btn', title: 'DefComm Secure DB', onclick: openPanel });
    btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';

    document.body.appendChild(panel);
    document.body.appendChild(btn);

    // Restore session
    var savedToken = sessionStorage.getItem(STORAGE_PREFIX + 'token');
    if (savedToken) token = savedToken;
})();
