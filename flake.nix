{
  description = "Pinned development environment for this project";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
      devShells.${system}.default = pkgs.mkShell {
        inputsFrom = [ pkgs.firefox-unwrapped ];
        shellHook = "export MOZ_LIBCLANG_PATH=" + toString pkgs.llvmPackages.libclang.lib + "/lib; export LD_LIBRARY_PATH=\"" + toString pkgs.vips.out + "/lib:" + toString pkgs.glib.out + "/lib:\${LD_LIBRARY_PATH:-}\"; export BINDGEN_CFLAGS=\"-isystem " + toString pkgs.stdenv.cc.cc + "/include/c++/" + pkgs.gcc.version + " -isystem " + toString pkgs.stdenv.cc.cc + "/include/c++/" + pkgs.gcc.version + "/x86_64-unknown-linux-gnu -isystem " + toString pkgs.glibc.dev + "/include\"; export NIX_CFLAGS_COMPILE=\"-Wformat $(pkg-config --cflags x11 xext xcomposite xfixes xcursor xdamage xi xrandr xrender wayland-client wayland-server wayland-cursor wayland-egl xkbcommon xcb fontconfig)\"; export MOZCONFIG=\"$(git rev-parse --show-toplevel)/.nix/mozconfig\"";
      packages = with pkgs; [ git gnumake pkg-config nodejs_22 (python3.withPackages (ps: [ ps.requests ])) vips gcc llvmPackages.clang-unwrapped llvm rustc cargo autoconf perl nasm yasm ninja ccache gtk3 glib dbus libx11 libxcb libXtst alsa-lib libGL ffmpeg_8 libva pipewire p11-kit ];
      };
    };
}
