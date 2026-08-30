# Pi checks for updates separately.
export PI_SKIP_VERSION_CHECK=1

pi() {
  if [[ ${1:-} == update ]]; then
    shift
    pi-update "$@"
  else
    command pi "$@"
  fi
}
