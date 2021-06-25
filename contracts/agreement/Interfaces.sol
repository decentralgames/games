// SPDX-License-Identifier: -- 💰️ --

pragma solidity ^0.8.0;

interface IQuickswapV2Factory {

    function getPair(
        address tokenA,
        address tokenB
    )
        external
        view
        returns
    (
        address pair
    );

}

interface IQuickswapRouterV2 {

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        returns
    (
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        returns
    (
        uint256 amountA,
        uint256 amountB
    );
}
