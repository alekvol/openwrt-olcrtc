'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';

var callOlcrtcGetFirewallStatus = rpc.declare({
	object: 'olcrtc',
	method: 'getFirewallStatus',
	expect: {}
});

var callOlcrtcSetupFirewall = rpc.declare({
	object: 'olcrtc',
	method: 'setupFirewall',
	expect: {}
});

var callOlcrtcRemoveFirewall = rpc.declare({
	object: 'olcrtc',
	method: 'removeFirewall',
	expect: {}
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('olcrtc-tun'),
			callOlcrtcGetFirewallStatus()
		]);
	},

	render: function(data) {
		var fwStatus = data[1] || {};
		var m, s, o;

		m = new form.Map('olcrtc-tun', _('olcRTC TUN bridge'),
			_('Brings up a TUN interface forwarding packets into the local olcRTC SOCKS5 endpoint.'));

		/* ── Firewall Auto-Setup Section ─────────────────────── */
		s = m.section(form.NamedSection, 'main', 'tunnel', _('Firewall & Routing'));

		o = s.option(form.DummyValue, '_fw_status', _('Firewall status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (fwStatus.configured) {
				return '<span style="color:#00a000;font-weight:bold;">✓ ' + _('Configured') + '</span>' +
					' — ' + _('Zone "olc", forwarding lan→olc, network interface olctun');
			}
			return '<span style="color:#c00;font-weight:bold;">✗ ' + _('Not configured') + '</span>' +
				' — ' + _('Firewall zone and routing rules are not set up');
		};

		o = s.option(form.Button, '_setup_fw', _('Auto-configure firewall'));
		o.inputtitle = fwStatus.configured ? _('Reconfigure') : _('Setup firewall & routing');
		o.inputstyle = fwStatus.configured ? 'reset' : 'apply';
		o.onclick = function() {
			return callOlcrtcSetupFirewall().then(function() {
				ui.addNotification(null, E('p', _('Firewall configured successfully. Network and firewall services reloaded.')), 'info');
				window.setTimeout(function() { location.reload(); }, 2000);
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to configure firewall: ') + e.message), 'error');
			});
		};

		if (fwStatus.configured) {
			o = s.option(form.Button, '_remove_fw', _('Remove firewall rules'));
			o.inputtitle = _('Remove zone & routing');
			o.inputstyle = 'remove';
			o.onclick = function() {
				return ui.showModal(_('Confirm removal'), [
					E('p', _('This will remove the firewall zone "olc", forwarding rule, and network interface "olctun". LAN clients will no longer be routed through the tunnel.')),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button',
							'click': ui.hideModal
						}, _('Cancel')),
						' ',
						E('button', {
							'class': 'cbi-button cbi-button-negative',
							'click': function() {
								ui.hideModal();
								return callOlcrtcRemoveFirewall().then(function() {
									ui.addNotification(null, E('p', _('Firewall rules removed.')), 'info');
									window.setTimeout(function() { location.reload(); }, 2000);
								});
							}
						}, _('Remove'))
					])
				]);
			};
		}

		/* ── Tunnel Settings Section ─────────────────────────── */
		s = m.section(form.TypedSection, 'tunnel', _('Tunnel'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag,  'enabled',   _('Enabled'));
		o = s.option(form.Value, 'tun_name',  _('TUN interface name'));
		o.default = 'olctun';
		o = s.option(form.Value, 'tun_ipv4',  _('TUN IPv4 address'));
		o.default = '198.18.0.1';
		o = s.option(form.Value, 'tun_mask',  _('TUN IPv4 netmask (CIDR)'));
		o.default = '15';
		o = s.option(form.Value, 'mtu',       _('MTU'));
		o.default = '1400';
		o = s.option(form.Value, 'socks_host', _('SOCKS5 upstream host'));
		o.default = '127.0.0.1';
		o = s.option(form.Value, 'socks_port', _('SOCKS5 upstream port'));
		o.default = '8808';
		o = s.option(form.Value, 'socks_user', _('SOCKS5 username (optional)'));
		o = s.option(form.Value, 'socks_pass', _('SOCKS5 password (optional)'));
		o.password = true;
		o = s.option(form.ListValue, 'log_level', _('Log level'));
		[ 'debug', 'info', 'warn', 'error' ].forEach(function(v) { o.value(v); });
		o.default = 'warn';

		o = s.option(form.Flag,  'auto_route', _('Auto-route LAN through tunnel'),
			_('Adds an ip rule sending packets from LAN bridge to the tunnel routing table on start.'));
		o = s.option(form.Value, 'lan_iface',  _('LAN interface'));
		o.default = 'br-lan';
		o.depends('auto_route', '1');

		return m.render();
	}
});
