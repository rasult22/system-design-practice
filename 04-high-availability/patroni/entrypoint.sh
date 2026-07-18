#!/bin/bash
cp /etc/patroni.yml /tmp/patroni.yml
sed -i "s/\${PATRONI_NAME}/$PATRONI_NAME/g" /tmp/patroni.yml
chmod 0700 /var/lib/postgresql/data/patroni 2>/dev/null || true
exec patroni /tmp/patroni.yml