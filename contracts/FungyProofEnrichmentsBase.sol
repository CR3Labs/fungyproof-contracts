// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

import "./helpers/WordCodec.sol";
import "./tokens/ERC1155URIBaseUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

/**
 * @title FungyProof Enrichments
 * @author Mike Roth
 *
 * @dev A FungyProof enrichment is an extended ERC-1155 where the owner of the token can be another token (721).
 * Enrichments were designed to enable attaching functionality to existing NFTs without affecting the original NFT.
 *
 * Requirements:
 *  - Enrichments cannot be transfered once they have been `bound` to an NFT
 *  - Enrichments can be `unbound` if the `isPermanent` flag is set to false on mint
 *  - The `bind` method must be called by the owner (or approved) of the token being enriched
 *  - Enrichments can be bound multiple times to the same NFT if they are flagged as `fungible` 
 *    (each bind will overwrite the `enrichmentURI`)
 *  - The underlying 1155 implements several additional extensions, specifically:
 *     - OpenZeppelin ERC1155Receiver: ability to set the contract as the owner of it's underlying 1155 tokens
 *     - OpenZeppelin ERC155Supply: keep track of token supply to enable minting semi and non-fungible tokens
 *     - ERC1155URI: add tokenURI similar to ERC721 to support setting URI on a per-token basis
 *     - OpenZeppelin: pull payment for genesis enrichment sales and to address security concerns
 */
contract FungyProofEnrichmentsBase is ERC1155URIBaseUpgradeable {
    using WordCodec for bytes32;

    string public name;
    string public symbol;

    event BindEnrichment(
        address indexed operator,
        address indexed contractAddress,
        uint256 indexed tokenId,
        uint256 enrichmentId,
        string uri
    );
    event UnbindEnrichment(
        address indexed operator,
        address indexed contractAddress,
        uint256 indexed tokenId,
        uint256 enrichmentId
    );
    event PurchaseEnrichment(
        address indexed operator,
        uint256 indexed enrichmentId
    );

    // Payee address
    address private _payee;

    // Holds current enrichmentId restricted to 96bits to support enrichment keys
    uint96 private _enrichmentId;

    // [   1 bit   |   1 bit    |  254 bits ]
    // [ perm flag | fung flag  |   price   ]
    // |MSB                              LSB|
    uint256 private constant _PRICE_OFFSET = 0;
    uint256 private constant _FUNGIBLE_FLAG_OFFSET = 254;
    uint256 private constant _PERMANENT_FLAG_OFFSET = 255;

    // Mapping of enrichmentIds to enrichment state: prices (in wei), fungibility, permanence
    mapping(uint256 => bytes32) private _enrichmentState;

    // Define an EnrichmentID as the concatenation of the id and contract address
    // (this limits the number of ids to 2^96 - 1; should be enough)
    // [ 160 bits |  96 bits ]
    // [ address  |    ID    ]
    // |MSB               LSB|
    //
    // Mapping of enrichmentKey -> tokenId -> enrichment balance
    mapping(bytes32 => mapping(uint256 => uint256)) private _enrichmentBalances;

    // Mapping of enrichmentKey -> tokenId -> enrichment URI
    mapping(bytes32 => mapping(uint256 => string)) private _enrichmentURIs;

    // Mapping of contract addresses to ownerOf(uint256) functions
    // DEV: only functions which receive a uint256 and return an address are supported
    mapping(address => string) private _contractOwnerOfFunctions;

    /**
     * @dev proxy unchained initializer
     */
    function __FungyProofEnrichmentsBase_init_unchained(
        string memory name_,
        string memory symbol_
    ) internal initializer {
        name = name_;
        symbol = symbol_;
    }

    /**
     * @dev Sets the payee address
     *
     * Requirements:
     * - `payee` cannot be the zero address.
     */
    function setPayee(address payee_) public virtual onlyOwner {
        require(payee_ != address(0), "FPNFE: set payee to zero address");
        _payee = payee_;
    }

    /**
     * @dev return the current payee
     */
    function payee() public view virtual returns (address) {
        return _payee;
    }

    /**
     * @dev Sets ownerOf functions.
     *
     * This is necessary to enable enrichment support for non-standard NFTs which are not yet known.
     */
    function setOwnerOfFunction(
        address contractAddress,
        string memory ownerOfFunc
    ) public virtual onlyOwner {
        _contractOwnerOfFunctions[contractAddress] = ownerOfFunc;
    }

    /**
     * @dev Mint a new enrichment token.
     *
     * Auto increments tokenId, sets the tokenURI and sets price / permanence flag
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `price` must be > 0
     * - `amount` must be > 0
     */
    function mint(
        address to,
        uint256 amount,
        string memory uri,
        uint256 price,
        bool fungible,
        bool permanent
    ) public virtual onlyOwner {
        require(to != address(0), "FPNFE: mint to the zero address");
        require(price >= 0, "FPNFE: price must be >= 0");
        require(amount > 0, "FPNFE: amount must be > 0");

        uint256 newEnrichmentId = _incrementEnrichmentId();

        if (bytes(uri).length > 0) {
            _setTokenURI(newEnrichmentId, uri);
        }

        _setEnrichmentState(newEnrichmentId, price, fungible, permanent);
        _mint(to, newEnrichmentId, amount, "");
    }

    /**
     * @dev Batch mint enrichments
     *
     * Auto increments tokenIds, sets tokenURIs and sets price / permanence flags
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - all parameter lengths must match.
     */
    function mintBatch(
        address to,
        uint256[] memory amounts,
        string[] memory uris,
        uint256[] memory prices,
        bool[] memory fungibles,
        bool[] memory permanents
    ) public virtual onlyOwner {
        require(to != address(0), "FPNFE: mint to the zero address");
        require(
            (amounts.length == uris.length &&
                uris.length == prices.length &&
                prices.length == fungibles.length &&
                fungibles.length == permanents.length),
            "FPNFE: param length mismatch"
        );

        uint256[] memory ids = new uint256[](amounts.length);

        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 newEnrichmentId = _incrementEnrichmentId();
            ids[i] = newEnrichmentId;

            if (bytes(uris[i]).length > 0) {
                _setTokenURI(newEnrichmentId, uris[i]);
            }

            _setEnrichmentState(
                newEnrichmentId,
                prices[i],
                fungibles[i],
                permanents[i]
            );
        }

        _mintBatch(to, ids, amounts, "");
    }

    /**
     * @dev Bind an enrichment to a token
     *
     * Transfers enrichment to contract, sets enrichment URI for this binding and increments the tokens enrichment
     * balance. Fungible enrichments allow the enrichment URI to be overwritten, enrichments are intended to be
     * combined with append-only metadata which would require the enrichmentURI data to contain all state from
     * previously bound enrichments each time it is bound (or using a storage solution such as Ceramic Network).
     *
     * Requirements:
     * - enrichment must not already be bound (if non-fungible)
     * - msg.sender must have a positive balance of the enrichment
     * - msg.sender must own the token receiving the enrichment
     */
    function bind(
        address contractAddress,
        uint256 tokenId,
        uint256 enrichmentId,
        string memory uri
    ) public virtual {
        uint256 balance = enrichmentBalanceOf(
            contractAddress,
            tokenId,
            enrichmentId
        );

        require(
            (isFungible(enrichmentId) == true) || (balance == 0),
            "FPNFE: token has enrichment"
        );

        address operator = _msgSender();

        require(
            balanceOf(operator, enrichmentId) > 0,
            "FPNFE: not enrichment owner"
        );

        require(
            ownsToken(contractAddress, tokenId, operator),
            "FPNFE: not token owner"
        );

        // transfer enrichment to contract
        _safeTransferFrom(operator, address(this), enrichmentId, 1, "");

        // get enrichment key
        bytes32 enrichmentKey = _encodeEnrichmentKey(
            contractAddress,
            uint96(enrichmentId)
        );

        // update the URI
        if (bytes(uri).length > 0) {
            _enrichmentURIs[enrichmentKey][tokenId] = uri;
        }

        // set balances
        _enrichmentBalances[enrichmentKey][tokenId] += 1;

        emit BindEnrichment(
            operator,
            contractAddress,
            tokenId,
            enrichmentId,
            uri
        );
    }

    /**
     * @dev Unbind an enrichment from a token. Transfers enrichment back to nft owner, unsets enrichment URI
     * for this binding and decrements the tokens enrichment balance.
     *
     * Requirements:
     * - enrichment must be bound
     * - enrichment can not be flagged as permanent
     * - sender must own the token with the bound enrichment
     */
    function unbind(
        address contractAddress,
        uint256 tokenId,
        uint256 enrichmentId
    ) public virtual {
        bytes32 enrichmentKey = _encodeEnrichmentKey(
            contractAddress,
            uint96(enrichmentId)
        );

        require(
            _enrichmentBalances[enrichmentKey][tokenId] >= 0,
            "FPNFE: not bound"
        );
        require(
            _enrichmentState[enrichmentId].decodeBool(_PERMANENT_FLAG_OFFSET) == false,
            "FPNFE: can't be unbound"
        );

        address operator = _msgSender();

        require(
            ownsToken(contractAddress, tokenId, operator),
            "FPNFE: sender does not own token"
        );

        // unbind the enrichment
        _enrichmentURIs[enrichmentKey][tokenId] = "";
        _enrichmentBalances[enrichmentKey][tokenId] -= 1;

        // transfer enrichment back to owner
        _safeTransferFrom(address(this), operator, enrichmentId, 1, "");

        emit UnbindEnrichment(operator, contractAddress, tokenId, enrichmentId);
    }

    /**
     * @dev Purchase an enrichment
     *
     * If the contract owner address contains a balance for this enrichmentId, transfer the enrichment to the sender.
     *
     * This implementation uses a PullPayment strategy to transfer the exact amount to the PulPayment contract.
     * Checking the exact balance is fine for our purposes because all prices will be a fixed round number set directly
     * by the FP team. Unbindable enrichments can be traded on open markets and will not require this purchase
     * functionality.
     *
     * Requirements:
     * - payee must be set
     * - contract owner must have a balance of the enrichment
     * - correct payment value must be sent
     */
    function purchase(uint256 enrichmentId) public payable virtual {
        address operator = _msgSender();
        address owner_ = owner();
        address payee_ = payee();

        require(payee_ != address(0), "FPNFE: payee has not been set");

        require(
            balanceOf(owner_, enrichmentId) > 0,
            "FPNFE: purchase not available"
        );

        // take payment using _asyncTransfer
        require(
            msg.value ==
                _enrichmentState[enrichmentId].decodeUint254(_PRICE_OFFSET),
            "FPNFE: wrong payment value"
        );
        _asyncTransfer(payee_, msg.value);

        // transfer enrichment to address
        _safeTransferFrom(owner_, operator, enrichmentId, 1, "");

        emit PurchaseEnrichment(operator, enrichmentId);
    }

    /**
     * @dev Convenience function to Purchase and Bind in one call
     */
    function purchaseAndBind(
        uint256 enrichmentId,
        address contractAddress,
        uint256 tokenId,
        string memory uri
    ) public payable virtual {
        purchase(enrichmentId);
        bind(contractAddress, tokenId, enrichmentId, uri);
    }

    /**
     * @dev Return the price of an enrichment
     */
    function priceOf(uint256 enrichmentId)
        public
        view
        virtual
        returns (uint256)
    {
        return _enrichmentState[enrichmentId].decodeUint254(_PRICE_OFFSET);
    }

    /**
     * @dev Return the enrichment permanent flag
     */
    function isPermanent(uint256 enrichmentId)
        public
        view
        virtual
        returns (bool)
    {
        return
            _enrichmentState[enrichmentId].decodeBool(_PERMANENT_FLAG_OFFSET);
    }

    /**
     * @dev Return the enrichment fungible flag
     */
    function isFungible(uint256 enrichmentId)
        public
        view
        virtual
        returns (bool)
    {
        return _enrichmentState[enrichmentId].decodeBool(_FUNGIBLE_FLAG_OFFSET);
    }

    /**
     * @dev Check if an NFT is owned by address. Security vulnerabilities of this function are mitigated
     * by using a `staticcall` to the external token contract.
     *
     * Requirements:
     * - `contractAddress` cannot be the zero address.
     * - must be a successful staticcall
     */
    function ownsToken(
        address contractAddress,
        uint256 tokenId,
        address owner
    ) public view virtual returns (bool) {
        require(
            contractAddress != address(0),
            "FPNFE: invalid contract address"
        );
        string memory func = (bytes(_contractOwnerOfFunctions[contractAddress])
            .length != 0)
            ? _contractOwnerOfFunctions[contractAddress]
            : "ownerOf(uint256)";
        bytes memory payload = abi.encodeWithSignature(func, tokenId);
        (bool success, bytes memory returnData) = contractAddress.staticcall(
            payload
        );
        require(success, "FPNFE: can't determine owner");
        return (_bytesToAddress(returnData) == owner);
    }

    /**
     * @dev Return a tokens balance of an enrichment
     */
    function enrichmentBalanceOf(
        address contractAddress,
        uint256 tokenId,
        uint256 enrichmentId
    ) public view virtual returns (uint256) {
        bytes32 enrichmentKey = _encodeEnrichmentKey(
            contractAddress,
            uint96(enrichmentId)
        );
        return _enrichmentBalances[enrichmentKey][tokenId];
    }

    /**
     * @dev Return a bound enrichments URI
     */
    function enrichmentURI(
        address contractAddress,
        uint256 tokenId,
        uint256 enrichmentId
    ) public view virtual returns (string memory) {
        bytes32 enrichmentKey = _encodeEnrichmentKey(
            contractAddress,
            uint96(enrichmentId)
        );
        return _enrichmentURIs[enrichmentKey][tokenId];
    }

    /**
     * @dev Increments the current enrichmentId
     */
    function _incrementEnrichmentId() internal returns (uint96) {
        _enrichmentId += 1;
        return _enrichmentId;
    }

    /**
     * @dev Set the price, fungibility and permanence state for an enrichment
     */
    function _setEnrichmentState(
        uint256 enrichmentId,
        uint256 price,
        bool fungible,
        bool permanent
    ) private {
        bytes32 enrichmentState;

        _enrichmentState[enrichmentId] = enrichmentState
            .insertUint254(price, _PRICE_OFFSET)
            .insertBool(fungible, _FUNGIBLE_FLAG_OFFSET)
            .insertBool(permanent, _PERMANENT_FLAG_OFFSET);
    }

    /**
     * @dev convert bytes to an address
     */
    function _bytesToAddress(bytes memory bys)
        private
        pure
        returns (address addr)
    {
        assembly {
            addr := mload(add(bys, 32))
        }
    }

    /**
     * @dev Encode contract/enrichmentId to key
     *
     * Layout is: | 20 byte address | 12 byte ID |
     */
    function _encodeEnrichmentKey(address contractAddress, uint256 enrichmentId)
        private
        pure
        returns (bytes32)
    {
        bytes32 serialized;

        serialized |= bytes32(uint256(enrichmentId));
        serialized |= bytes32(uint256(uint160(contractAddress))) << (12 * 8);

        return serialized;
    }

    uint256[50] private __gap;
}
