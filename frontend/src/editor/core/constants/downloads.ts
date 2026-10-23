// Centralized download URLs for iLikePdf desktop installers
export const DOWNLOAD_URLS = {
  WINDOWS: "/downloads/win-installer.exe",
  WINDOWS_ARM64: "/downloads/win-arm64-installer.exe",
  MAC: "/downloads/mac-installer.dmg",
  LINUX_DEB: "/downloads/linux-installer.deb",
  LINUX_RPM: "/downloads/linux-installer.rpm",
  LINUX_APPIMAGE: "/downloads/linux-installer.AppImage",
  LINUX_DOCS: "/downloads",
} as const;

export const DOWNLOAD_BASE_URL = "/downloads/";