// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./tokens/ERC1155Base.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FungyProofKeys is ERC1155Base, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC1155("") {}

    function mint(
        address _to,
        uint256 _amount,
        string memory _uri
    ) public virtual onlyOwner returns (uint256) {
        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();
        _setTokenURI(newItemId, _uri);
        _mint(_to, newItemId, _amount, "");
        return newItemId;
    }
}
