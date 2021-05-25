FROM openjdk:11

COPY FileFeeder*jar /
COPY clocks /clocks

COPY load-clocks.sh /
RUN chmod +x /load-clocks.sh

COPY dumb-init /usr/local/bin
RUN chmod +x /usr/local/bin/dumb-init

ENTRYPOINT ["/usr/local/bin/dumb-init", "bash", "/load-clocks.sh"]
