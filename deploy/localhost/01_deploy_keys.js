// deploy/00_deploy_your_contract.js
const { ethers } = require("hardhat");

// TODO deploy this to Matic / Mumbai on production
module.exports = async ({ getNamedAccounts, deployments, defaultNetwork }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Deploy FungyProofKeys
  // ----------------------
  // Deploy our 1155 Keys Contract to use as Ceramic File Controllers
  await deploy("FungyProofKeys", {
    from: deployer,
    log: true
  })

};
module.exports.tags = ["Enrichment"];
