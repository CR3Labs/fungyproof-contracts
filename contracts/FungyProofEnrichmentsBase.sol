// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

import "./ERC1155URIBaseUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

contract FungyProofEnrichmentsBase is ERC1155URIBaseUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIds;

    string public name;
    string public symbol;

    event Bind(
        address indexed operator,
        address indexed contractAddress,
        uint256 indexed tokenId,
        uint256 enrichmentId,
        string uri
    );
    event Unbind(
        address indexed operator,
        address indexed contractAddress,
        uint256 indexed tokenId,
        uint256 enrichmentId
    );
    event Purchase(address indexed operator, uint256 indexed enrichmentId);

    // Mapping of enrichmentIds to prices (in wei)
    mapping(uint256 => uint256) private _prices;

    // Mapping of enrichmentIds to enrichment permanence
    mapping(uint256 => bool) private _isPermanent;

    // Mapping of enrichmentId -> contractAddress -> tokenId -> enrichment balance
    mapping(uint256 => mapping(address => mapping(uint256 => uint256)))
        private _enrichmentBalances;

    // Mapping of enrichmentId -> contractAddress -> tokenId -> enrichment URI
    mapping(uint256 => mapping(address => mapping(uint256 => string)))
        private _enrichmentURIs;

    // Mapping of contract addresses to ownerOf(uint256) functions
    // DEV: only functions which recieve a uint256 and return an address are supported
    mapping(address => string) private _contractOwnerOfFunctions;

    function __FungyProofEnrichmentsBase_init_unchained(
        string memory name_,
        string memory symbol_
    ) internal initializer {
        name = name_;
        symbol = symbol_;
    }

    function mint(
        address to,
        uint256 amount,
        string memory uri,
        uint256 price,
        bool permanent
    ) public virtual onlyOwner {
        require(
            to != address(0),
            "FungyProofEnrichments: mint to the zero address"
        );
        require(price >= 0, "FungyProofEnrichments: price must be >= 0");
        require(amount > 0, "FungyProofEnrichments: amount must be > 0");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        if (bytes(uri).length > 0) {
            _setTokenURI(newItemId, uri);
        }

        _prices[newItemId] = price;
        _isPermanent[newItemId] = permanent;
        _mint(to, newItemId, amount, "");
    }

    function mintBatch(
        address to,
        uint256[] memory amounts,
        string[] memory uris,
        uint256[] memory prices,
        bool[] memory permanents
    ) public virtual onlyOwner {
        require(
            to != address(0),
            "FungyProofEnrichments: mint to the zero address"
        );
        require(
            (amounts.length == uris.length &&
                uris.length == prices.length &&
                prices.length == permanents.length),
            "FungyProofEnrichments: parameter lengths mismatch"
        );

        uint256[] memory ids = new uint256[](amounts.length);

        for (uint256 i = 0; i < amounts.length; i++) {
            _tokenIds.increment();
            uint256 newItemId = _tokenIds.current();
            ids[i] = newItemId;

            if (bytes(uris[i]).length > 0) {
                _setTokenURI(newItemId, uris[i]);
            }

            _prices[newItemId] = prices[i];
            _isPermanent[newItemId] = permanents[i];
        }

        _mintBatch(to, ids, amounts, "");
    }

    function bind(
        address contractAddress,
        uint256 tokenId,
        uint256 enrichmentId,
        string memory uri
    ) public virtual {
        require(
            enrichmentBalanceOf(contractAddress, tokenId, enrichmentId) == 0,
            "FungyProofEnrichments: token already has this enrichment"
        );
        require(
            balanceOf(_msgSender(), enrichmentId) > 0,
            "FungyProofEnrichments: sender does not own enrichment"
        );

        address operator = _msgSender();

        require(
            _ownsToken(contractAddress, tokenId, operator),
            "FungyProofEnrichments: sender does not own token"
        );

        // transfer enrichment to contract
        _safeTransferFrom(operator, address(this), enrichmentId, 1, "");

        // bind the enrichment
        // TODO convert contractAddress, tokenId to key instead of nested maps?
        _enrichmentURIs[enrichmentId][contractAddress][tokenId] = uri;
        _enrichmentBalances[enrichmentId][contractAddress][tokenId] += 1;

        emit Bind(operator, contractAddress, tokenId, enrichmentId, uri);
    }

    function unbind(
        address contractAddress,
        uint256 tokenId,
        uint256 enrichmentId
    ) public virtual {
        require(
            _enrichmentBalances[enrichmentId][contractAddress][tokenId] >= 0,
            "FungyProofEnrichments: enrichment is not bound"
        );
        require(
            _isPermanent[enrichmentId] != true,
            "FungyProofEnrichments: enrichment cannot be unbound"
        );

        address operator = _msgSender();

        require(
            _ownsToken(contractAddress, tokenId, operator),
            "FungyProofEnrichments: sender does not own token"
        );

        // unbind the enrichment
        // TODO convert contractAddress, tokenId to key instead of nested maps?
        _enrichmentURIs[enrichmentId][contractAddress][tokenId] = "";
        _enrichmentBalances[enrichmentId][contractAddress][tokenId] -= 1;

        // transfer enrichment back to owner
        _safeTransferFrom(address(this), operator, enrichmentId, 1, "");

        emit Unbind(operator, contractAddress, tokenId, enrichmentId);
    }

    function purchase(uint256 enrichmentId) public payable virtual {
        address operator = _msgSender();
        address owner_ = owner();

        require(
            balanceOf(owner_, enrichmentId) > 0,
            "FungyProofEnrichments: enrichment is not available for purchase"
        );

        // take payment using _asyncTransfer
        require(
            msg.value == _prices[enrichmentId],
            "FungyProofEnrichments: wrong payment value"
        );
        _asyncTransfer(owner_, msg.value);

        // transfer enrichment to address
        _safeTransferFrom(owner_, operator, enrichmentId, 1, "");

        emit Purchase(operator, enrichmentId);
    }

    function purchaseAndBind(
        uint256 enrichmentId,
        address contractAddress,
        uint256 tokenId,
        string memory uri
    ) public payable virtual {
        purchase(enrichmentId);
        bind(contractAddress, tokenId, enrichmentId, uri);
    }

    function priceOf(uint256 enrichmentId)
        public
        view
        virtual
        returns (uint256)
    {
        return _prices[enrichmentId];
    }

    function isPermanent(uint256 enrichmentId)
        public
        view
        virtual
        returns (bool)
    {
        return _isPermanent[enrichmentId];
    }

    function setOwnerOfFunction(
        address contractAddress,
        string memory ownerOfFunc
    ) public virtual onlyOwner {
        _contractOwnerOfFunctions[contractAddress] = ownerOfFunc;
    }

    function enrichmentBalanceOf(
        address contractAddress,
        uint256 tokenId,
        uint256 enrichmentId
    ) public view virtual returns (uint256) {
        return _enrichmentBalances[enrichmentId][contractAddress][tokenId];
    }

    function enrichmentURI(
        address contractAddress,
        uint256 tokenId,
        uint256 enrichmentId
    ) public view virtual returns (string memory) {
        return _enrichmentURIs[enrichmentId][contractAddress][tokenId];
    }

    function _ownsToken(
        address contractAddress,
        uint256 tokenId,
        address owner
    ) private returns (bool) {
        require(
            contractAddress != address(0),
            "FungyProofEnrichments: invalid contract address"
        );
        string memory func = (bytes(_contractOwnerOfFunctions[contractAddress])
            .length != 0)
            ? _contractOwnerOfFunctions[contractAddress]
            : "ownerOf(uint256)";
        bytes memory payload = abi.encodeWithSignature(func, tokenId);
        (bool success, bytes memory returnData) = contractAddress.call(payload);
        require(
            success,
            "FungyProofEnrichments: unable to determine token owner"
        );
        return (_bytesToAddress(returnData) == owner);
    }

    function _bytesToAddress(bytes memory bys)
        private
        pure
        returns (address addr)
    {
        assembly {
            addr := mload(add(bys, 32))
        }
    }

    uint256[50] private __gap;
}
