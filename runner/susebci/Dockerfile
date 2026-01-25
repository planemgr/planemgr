ARG RUNNER_IMAGE=registry.suse.com/bci/bci-base-fips:16.0
ARG RUNNER_DIGEST="sha256:41ad76722f1d69ae0d35f98f8fde410e1fb633c2cadbc0572e05e1941287d517"

FROM ${RUNNER_IMAGE}

LABEL org.opencontainers.image.base.name=${RUNNER_IMAGE}
LABEL org.opencontainers.image.base.digest=${RUNNER_DIGEST}

RUN mkdir /runner \
  && groupadd -r runner \
  && useradd -r -g runner -d /runner -s /sbin/nologin runner \
  && chown -R runner:runner /runner

COPY opentofu.repo /etc/zypp/repos.d/opentofu.repo
RUN zypper --gpg-auto-import-keys install -y tofu git openssh-clients

USER runner

WORKDIR /runner
