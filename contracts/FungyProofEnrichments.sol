// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

import "./FungyProofEnrichmentsBase.sol";

contract FungyProofEnrichments is FungyProofEnrichmentsBase {
    
    event CreateFungyProofEnrichments(address owner, string name, string symbol);

    function __FungyProofEnrichments_init(string memory _name, string memory _symbol, string memory baseURI) external initializer {
        __Ownable_init_unchained();
        __PullPayment_init_unchained();
        __ERC1155Receiver_init_unchained();
        __ERC165_init_unchained();
        __ERC1155_init_unchained("");
        __FungyProofEnrichmentsBase_init_unchained(_name, _symbol);
        _setBaseURI(baseURI);
        emit CreateFungyProofEnrichments(_msgSender(), _name, _symbol);
    }

    // function __FungyProofEnrichments_upgrade()  {}
    
    uint256[50] private __gap;
}