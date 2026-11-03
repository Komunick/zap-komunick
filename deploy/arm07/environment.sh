#!/usr/bin/env bash
# Source only this reviewed file, never .env. Profiles are deliberately closed.
arm07_profile() {
    case "$1" in
        production)
            profile=production; project=superchat; domain=superchat.komunick.com
            http_port=5480; edge_prefix=172.29.251; internal_prefix=172.29.252 ;;
        development)
            profile=development; project=superchatdev; domain=superchatdev.komunick.com
            http_port=5481; edge_prefix=172.29.249; internal_prefix=172.29.250 ;;
        *) printf 'Ambiente invalido: use production ou development.\n' >&2; return 2 ;;
    esac
}
