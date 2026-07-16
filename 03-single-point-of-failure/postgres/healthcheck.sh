#!/bin/bash
apk add --no-cache socat > /dev/null 2>&1

handle_request() {
  read -r REQUEST_LINE
  while read -r header && [ "$header" != $'\r' ] && [ -n "$header" ]; do :; done

  if pg_isready -U admin -d ecommerce -q 2>/dev/null; then
    IS_REPLICA=$(psql -U admin -d ecommerce -tAc "SELECT pg_is_in_recovery();" 2>/dev/null)
    if [ "$IS_REPLICA" = "f" ]; then
      BODY="primary"
      STATUS="200 OK"
    else
      BODY="replica"
      STATUS="503 Service Unavailable"
    fi
  else
    BODY="down"
    STATUS="503 Service Unavailable"
  fi

  printf "HTTP/1.1 %s\r\nContent-Length: %d\r\nConnection: close\r\n\r\n%s" \
    "$STATUS" "${#BODY}" "$BODY"
}

export -f handle_request

socat TCP-LISTEN:8008,fork,reuseaddr SYSTEM:'bash -c handle_request'
