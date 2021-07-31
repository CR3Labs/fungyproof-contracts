// contracts/MyNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract FungyProofNFT is ERC721 {
    constructor() ERC721("FungyProofNFT", "FPNFT") {
    }
    
    function mint(address to, uint256 tokenId) public virtual {
        _mint(to, tokenId);
    }
}