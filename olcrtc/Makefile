#
# Copyright (C) 2026 alekvol
# Licensed under MIT
#

include $(TOPDIR)/rules.mk

PKG_NAME:=olcrtc
PKG_VERSION:=0.1.0
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/alekvol/olcrtc.git
PKG_SOURCE_VERSION:=master
PKG_SOURCE_DATE:=2026-05-18
PKG_MIRROR_HASH:=skip

PKG_LICENSE:=WTFPL
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=alekvol

PKG_BUILD_DEPENDS:=golang/host
PKG_BUILD_PARALLEL:=1
PKG_USE_MIPS16:=0

GO_PKG:=github.com/openlibrecommunity/olcrtc
GO_PKG_BUILD_PKG:=github.com/openlibrecommunity/olcrtc/cmd/olcrtc

# Уменьшаем размер бинарника
GO_PKG_LDFLAGS:=-s -w
GO_PKG_LDFLAGS_X:=

include $(INCLUDE_DIR)/package.mk
include ../../lang/golang/golang-package.mk

define Package/olcrtc
  SECTION:=net
  CATEGORY:=Network
  TITLE:=olcRTC WebRTC tunneling client (SOCKS5)
  URL:=https://github.com/openlibrecommunity/olcrtc
  DEPENDS:=$(GO_ARCH_DEPENDS) +ca-bundle +curl
endef

define Package/olcrtc/description
  olcRTC is a WebRTC-tunneled SOCKS5 proxy client that piggy-backs on
  unblocked WebRTC services (telemost / jazz / wbstream).
  This package installs only the client (-mode cnc) and exposes a local
  SOCKS5 endpoint controlled via UCI /etc/config/olcrtc.
endef

define Package/olcrtc/conffiles
/etc/config/olcrtc
endef

define Package/olcrtc/install
	$(call GoPackage/Package/Install/Bin,$(1))

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/olcrtc.init $(1)/etc/init.d/olcrtc

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/olcrtc.config $(1)/etc/config/olcrtc

	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./files/olcrtc-watchdog.sh $(1)/usr/libexec/olcrtc-watchdog.sh

	$(INSTALL_DIR) $(1)/usr/share/olcrtc/data
endef

$(eval $(call GoBinPackage,olcrtc))
$(eval $(call BuildPackage,olcrtc))
