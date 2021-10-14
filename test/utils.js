const { ethers, deployments, getNamedAccounts } = require('hardhat');

/**
 * Simple helper to mint a 721
 * @param {string} deployer address
 * @param {string} to address
 * @param {string} uri token uri
 * @returns 
 */
async function mint721(deployer, to, uri) {
    await deployments.fixture(['ERC721FungyProof']);
    const deployed = await deployments.get('ERC721FungyProof');
    const nft = await ethers.getContract('ERC721FungyProof', deployer);
    await nft.mint(to, uri);
    return {
        address: deployed.address,
        nft
    };
}

/**
 * Simple helper to mint a 721
 * @param {string} deployer address
 * @param {string} to address
 * @param {string} uri token uri
 * @returns 
 */
 async function mint721TestFunc(deployer, to, uri) {
    await deployments.fixture(['ERC721FungyProofTestFunc']);
    const deployed = await deployments.get('ERC721FungyProofTestFunc');
    const nft = await ethers.getContract('ERC721FungyProofTestFunc', deployer);
    await nft.mint(to, uri);
    return {
        address: deployed.address,
        nft
    };
}

module.exports = {
    mint721,
    mint721TestFunc
}
