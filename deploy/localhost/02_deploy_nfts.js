// deploy/00_deploy_your_contract.js
const { ethers, defaultNetwork } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  if (defaultNetwork && defaultNetwork !== 'localhost') return;
  
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Deploy Test 721 NFTs
  // --------------------
  await deploy("ERC721FungyProof", {
    from: deployer,
    log: true
  })

  await deploy("ERC721FungyProofTestFunc", {
    from: deployer,
    log: true
  })
  
  // const NFT = await ethers.getContract("FungyProofERC721", deployer);

  // // get balance
  // const balance = await NFT.balanceOf(tester)
  // console.log('token balance:', balance.toString())
  // if (balance.eq(0)) {
  //   // Mint Test NFTs
  //   await NFT.mint(tester, "ipfs://ipfs/QmR5pxkm3NGa9QQCFNgxfxgSZbFSbj5Uee98i38YJg9SKg", { gasLimit: 300000, from: deployer })
  //   await NFT.mint(tester, "https://fungyproof-hackfs.s3.amazonaws.com/rocket-nft.json", { gasLimit: 300000, from: deployer })
  // }

  // Enrich an NFT
  // NOTE: Don't need to do this anymore, now that it can be done through the UI
  // try {
  //   // buy case
  //   const result = await Enrichment.connect(addr1).purchase(1, NFT.address, 1, { 
  //     gasLimit: 300000,
  //     // from: tester,
  //     value: ethers.utils.parseEther("0.02") 
  //   })
  //   console.log('purchase enrichment tx:', result.hash)
  // } catch(err) {
  //   console.log(err)
  // }

};
module.exports.tags = ["Enrichment"];
