'use strict';
'require view';
'require dom';
'require poll';
'require rpc';
'require ui';

var callGetStatus = rpc.declare({
	object: 'olcrtc',
	method: 'getStatus',
	expect: {}
});

var callGetLogs = rpc.declare({
	object: 'olcrtc',
	method: 'getLogs',
	params: ['lines'],
	expect: {}
});

var callServiceAction = rpc.declare({
	object: 'olcrtc',
	method: 'serviceAction',
	params: ['action'],
	expect: {}
});

function formatUptime(seconds) {
	if (!seconds || seconds <= 0)
		return '-';
	var d = Math.floor(seconds / 86400);
	var h = Math.floor((seconds % 86400) / 3600);
	var m = Math.floor((seconds % 3600) / 60);
	var s = seconds % 60;
	var parts = [];
	if (d > 0) parts.push(d + 'd');
	if (h > 0) parts.push(h + 'h');
	if (m > 0) parts.push(m + 'm');
	parts.push(s + 's');
	return parts.join(' ');
}

function makeStatusBadge(running) {
	var color = running ? '#00a000' : '#c00';
	var text  = running ? _('Running') : _('Stopped');
	var icon  = running ? '●' : '●';
	return E('span', { 'style': 'color:' + color + ';font-weight:bold;font-size:1.1em;' }, icon + ' ' + text);
}

function makeBtn(label, style, action, busyMsg) {
	return E('button', {
		'class': 'cbi-button cbi-button-' + style,
		'click': function(ev) {
			var btn = ev.target;
			btn.disabled = true;
			btn.textContent = busyMsg || '...';
			callServiceAction(action).then(function() {
				window.setTimeout(function() { location.reload(); }, 2500);
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Error: ') + e.message), 'error');
				btn.disabled = false;
				btn.textContent = label;
			});
		}
	}, label);
}

return view.extend({
	load: function() {
		return Promise.all([
			callGetStatus(),
			callGetLogs(80)
		]);
	},

	render: function(data) {
		var st   = data[0] || {};
		var logs = (data[1] || {}).logs || '';

		var statusRows = E('table', { 'class': 'table', 'style': 'width:100%;' }, [
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'width:200px;font-weight:bold;' }, _('olcRTC client')),
				E('td', { 'class': 'td' }, makeStatusBadge(st.olcrtc_running))
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'font-weight:bold;' }, _('TUN bridge')),
				E('td', { 'class': 'td' }, makeStatusBadge(st.tun_running))
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'font-weight:bold;' }, _('PID')),
				E('td', { 'class': 'td' }, st.olcrtc_pid || '-')
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'font-weight:bold;' }, _('Uptime')),
				E('td', { 'class': 'td' }, formatUptime(st.uptime))
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'font-weight:bold;' }, _('External IP')),
				E('td', { 'class': 'td' }, st.external_ip || _('N/A'))
			])
		]);

		/* ── Service Control ────────────────────────────────── */
		var btnAll = E('div', { 'style': 'margin:8px 0 4px;' }, [
			E('strong', {}, _('All services') + ': '),
			makeBtn(_('Start all'), 'apply', 'start_all', _('Starting…')),
			' ',
			makeBtn(_('Stop all'), 'reset', 'stop_all', _('Stopping…')),
			' ',
			makeBtn(_('Restart all'), 'action', 'restart_all', _('Restarting…'))
		]);

		var btnOlc = E('div', { 'style': 'margin:4px 0;' }, [
			E('strong', {}, _('olcRTC client') + ': '),
			makeBtn(_('Start'), 'apply', 'start', _('Starting…')),
			' ',
			makeBtn(_('Stop'), 'reset', 'stop', _('Stopping…')),
			' ',
			makeBtn(_('Restart'), 'action', 'restart', _('Restarting…'))
		]);

		var btnTun = E('div', { 'style': 'margin:4px 0;' }, [
			E('strong', {}, _('TUN bridge') + ': '),
			makeBtn(_('Start'), 'apply', 'start_tun', _('Starting…')),
			' ',
			makeBtn(_('Stop'), 'reset', 'stop_tun', _('Stopping…')),
			' ',
			makeBtn(_('Restart'), 'action', 'restart_tun', _('Restarting…'))
		]);

		/* ── Log viewer ─────────────────────────────────────── */
		var logBox = E('pre', {
			'id': 'olcrtc-log-box',
			'style': 'background:#1a1a2e;color:#e0e0e0;padding:10px;' +
				'font-family:monospace;font-size:12px;line-height:1.4;' +
				'max-height:400px;overflow-y:auto;white-space:pre-wrap;' +
				'word-break:break-all;border-radius:4px;border:1px solid #333;'
		}, logs || _('No log entries.'));

		/* auto-scroll to bottom */
		window.setTimeout(function() {
			var el = document.getElementById('olcrtc-log-box');
			if (el) el.scrollTop = el.scrollHeight;
		}, 100);

		/* ── Poll for live refresh ──────────────────────────── */
		poll.add(function() {
			return Promise.all([callGetStatus(), callGetLogs(80)]).then(function(res) {
				var s = res[0] || {};
				var l = (res[1] || {}).logs || '';

				/* update status table */
				var table = document.querySelector('#olcrtc-status-table');
				if (table) {
					var cells = table.querySelectorAll('td.td:nth-child(2)');
					if (cells.length >= 5) {
						dom.content(cells[0], makeStatusBadge(s.olcrtc_running));
						dom.content(cells[1], makeStatusBadge(s.tun_running));
						dom.content(cells[2], s.olcrtc_pid || '-');
						dom.content(cells[3], formatUptime(s.uptime));
						dom.content(cells[4], s.external_ip || _('N/A'));
					}
				}

				/* update logs */
				var lb = document.getElementById('olcrtc-log-box');
				if (lb) {
					var atBottom = (lb.scrollHeight - lb.scrollTop - lb.clientHeight) < 40;
					lb.textContent = l || _('No log entries.');
					if (atBottom) lb.scrollTop = lb.scrollHeight;
				}
			});
		}, 5);

		statusRows.id = 'olcrtc-status-table';

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('olcRTC — Status')),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', { 'class': 'cbi-section-title' }, _('Service Status')),
				E('div', { 'class': 'cbi-section-node' }, statusRows)
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', { 'class': 'cbi-section-title' }, _('Service Control')),
				E('div', { 'class': 'cbi-section-node' }, [btnAll, btnOlc, btnTun])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', { 'class': 'cbi-section-title' }, _('Logs')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('p', { 'style': 'color:#888;font-size:0.9em;' },
						_('Auto-refreshes every 5 seconds. Last 80 lines.')),
					logBox
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});
