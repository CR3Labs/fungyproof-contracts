# FungyProof Enrichments

A FungyProof enrichment is an extended ERC-1155 where the owner of the token is another token (721 or an 1155 with a single owner).

**Requirements**

- Enrichments either cannot be transfered at all or transfer functionality is disabled once an enrichment is "bound" to an NFT
- The `enrich` method must be called by the owner of the token being enriched
- Most enrichments can only have a balance of 1 (cases), however there may be scenarios where a token can have more than 1 of the same enrichment (trinkets?)
- Enrichment "minting" simply sets the URI and the token id enumeration
- Enrichments can be burned only if their "owner token" has been burned?

**Testing**

1. Set up a local rpc (Ganache CLI or similar)
2. Install remixd `npm i -g @remix-project/remixd`
3. Run remixd: `remixd -s /path/to/this/repo  --remix-ide https://remix.ethereum.org`
4. Open https://remix.ethereum.org and connect to `localhost`
5. Connect metamask to the local RPC (import the seed phrase and change the network to localhost:8545)
5. Compile and deploy the `FungyProofNFT` contract
6. Mint a token to a second address
7. Compile and deploy the `Enrichment` contract
8. Mint a token with a uri
9. Switch to the second address and attempt to enrich the token