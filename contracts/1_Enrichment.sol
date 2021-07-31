// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/PullPayment.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title Enrichment
 */
contract Enrichment is PullPayment, Ownable {
    using Address for address;
    using Strings for uint256;
    
    // struct OwnerToken {
    //     address contractAddress;
    //     uint256 tokenId;
    //     bool valid;
    // }

    // Mapping of tokenIds to tokenURIs
    mapping(uint256 => string) private _tokenURIs;
    
    // Array with all token ids, used for enumeration
    uint256[] private _allTokens;
    
    // Mapping from token id to position in the _allTokens array
    mapping(uint256 => uint256) private _allTokensIndex;
    
    // Mapping of tokenId to ownerTokens
    // mapping(uint256 => OwnerToken) private _ownerTokens;
    
    // Mapping of ownerTokens enrichment balance
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) private _ownerTokenBalances;
    
    // Mapping of address to token ids
    mapping(address => uint256[]) private _purchases;
    
    function enrich(address _ownerContractAddress, uint256 _ownerTokenId, uint256 _tokenId) public virtual payable {
        require(_ownsToken(_ownerContractAddress, _ownerTokenId, msg.sender), "Enrichment: sender does not own token");
        require(bytes(_tokenURIs[_tokenId]).length > 0, "Enrichment: enrichment does not exist");
        require(_ownerTokenBalances[_tokenId][_ownerContractAddress][_ownerTokenId] < 1, "Enrichment: token already has this enrichment");
        
        // take payment using _asyncTransfer
        require(msg.value == 1 ether, "Enrichment: payment too small");
        _asyncTransfer(owner(), msg.value);
        
        // enrich the token
        _ownerTokenBalances[_tokenId][_ownerContractAddress][_ownerTokenId] += 1;
        _purchases[msg.sender].push(_tokenId);
    }
    
    function purchases(address _buyerAddress) public view virtual returns (uint256[] memory) {
        return _purchases[_buyerAddress];
    }
    
    function balanceOf(address _ownerContractAddress, uint256 _ownerTokenId, uint256 _tokenId) public view virtual returns (uint256) {
        return _ownerTokenBalances[_tokenId][_ownerContractAddress][_ownerTokenId];
    }
    
    function mint(uint256 _tokenId, string memory _tokenURI) public virtual onlyOwner {
        // require(_allTokens[tokenId] < 1, "tokenID exists");
        _addTokenToAllTokensEnumeration(_tokenId);
        _setTokenURI(_tokenId, _tokenURI);
    }

    function burn(uint256 _tokenId) public virtual {
        // enrichment tokens can be "burned" if their controlling NFT has been burned
        // Owner, Buyer, anyone, maybe not at all?
    }
    
    function totalSupply() public view virtual returns (uint256) {
        return _allTokens.length;
    }
    
    function tokenByIndex(uint256 _index) public view virtual returns (uint256) {
        require(_index < Enrichment.totalSupply(), "Enrichment: global index out of bounds");
        return _allTokens[_index];
    }
    
    function tokenURI(uint256 _tokenId) public view virtual returns (string memory) {
        return _tokenURIs[_tokenId];
    }
    
    function _addTokenToAllTokensEnumeration(uint256 _tokenId) private {
        _allTokensIndex[_tokenId] = _allTokens.length;
        _allTokens.push(_tokenId);
    }
    
    function _setTokenURI(uint256 _tokenId, string memory _tokenURI) internal virtual {
        require(bytes(_tokenURI).length > 0, "Enrichment: token URI cannot be empty");
        _tokenURIs[_tokenId] = _tokenURI;
    }
    
    function _ownsToken(address _contractAddress, uint256 _tokenId, address _owner) internal virtual returns (bool) {
        // TODO how do we support 721, non-fungible 1155s, and non-standards like CryptoPunks?
        bytes memory payload = abi.encodeWithSignature("ownerOf(uint256)", _tokenId);
        (bool success, bytes memory returnData) = _contractAddress.call(payload);
        require(success, "Enrichment: unable to determine token owner");
        return (_bytesToAddress(returnData) == _owner);
    }
    
    function _bytesToAddress(bytes memory bys) private pure returns (address addr) {
        assembly {
            addr := mload(add(bys, 32))
        } 
    }
}