'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load: function() {
		return uci.load('olcrtc-tun');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('olcrtc-tun', _('olcRTC TUN bridge'),
			_('Brings up a TUN interface forwarding packets into the local olcRTC SOCKS5 endpoint.'));

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

		return m.render();
	}
});
