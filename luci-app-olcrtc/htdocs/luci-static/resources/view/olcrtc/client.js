'use strict';
'require view';
'require form';
'require rpc';
'require uci';

return view.extend({
	load: function() {
		return uci.load('olcrtc');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('olcrtc', _('olcRTC client'),
			_('WebRTC-tunneled SOCKS5 proxy client. Get room_id/key from your server operator.'));

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

		o = s.option(form.Value, 'room_id',   _('Room ID'));
		o.rmempty = false;

		o = s.option(form.Value, 'client_id', _('Client ID'));
		o.default = 'default';

		o = s.option(form.Value, 'key',       _('Encryption key (hex)'));
		o.password = true;
		o.rmempty = false;

		o = s.option(form.Value, 'dns',        _('Egress DNS'));
		o.default = '1.1.1.1:53';

		o = s.option(form.Value, 'socks_host', _('SOCKS5 bind host'));
		o.default = '127.0.0.1';

		o = s.option(form.Value, 'socks_port', _('SOCKS5 bind port'));
		o.datatype = 'port';
		o.default = '8808';

		o = s.option(form.Value, 'socks_user', _('SOCKS5 username (optional)'));
		o = s.option(form.Value, 'socks_pass', _('SOCKS5 password (optional)'));
		o.password = true;

		return m.render();
	}
});
