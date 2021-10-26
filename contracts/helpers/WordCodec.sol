// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

library WordCodec {
    // Masks are values with the least significant N bits set. They can be used to extract an encoded value from a word,
    // or to insert a new one replacing the old.
    uint256 private constant _MASK_1 = 2**(1) - 1;
    uint256 private constant _MASK_96 = 2**(96) - 1;
    uint256 private constant _MASK_255 = 2**(255) - 1;

    // Encoding

    /**
     * @dev Inserts a boolean value shifted by an offset into a 256 bit word, replacing the old value. Returns the new
     * word.
     */
    function insertBool(
        bytes32 word,
        bool value,
        uint256 offset
    ) internal pure returns (bytes32) {
        bytes32 clearedWord = bytes32(uint256(word) & ~(_MASK_1 << offset));
        return clearedWord | bytes32(uint256(value ? 1 : 0) << offset);
    }

    /**
     * @dev Inserts a 255 bit unsigned integer shifted by an offset into a 256 bit word, replacing the old value.
     * Returns the new word.
     *
     * Assumes `value` only uses its least significant 255 bits, otherwise it may overwrite sibling bytes.
     */
    function insertUint255(
        bytes32 word,
        uint256 value,
        uint256 offset
    ) internal pure returns (bytes32) {
        bytes32 clearedWord = bytes32(uint256(word) & ~(_MASK_255 << offset));
        return clearedWord | bytes32(value << offset);
    }

    // Decoding

    /**
     * @dev Decodes and returns a boolean shifted by an offset from a 256 bit word.
     */
    function decodeBool(bytes32 word, uint256 offset)
        internal
        pure
        returns (bool)
    {
        return (uint256(word >> offset) & _MASK_1) == 1;
    }

    /**
     * @dev Decodes and returns a 255 bit unsigned integer shifted by an offset from a 256 bit word.
     */
    function decodeUint255(bytes32 word, uint256 offset)
        internal
        pure
        returns (uint256)
    {
        return uint256(word >> offset) & _MASK_255;
    }

    /**
     * @dev Returns the address from an encoded Enrichment Key
     */
    function getEnrichmentAddress(bytes32 enrichmentKey)
        internal
        pure
        returns (address)
    {
        // 12 byte logical shift left to remove the enrichment id. We don't need to mask,
        // since the logical shift already sets the upper bits to zero.
        return address(uint160(uint256(enrichmentKey)) >> (12 * 8));
    }

    /**
     * @dev Returns the enrichmentID of an Enrichment Key
     *
     * Assumes the enrichment ID fits in 96 bits.
     */
    function getEnrichmentId(bytes32 enrichmentKey)
        internal
        pure
        returns (uint256)
    {
        return uint256(enrichmentKey) & _MASK_96;
    }
}
