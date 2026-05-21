#
# Copyright (C) 2026 alekvol
# Licensed under MIT
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-olcrtc
PKG_VERSION:=0.1.2
PKG_RELEASE:=1

LUCI_TITLE:=LuCI support for olcRTC client
LUCI_DEPENDS:=+olcrtc +olcrtc-tun2socks
LUCI_PKGARCH:=all

PKG_MAINTAINER:=alekvol
PKG_LICENSE:=MIT

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
