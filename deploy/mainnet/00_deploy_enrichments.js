// deploy/00_deploy_your_contract.js
const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments, defaultNetwork }) => {
  const { deploy } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  // Deploy Enrichment contract
  await deploy("FungyProofEnrichments", {
    from: deployer,
    log: true,
    proxy: {
      owner: admin,
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute : {
        init: {
          // method to be executed when the proxy is deployed
          methodName: '__FungyProofEnrichments_init', 
          args: ['FungyProofEnrichments', 'FPNFE', '']
        }
      }
    }
  })

  // NOTE: interacting with the contract must be done through a factory
  // via attaching to the proxy address (and passing in the ABI if from the DAPP):
  // const deployed = await deployments.get("FungyProofEnrichments", deployer);
  // const Enrichment = await ethers.getContractFactory('FungyProofEnrichments');
  // const attached = await Enrichment.attach(deployed.address);
  // const name = await attached.name({ gasLimit: 300000, from: deployer });
  // console.log(name, '::', deployed.address)
};
module.exports.tags = ["Enrichment"];
