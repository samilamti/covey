FROM almir/webhook:latest AS webhook

FROM docker:27-cli
RUN apk add --no-cache curl git bash
COPY --from=webhook /usr/local/bin/webhook /usr/local/bin/webhook
ENTRYPOINT ["/usr/local/bin/webhook"]
# -template is what makes {{ getenv "DEPLOY_WEBHOOK_SECRET" }} in hooks.json
# resolve; without it the HMAC key is that literal string and no request ever
# validates.
CMD ["-hooks", "/etc/webhook/hooks.json", "-template", "-verbose"]
