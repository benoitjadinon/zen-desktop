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
        shellHook = "export MOZ_LIBCLANG_PATH=" + toString pkgs.llvmPackages.libclang.lib + "/lib; export MOZCONFIG=\"$(git rev-parse --show-toplevel)/.nix/mozconfig\"";
        packages = with pkgs; [ git gnumake pkg-config nodejs_22 python3 gcc llvmPackages.clang-unwrapped llvm rustc cargo autoconf perl nasm yasm ninja ccache gtk3 glib dbus libx11 libxcb libXtst alsa-lib libGL ffmpeg_8 libva pipewire p11-kit ];
      };
    };
}
