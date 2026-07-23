FROM postgres:16

RUN apt-get update && apt-get install -y python3 python3-pip python3-venv \
    && python3 -m venv /opt/patroni \
    && /opt/patroni/bin/pip install patroni[etcd] psycopg2-binary \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/postgresql/data/patroni \
    && chown -R postgres:postgres /var/lib/postgresql/data

ENV PATH="/opt/patroni/bin:$PATH"

COPY patroni.yml /etc/patroni.yml
COPY entrypoint.sh /entrypoint.sh
COPY post_bootstrap.sh /post_bootstrap.sh
RUN chmod +x /entrypoint.sh /post_bootstrap.sh

USER postgres

ENTRYPOINT ["/entrypoint.sh"]