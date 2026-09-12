# Midnight preprod runbook

## Endpoints

| Surface | Endpoint |
| --- | --- |
| Network ID | `preprod` |
| Node RPC | `https://rpc.preprod.midnight.network` |
| Indexer HTTP | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| Indexer WebSocket | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` |
| Local proof server | `http://localhost:6300` |
| Explorer | `https://preprod.midnightexplorer.com` |
| Faucet | `https://midnight-tmnight-preprod.nethermind.dev/` |

## First deployment

1. Compile the contract once with `pnpm contract:compile:wsl`.
2. Start the pinned proof service with `pnpm proof-server` and verify `pnpm proof-server:status`.
3. Start VeilDrive with `pnpm dev`.
4. Configure a DApp Connector API v4 wallet for Midnight preprod and fund it from the faucet.
5. Select **Connect compatible wallet**. VeilDrive discovers Lace/1AM by scanning `window.midnight` and requires API major version 4.
6. Open **Settings**, run the endpoint health check, then select **Deploy new registry**.
7. Approve the wallet’s data-signing request. Review and approve the final transaction in the wallet.
8. Copy the contract address and Veil ID. Other users join the same registry and share their Veil ID for direct grants or credentials.

Every contract write may require a wallet approval and consumes preprod DUST. Proof generation can take significantly longer on first use because proving assets are large.

## Existing registry

Paste its full contract address under **Settings → Existing contract address**, then choose **Join registry**. VeilDrive validates the contract using the compiled verifier assets before enabling on-chain file and access operations.

## Troubleshooting

- **No compatible wallet:** confirm the extension is enabled for `http://localhost:5173`, its Midnight account is on preprod, and its DApp Connector API is v4.
- **Request failed:** unlock the wallet and retry. If an extension permission window opens, complete it in the wallet.
- **Proof server offline:** run `pnpm proof-server`; `http://localhost:6300/version` should return `8.1.0`.
- **Insufficient balance or DUST:** use the preprod faucet and wait for wallet sync.
- **Contract not selected:** deploy a new registry or join an existing contract before attempting preprod uploads/shares.
- **Cold proof is slow:** keep the app tab open while the local proof server loads the selected circuit assets.

The integration follows the official [wallet connector guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-integration) and [DApp Connector API reference](https://docs.midnight.network/api-reference/dapp-connector).
