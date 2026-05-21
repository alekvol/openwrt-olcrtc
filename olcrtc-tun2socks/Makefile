#
# Copyright (C) 2026 alekvol
# Licensed under MIT
#

include $(TOPDIR)/rules.mk

PKG_NAME:=olcrtc-tun2socks
PKG_VERSION:=0.1.2
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=alekvol

include $(INCLUDE_DIR)/package.mk

define Package/olcrtc-tun2socks
  SECTION:=net
  CATEGORY:=Network
  TITLE:=TUN-to-SOCKS5 bridge for olcrtc (hev-socks5-tunnel wrapper)
  URL:=https://github.com/alekvol/openwrt-olcrtc
  DEPENDS:=+olcrtc +hev-socks5-tunnel +kmod-tun +ip-full
  PKGARCH:=all
endef

define Package/olcrtc-tun2socks/description
  Brings up a TUN interface that forwards all packets to the local
  olcrtc SOCKS5 endpoint via hev-socks5-tunnel. Configurable via
  /etc/config/olcrtc-tun.
endef

define Package/olcrtc-tun2socks/conffiles
/etc/config/olcrtc-tun
endef

define Build/Compile
endef

define Package/olcrtc-tun2socks/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/olcrtc-tun.init $(1)/etc/init.d/olcrtc-tun

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/olcrtc-tun.config $(1)/etc/config/olcrtc-tun

	$(INSTALL_DIR) $(1)/usr/share/olcrtc-tun
	$(INSTALL_DATA) ./files/tunnel.yaml.template $(1)/usr/share/olcrtc-tun/tunnel.yaml.template
endef

$(eval $(call BuildPackage,olcrtc-tun2socks))
