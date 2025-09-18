FROM ghcr.io/foundry-rs/foundry

# Install required tools
RUN apt-get update && apt-get install -y git

# Clone OpenZeppelin contracts and checkout specific version
RUN git clone https://github.com/OpenZeppelin/openzeppelin-contracts.git \
    && cd openzeppelin-contracts \
    && git checkout v4.9.6 \
    && git submodule update --init --recursive

# Set working directory to contracts
WORKDIR /openzeppelin-contracts

# Compile contracts
RUN forge build

# Copy and configure entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
