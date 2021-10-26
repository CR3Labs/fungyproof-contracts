# FungyProof Enrichments

A FungyProof enrichment is an extended ERC-1155 where the owner of the token is another token (721 or an 1155 with a single owner).
Enrichments were designed to enable attaching functionality to existing NFTs without affecting the original NFT.

Current approaches to NFT composability require the original NFT to either extend an interface or be "wrapped/deposited" into another contract. 
The goal of FungyProof is to improve/modify existing NFTs without affecting their original structure and functionality.

**Requirements**
- Enrichments cannot be transfered once they have been `bound` to an NFT
- Enrichments can be `unbound` if the `isPermanent` flag is set to false on mint
- The `bind` method must be called by the owner (or approved) of the token being enriched
- The underlying 1155 implements several additional extensions, specifically:
    - OpenZeppelin ERC1155Receiver: ability to set the contract as the owner of it's underlying 1155 tokens
    - OpenZeppelin ERC155Supply: keep track of token supply to enable minting semi and non-fungible tokens
    - ERC1155URI: add tokenURI similar to ERC721 to support setting URI on a per-token basis
    - OpenZeppelin: pull payment for genesis sales

**Development**
1. Copy `.env.example` to `.env` and set a `SEED_PHRASE`
2. `yarn` to install dependencies
3. `yarn test` to compile contracts and run tests

**Scripts**

Various scripts exist for simple contract interactions. 
To execute scripts for different networks include the `--network {localhost|rinkeby|mumbai|mainnet|matic}` parameter.

* `setup`: Mint all default FungyProof enrichments. *Available on all networks.
* `mintEnrichment`: Mint an enrichment. *Available on all networks.
* `mintNft`: Mint a test 721 NFT. *Available on `local`, `mumbai`, and `rinkeby` networks.
* `mintKeys`: Mint FungyProof keys (Ceramic Network controllers). *Only available on `local`, `mumbai`, and `matic` networks.
* `setupTestAccount`: Set up an address with ETH, a test NFT, and a test Enrichment.

### Deployments

**Default / localhost**

The default network is the local hardhat network: `31337`

1. Run `yarn chain` to start the hardhat node.
2. Run `yarn deploy` to run the deployments in `deploy/local`

**Live Networks**

Live networks (testnets and mainnets) deploy different contracts to different networks.
To deploy to testnets:

1. Set a seed phrase in the `[PROD|STAGE]_SEED_PHRASE` .env for the desired network and ensure account `0` (deployer) and account `1` (admin for proxy) are funded.
2. Set the `INFURA_API_KEY` in the .env.
3. Run the desired deployment `yarn deploy:stage` (for testnets) and `yarn deploy:prod` (for mainnets)
