FROM almir/webhook:latest AS webhook

FROM docker:27-cli
RUN apk add --no-cache curl git bash
COPY --from=webhook /usr/local/bin/webhook /usr/local/bin/webhook
ENTRYPOINT ["/usr/local/bin/webhook"]
CMD ["-hooks", "/etc/webhook/hooks.json", "-verbose"]
