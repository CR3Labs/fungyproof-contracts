// contracts/FungyProofNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721FungyProof is ERC721URIStorage, Ownable {

    constructor() ERC721("FungyProofNFT", "FPNFT") {}

    function mint(
        address to,
        string memory tokenURI,
        uint256 tokenId
    ) public virtual onlyOwner {
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
    }
}
