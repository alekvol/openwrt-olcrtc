'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';
'require dom';
'require fs';

/* ── URI parser ──────────────────────────────────────────────
 * Format: olcrtc://<Carrier>?<Transport><key=value&...>@<RoomID>#<Key>%<ClientID>$<MIMO>
 * Angle-bracket payload is optional.
 */
function parseOlcrtcUri(uri) {
	uri = (uri || '').trim();
	if (uri.indexOf('olcrtc://') !== 0)
		return null;

	var body = uri.substring(9); /* after olcrtc:// */
	var result = {};

	/* carrier — everything before '?' */
	var qIdx = body.indexOf('?');
	if (qIdx < 0) return null;
	result.carrier = body.substring(0, qIdx);
	body = body.substring(qIdx + 1);

	/* transport — up to '<' (payload) or '@' */
	var aIdx = body.indexOf('<');
	var atIdx = body.indexOf('@');
	if (atIdx < 0) return null;

	if (aIdx >= 0 && aIdx < atIdx) {
		result.transport = body.substring(0, aIdx);
		var closeIdx = body.indexOf('>');
		if (closeIdx > aIdx) {
			var payload = body.substring(aIdx + 1, closeIdx);
			result.transport_params = {};
			payload.split('&').forEach(function(kv) {
				var eq = kv.indexOf('=');
				if (eq > 0) {
					result.transport_params[kv.substring(0, eq)] = kv.substring(eq + 1);
				}
			});
			body = body.substring(closeIdx + 1);
			/* skip leading '@' after '>' */
			if (body.charAt(0) === '@') body = body.substring(1);
		} else {
			body = body.substring(atIdx + 1);
		}
	} else {
		result.transport = body.substring(0, atIdx);
		body = body.substring(atIdx + 1);
	}

	/* room_id — up to '#' */
	var hIdx = body.indexOf('#');
	if (hIdx < 0) {
		result.room_id = body;
		return result;
	}
	result.room_id = body.substring(0, hIdx);
	body = body.substring(hIdx + 1);

	/* key — up to '%' */
	var pIdx = body.indexOf('%');
	if (pIdx < 0) {
		result.key = body;
		return result;
	}
	result.key = body.substring(0, pIdx);
	body = body.substring(pIdx + 1);

	/* client_id — up to '$' */
	var dIdx = body.indexOf('$');
	if (dIdx < 0) {
		result.client_id = body;
		return result;
	}
	result.client_id = body.substring(0, dIdx);
	result.mimo = body.substring(dIdx + 1);
	return result;
}

/* ── Subscription parser ─────────────────────────────────── */
function parseSubscription(text) {
	var lines = (text || '').split('\n');
	var sub = { name: '', refresh: '', servers: [] };
	var current = null;

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].trim();
		if (!line) continue;

		if (line.indexOf('##') === 0 && current) {
			var kv = line.substring(2).trim();
			var col = kv.indexOf(':');
			if (col > 0) {
				var k = kv.substring(0, col).trim();
				var v = kv.substring(col + 1).trim();
				current.meta[k] = v;
			}
		} else if (line.indexOf('#') === 0 && line.indexOf('##') !== 0) {
			var kv2 = line.substring(1).trim();
			var col2 = kv2.indexOf(':');
			if (col2 > 0) {
				var k2 = kv2.substring(0, col2).trim();
				var v2 = kv2.substring(col2 + 1).trim();
				sub[k2] = v2;
			}
		} else if (line.indexOf('olcrtc://') === 0) {
			current = { uri: line, meta: {}, parsed: parseOlcrtcUri(line) };
			sub.servers.push(current);
		}
	}
	return sub;
}

/* ── Compatibility matrix data ───────────────────────────── */
var compatMatrix = {
	telemost:  { datachannel: true, videochannel: true, seichannel: true,  vp8channel: true  },
	jazz:      { datachannel: true, videochannel: true, seichannel: true,  vp8channel: true  },
	wbstream:  { datachannel: true, videochannel: true, seichannel: true,  vp8channel: true  }
};

return view.extend({
	load: function() {
		return uci.load('olcrtc');
	},

	render: function() {
		var m, s, o;
		var self = this;

		m = new form.Map('olcrtc', _('olcRTC client'),
			_('WebRTC-tunneled SOCKS5 proxy client. Get room_id/key from your server operator.'));

		/* ══════════════════════════════════════════════════════
		 *  URI IMPORT / SUBSCRIPTION SECTION
		 * ══════════════════════════════════════════════════════ */
		s = m.section(form.NamedSection, 'main', 'olcrtc', _('Quick Connect'));

		o = s.option(form.DummyValue, '_uri_import', _('Import URI / Subscription'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return E('div', {}, [
				E('div', { 'style': 'display:flex;gap:8px;margin-bottom:8px;' }, [
					E('input', {
						'id':          'olcrtc-uri-input',
						'type':        'text',
						'class':       'cbi-input-text',
						'placeholder': 'olcrtc://... ' + _('or') + ' https://... ' + _('subscription URL'),
						'style':       'flex:1;font-family:monospace;'
					}),
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'click': function() {
							var input = document.getElementById('olcrtc-uri-input');
							var val = (input ? input.value : '').trim();
							if (!val) return;

							if (val.indexOf('olcrtc://') === 0) {
								/* Direct URI import */
								var parsed = parseOlcrtcUri(val);
								if (!parsed || !parsed.carrier) {
									ui.addNotification(null, E('p', _('Invalid olcrtc:// URI format')), 'error');
									return;
								}
								self._applyParsedUri(parsed);
								ui.addNotification(null, E('p', _('URI imported. Review settings and click Save & Apply.')), 'info');

							} else if (val.indexOf('http://') === 0 || val.indexOf('https://') === 0) {
								/* Subscription URL */
								var btn = this;
								btn.disabled = true;
								btn.textContent = _('Loading…');
								fs.exec_direct('/usr/bin/wget', ['-qO-', val]).then(function(res) {
									btn.disabled = false;
									btn.textContent = _('Import');
									var sub = parseSubscription(res);
									if (!sub.servers.length) {
										ui.addNotification(null, E('p', _('No servers found in subscription')), 'warning');
										return;
									}
									self._renderSubscriptionCards(sub);
								}).catch(function(e) {
									btn.disabled = false;
									btn.textContent = _('Import');
									ui.addNotification(null, E('p', _('Failed to fetch subscription: ') + e.message), 'error');
								});
							} else {
								ui.addNotification(null, E('p', _('Enter an olcrtc:// URI or https:// subscription URL')), 'warning');
							}
						}
					}, _('Import'))
				]),
				E('div', { 'id': 'olcrtc-sub-cards', 'style': 'margin-top:8px;' })
			]).outerHTML;
		};

		/* ══════════════════════════════════════════════════════
		 *  MAIN SETTINGS
		 * ══════════════════════════════════════════════════════ */
		s = m.section(form.TypedSection, 'olcrtc', _('Instance'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'carrier', _('Carrier'));
		o.value('telemost', 'Telemost');
		o.value('jazz',     'Jazz');
		o.value('wbstream', 'WBStream');
		o.default = 'wbstream';

		o = s.option(form.ListValue, 'transport', _('Transport'));
		o.value('datachannel',  'datachannel');
		o.value('videochannel', 'videochannel');
		o.value('seichannel',   'seichannel');
		o.value('vp8channel',   'vp8channel');
		o.default = 'datachannel';

		/* ── Compatibility hint ─────────────────────────────── */
		o = s.option(form.DummyValue, '_compat', _('Compatibility'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var rows = '';
			var carriers = ['telemost', 'jazz', 'wbstream'];
			var transports = ['datachannel', 'videochannel', 'seichannel', 'vp8channel'];
			rows += '<tr><th></th>';
			for (var t = 0; t < transports.length; t++)
				rows += '<th style="padding:4px 8px;font-size:0.85em;">' + transports[t] + '</th>';
			rows += '</tr>';
			for (var c = 0; c < carriers.length; c++) {
				rows += '<tr><td style="font-weight:bold;padding:4px 8px;">' + carriers[c] + '</td>';
				for (var t2 = 0; t2 < transports.length; t2++) {
					var ok = compatMatrix[carriers[c]][transports[t2]];
					rows += '<td style="text-align:center;padding:4px 8px;">' +
						(ok ? '<span style="color:#00a000;">✓</span>' : '<span style="color:#c00;">✗</span>') +
						'</td>';
				}
				rows += '</tr>';
			}
			return '<table class="table" style="width:auto;margin:4px 0;">' + rows + '</table>';
		};

		o = s.option(form.ListValue, 'link', _('Link mode'));
		o.value('direct', 'direct');
		o.default = 'direct';

		o = s.option(form.Value, 'room_id',   _('Room ID'));
		o.rmempty = false;

		o = s.option(form.Value, 'client_id', _('Client ID'));
		o.default = 'default';

		o = s.option(form.Value, 'key', _('Encryption key (hex)'));
		o.password = true;
		o.rmempty = false;

		o = s.option(form.Value, 'dns', _('Egress DNS'));
		o.default = '1.1.1.1:53';

		o = s.option(form.Value, 'socks_host', _('SOCKS5 bind host'));
		o.default = '127.0.0.1';

		o = s.option(form.Value, 'socks_port', _('SOCKS5 bind port'));
		o.datatype = 'port';
		o.default = '8808';

		o = s.option(form.Value, 'socks_user', _('SOCKS5 username (optional)'));
		o = s.option(form.Value, 'socks_pass', _('SOCKS5 password (optional)'));
		o.password = true;

		/* ══════════════════════════════════════════════════════
		 *  TRANSPORT-SPECIFIC OPTIONS
		 * ══════════════════════════════════════════════════════ */

		/* ── videochannel ───────────────────────────────────── */
		o = s.option(form.Value, 'video_w', _('Video width'));
		o.default = '1920';
		o.depends('transport', 'videochannel');

		o = s.option(form.Value, 'video_h', _('Video height'));
		o.default = '1080';
		o.depends('transport', 'videochannel');

		o = s.option(form.Value, 'video_fps', _('Video FPS'));
		o.default = '30';
		o.datatype = 'uinteger';
		o.depends('transport', 'videochannel');

		o = s.option(form.Value, 'video_bitrate', _('Video bitrate'));
		o.default = '2M';
		o.depends('transport', 'videochannel');

		o = s.option(form.ListValue, 'video_hw', _('Hardware acceleration'));
		o.value('none', 'none');
		o.value('vaapi', 'vaapi');
		o.value('nvenc', 'nvenc');
		o.default = 'none';
		o.depends('transport', 'videochannel');

		o = s.option(form.ListValue, 'video_codec', _('Video codec'));
		o.value('qrcode', 'qrcode');
		o.value('tile', 'tile');
		o.default = 'qrcode';
		o.depends('transport', 'videochannel');

		o = s.option(form.ListValue, 'video_qr_recovery', _('QR error recovery'));
		o.value('low', 'low');
		o.value('medium', 'medium');
		o.value('quartile', 'quartile');
		o.value('high', 'high');
		o.default = 'medium';
		o.depends('video_codec', 'qrcode');

		o = s.option(form.Value, 'video_qr_size', _('QR code size (0=auto)'));
		o.default = '0';
		o.datatype = 'uinteger';
		o.depends('video_codec', 'qrcode');

		o = s.option(form.Value, 'video_tile_module', _('Tile module'));
		o.default = '4';
		o.datatype = 'uinteger';
		o.depends('video_codec', 'tile');

		o = s.option(form.Value, 'video_tile_rs', _('Tile Reed-Solomon'));
		o.default = '20';
		o.datatype = 'uinteger';
		o.depends('video_codec', 'tile');

		/* ── vp8channel ─────────────────────────────────────── */
		o = s.option(form.Value, 'vp8_fps', _('VP8 FPS'));
		o.default = '25';
		o.datatype = 'uinteger';
		o.depends('transport', 'vp8channel');

		o = s.option(form.Value, 'vp8_batch', _('VP8 batch size'));
		o.default = '1';
		o.datatype = 'uinteger';
		o.depends('transport', 'vp8channel');

		/* ── seichannel ─────────────────────────────────────── */
		o = s.option(form.Value, 'sei_fps', _('SEI FPS'));
		o.default = '20';
		o.datatype = 'uinteger';
		o.depends('transport', 'seichannel');

		o = s.option(form.Value, 'sei_batch', _('SEI batch size'));
		o.default = '1';
		o.datatype = 'uinteger';
		o.depends('transport', 'seichannel');

		o = s.option(form.Value, 'sei_frag', _('SEI fragment size'));
		o.default = '900';
		o.datatype = 'uinteger';
		o.depends('transport', 'seichannel');

		o = s.option(form.Value, 'sei_ack_ms', _('SEI ACK timeout (ms)'));
		o.default = '3000';
		o.datatype = 'uinteger';
		o.depends('transport', 'seichannel');

		/* ══════════════════════════════════════════════════════
		 *  WATCHDOG
		 * ══════════════════════════════════════════════════════ */
		s = m.section(form.NamedSection, 'watchdog', 'watchdog', _('Watchdog'),
			_('Restart olcrtc if it cannot reach the probe URL through its own SOCKS5.'));
		s.anonymous = true;

		o = s.option(form.Flag,  'enabled',   _('Watchdog enabled'));
		o = s.option(form.Value, 'probe_url', _('Probe URL'));
		o.default = 'https://www.google.com/generate_204';
		o = s.option(form.Value, 'interval',  _('Probe interval (s)'));
		o.datatype = 'uinteger';
		o.default = '30';
		o = s.option(form.Value, 'timeout',   _('Probe timeout (s)'));
		o.datatype = 'uinteger';
		o.default = '10';
		o = s.option(form.Value, 'max_fails', _('Consecutive failures before restart'));
		o.datatype = 'uinteger';
		o.default = '3';

		return m.render();
	},

	/* ── Helper: apply parsed URI fields to UCI ──────────── */
	_applyParsedUri: function(p) {
		if (p.carrier)   uci.set('olcrtc', 'main', 'carrier',   p.carrier);
		if (p.transport) uci.set('olcrtc', 'main', 'transport', p.transport);
		if (p.room_id)   uci.set('olcrtc', 'main', 'room_id',  p.room_id);
		if (p.key)       uci.set('olcrtc', 'main', 'key',       p.key);
		if (p.client_id) uci.set('olcrtc', 'main', 'client_id', p.client_id);

		/* Apply transport-specific params */
		if (p.transport_params) {
			var tp = p.transport_params;
			for (var k in tp) {
				if (tp.hasOwnProperty(k)) {
					uci.set('olcrtc', 'main', k, tp[k]);
				}
			}
		}
	},

	/* ── Helper: render subscription server cards ────────── */
	_renderSubscriptionCards: function(sub) {
		var container = document.getElementById('olcrtc-sub-cards');
		if (!container) return;

		var self = this;
		var title = sub.name ? sub.name : _('Subscription');
		var nodes = [
			E('h4', { 'style': 'margin:8px 0 4px;' }, title),
			sub.refresh ? E('p', { 'style': 'color:#888;font-size:0.85em;margin:0 0 8px;' },
				_('Refresh: ') + sub.refresh) : ''
		];

		for (var i = 0; i < sub.servers.length; i++) {
			(function(srv, idx) {
				var name = srv.meta.name || (_('Server') + ' ' + (idx + 1));
				var comment = srv.meta.comment || '';
				var ip = srv.meta.ip || '';
				var color = srv.meta.color || '#3a7bd5';
				var p = srv.parsed || {};

				var info = [];
				if (p.carrier)   info.push(p.carrier);
				if (p.transport) info.push(p.transport);
				if (ip) info.push(ip);

				var card = E('div', {
					'style': 'display:inline-block;border:2px solid ' + color +
						';border-radius:8px;padding:10px 16px;margin:4px 8px 4px 0;' +
						'cursor:pointer;min-width:180px;transition:all 0.2s;' +
						'background:rgba(58,123,213,0.05);',
					'click': function() {
						if (p) {
							self._applyParsedUri(p);
							ui.addNotification(null, E('p',
								_('Server "%s" applied. Review settings and click Save & Apply.').replace('%s', name)),
								'info');
						}
					},
					'mouseover': function() { this.style.background = 'rgba(58,123,213,0.15)'; },
					'mouseout':  function() { this.style.background = 'rgba(58,123,213,0.05)'; }
				}, [
					E('strong', { 'style': 'display:block;color:' + color + ';' }, name),
					E('span', { 'style': 'font-size:0.85em;color:#666;' }, info.join(' · ')),
					comment ? E('div', { 'style': 'font-size:0.8em;color:#888;margin-top:2px;' }, comment) : ''
				]);

				nodes.push(card);
			})(sub.servers[i], i);
		}

		dom.content(container, nodes);
	}
});
