const { utils } = require('ethers');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

require('@nomiclabs/hardhat-solhint');
require('@nomiclabs/hardhat-waffle');
require('@tenderly/hardhat-tenderly');
require('hardhat-deploy');
require('@eth-optimism/hardhat-ovm');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');

require('dotenv').config();

const { isAddress, getAddress, formatUnits, parseUnits } = utils;

const {
  INFURA_API_KEY,
  STAGE_SEED_PHRASE,
  PROD_SEED_PHRASE
} = process.env;

//
// Select the network you want to deploy to here:
//
const defaultNetwork = "localhost";

function mnemonic() {
  try {
    return fs.readFileSync("./mnemonic.txt").toString().trim();
  } catch (e) {
    if (defaultNetwork !== "localhost") {
      console.log(
        "☢️ WARNING: No mnemonic file created for a deploy account. Try `yarn run generate` and then `yarn run account`."
      );
    }
  }
  return "";
}

module.exports = {
  defaultNetwork,

  // don't forget to set your provider like:
  // REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
  // (then your frontend will talk to your contracts on the live network!)
  // (you will need to restart the `yarn run start` dev server after editing the .env)

  networks: {
    localhost: {
      url: "http://localhost:8545",
      paths: { deploy: 'deploy/localhost' },
      // mnemonic: mnemonic()
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/" + INFURA_API_KEY,
      paths: { deploy: 'deploy/rinkeby' },
      accounts: {
        mnemonic: STAGE_SEED_PHRASE, // USE .env mnemonic instead for Rinkeby
      },
    },
    mumbai: {
      url: "https://polygon-mumbai.infura.io/v3/" + INFURA_API_KEY,
      paths: { deploy: 'deploy/mumbai' },
      accounts: {
        mnemonic: STAGE_SEED_PHRASE, // USE .env mnemonic instead for Mumbai
      },
    },
    mainnet: {
      url: "https://mainnet.infura.io/v3/" + INFURA_API_KEY,
      paths: { deploy: 'deploy/mainnet' },
      accounts: {
        mnemonic: PROD_SEED_PHRASE,
      },
    },
    matic: {
      url: "https://polygon.infura.io/v3/" + INFURA_API_KEY,
      paths: { deploy: 'deploy/matic' },
      gasPrice: 1000000000,
      accounts: {
        mnemonic: PROD_SEED_PHRASE,
      },
    },
    // ------------------------------------
    kovan: {
      url: "https://kovan.infura.io/v3/" + INFURA_API_KEY,
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    ropsten: {
      url: "https://ropsten.infura.io/v3/" + INFURA_API_KEY,
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    goerli: {
      url: "https://goerli.infura.io/v3/" + INFURA_API_KEY,
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    xdai: {
      url: "https://rpc.xdaichain.com/",
      gasPrice: 1000000000,
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    rinkebyArbitrum: {
      url: "https://rinkeby.arbitrum.io/rpc",
      gasPrice: 0,
      accounts: {
        mnemonic: mnemonic(),
      },
      companionNetworks: {
        l1: "rinkeby",
      },
    },
    localArbitrum: {
      url: "http://localhost:8547",
      gasPrice: 0,
      accounts: {
        mnemonic: mnemonic(),
      },
      companionNetworks: {
        l1: "localArbitrumL1",
      },
    },
    localArbitrumL1: {
      url: "http://localhost:7545",
      gasPrice: 0,
      accounts: {
        mnemonic: mnemonic(),
      },
      companionNetworks: {
        l2: "localArbitrum",
      },
    },
    kovanOptimism: {
      url: "https://kovan.optimism.io",
      gasPrice: 0,
      accounts: {
        mnemonic: mnemonic(),
      },
      ovm: true,
      companionNetworks: {
        l1: "kovan",
      },
    },
    localOptimism: {
      url: "http://localhost:8545",
      gasPrice: 0,
      accounts: {
        mnemonic: mnemonic(),
      },
      ovm: true,
      companionNetworks: {
        l1: "localOptimismL1",
      },
    },
    localOptimismL1: {
      url: "http://localhost:9545",
      gasPrice: 0,
      accounts: {
        mnemonic: mnemonic(),
      },
      companionNetworks: {
        l2: "localOptimism",
      },
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ]
    // overrides: {
    //   "contracts/CryptoPunk.sol": {
    //     version: "0.4.8",
    //     settings: { }
    //   }
    // }
  },
  ovm: {
    solcVersion: "0.8.4",
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
    admin: {
      // TODO this should be a very secure address, maybe using a multisig?
      // see: https://github.com/wighawag/hardhat-deploy#deploying-and-upgrading-proxies
      default: 1
    },
    tester: {
      default: 2
    }
  },
};

const DEBUG = false;

function debug(text) {
  if (DEBUG) {
    console.log(text);
  }
}

// ---- Helper Tasks ------

task("setup", "Sets up enrichments contract")
  .addPositionalParam("payee", "Payee address to set")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();

    const deployed = await deployments.get("FungyProofEnrichments", deployer);
    const Enrichments = await ethers.getContractFactory('FungyProofEnrichments');
    const enrichments = await Enrichments.attach(deployed.address);

    // set payee
    await enrichments.setPayee(args.payee).then(tx => tx.wait());

    // set mapped functions
    // TODO cryptopunks, anything else?

    const result = await enrichments.mintBatch(
      deployer, 
      [5000, 1000], 
      [
        'https://bafybeidiwfie42gppy7y7wdfx7emucc44mw7egv6m7eyrvgenldik5xb7i.ipfs.dweb.link/fungyproof-case.json',
        'https://bafybeiattz57nv7qqrnktz57bhkmdgqwuqwk4jvgosf5p6djuicflmbntm.ipfs.dweb.link/fungyproof-neon-green-case.json'
      ], 
      [ethers.utils.parseEther('0.02'), ethers.utils.parseEther('0.04')], 
      [true, true],
      {
        gasLimit: 500000,
        from: deployer
      }).then(tx => tx.wait())

    // log results
    console.log(JSON.stringify(result, null, 2));
  });

task("setPayee", "Set the contracts payee")
  .addPositionalParam("payee", "Payee address to set")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();

    const deployed = await deployments.get("FungyProofEnrichments", deployer);
    const Enrichments = await ethers.getContractFactory('FungyProofEnrichments');
    const enrichments = await Enrichments.attach(deployed.address);

    // set payee
    const result = await enrichments.setPayee(args.payee, {
      gasLimit: 40000,
      from: deployer
    }).then(tx => tx.wait());
    console.log(JSON.stringify(result, null, 2));
  });

task("printPayee", "Print the contracts payee")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();

    const deployed = await deployments.get("FungyProofEnrichments", deployer);
    const Enrichments = await ethers.getContractFactory('FungyProofEnrichments');
    const enrichments = await Enrichments.attach(deployed.address);

    // get payee
    const result = await enrichments.payee();
    console.log(result);
  });

task("withdraw", "Withdraw from the PullPayment contract")
  .addPositionalParam("payee", "Payee address to withraw from")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();

    const deployed = await deployments.get("FungyProofEnrichments", deployer);
    const Enrichments = await ethers.getContractFactory('FungyProofEnrichments');
    const enrichments = await Enrichments.attach(deployed.address);

    // withdraw for payee
    const result = await enrichments.withdrawPayments(args.payee, {
      gasLimit: 60000,
      from: deployer
    }).then(tx => tx.wait());
    console.log(JSON.stringify(result, null, 2));
  });

task("printPayments", "print available balance from the PullPayment contract")
  .addPositionalParam("payee", "Payee address to withraw from")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();

    const deployed = await deployments.get("FungyProofEnrichments", deployer);
    const Enrichments = await ethers.getContractFactory('FungyProofEnrichments');
    const enrichments = await Enrichments.attach(deployed.address);

    // print for payee
    const payments = await enrichments.payments(args.payee);
    console.log(payments.toString());
  });

task("mintNft", "Mints an NFT")
  .addPositionalParam("to", "The to address")
  .addPositionalParam("uri", "The NFTs URI")
  .addPositionalParam("id", "The NFTs ID")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // Deploy NFT
    await deploy("ERC721FungyProof", {
      from: deployer,
      log: true
    })
    const NFT = await ethers.getContract("ERC721FungyProof", deployer);
    console.log('nft:', NFT.address)

    // Mint a FungyProof NFT
    const result = await NFT.mint(args.to, args.uri, { gasLimit: 200000, from: deployer }).then(tx => tx.wait());
    console.log(JSON.stringify(result, null, 2));
  });

task("mintEnrichment", "Mints an Enrichment")
  .addPositionalParam("to", "Mint to address")
  .addPositionalParam("amount", "Supply for this Enrichment")
  .addPositionalParam("uri", "The Enrichments URI")
  .addPositionalParam("price", "The Enrichments default purchase price")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const deployed = await deployments.get("FungyProofEnrichments", deployer);
    const Enrichments = await ethers.getContractFactory('FungyProofEnrichments');
    const enrichments = await Enrichments.attach(deployed.address);

    const result = await enrichments.mint(args.to, Number(args.amount), args.uri, ethers.utils.parseEther(args.price), {
      gasLimit: 200000,
      from: deployer
    }).then(tx => tx.wait());
    console.log(JSON.stringify(result, null, 2));
  });

task("bindEnrichment", "Bind enrichment to an NFT")
  .addPositionalParam("address", "Contract address")
  .addPositionalParam("tokenId", "Token ID")
  .addPositionalParam("enrichmentId", "The Enrichments ID")
  .addPositionalParam("uri", "The Enrichment URI")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const deployed = await deployments.get("FungyProofEnrichments", deployer);
    const Enrichments = await ethers.getContractFactory('FungyProofEnrichments');
    const enrichments = await Enrichments.attach(deployed.address);

    const result = await enrichments.enrich(args.address, args.tokenId, args.enrichmentId, args.uri).then(tx => tx.wait());
    console.log(JSON.stringify(result, null, 2));
  });

task("transferEnrichment", "Transfer an Enrichment from 'deployer' to address")
  .addPositionalParam("to", "Transfer to address")
  .addPositionalParam("id", "Enrichment id to transfer")
  .addPositionalParam("amount", "Amount to transfer")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const deployed = await deployments.get("FungyProofEnrichments", deployer);
    const Enrichments = await ethers.getContractFactory('FungyProofEnrichments');
    const enrichments = await Enrichments.attach(deployed.address);
    console.log(args)
    const result = await enrichments.safeTransferFrom(deployer, args.to, Number(args.id), Number(args.amount), ethers.utils.toUtf8Bytes(""), {
      gasLimit: 200000,
      from: deployer
    }).then(tx => tx.wait());
    console.log(JSON.stringify(result, null, 2));
  });

task("mintKeys", "Mints a FungyProof Key")
  .addPositionalParam("to", "Mint to address")
  .addPositionalParam("amount", "The Key NFTs total supply")
  .addPositionalParam("uri", "The Key NFTs URI")
  .setAction(async (args, { ethers, getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // Deploy NFT
    await deploy("FungyProofKeys", {
      from: deployer,
      log: true
    })
    const Keys = await ethers.getContract("FungyProofKeys", deployer);

    // Mint a FungyProof Keys
    const result = await Keys.mint(args.to, Number(args.amount), args.uri, { gasLimit: 200000, from: deployer }).then(tx => tx.wait());
    console.log(JSON.stringify(result, null, 2));
  });

async function addr(ethers, addr) {
  if (isAddress(addr)) {
    return getAddress(addr);
  }
  const accounts = await ethers.provider.listAccounts();
  if (accounts[addr] !== undefined) {
    return accounts[addr];
  }
  throw `Could not normalize address: ${addr}`;
}

task("accounts", "Prints the list of accounts", async (_, { ethers }) => {
  const accounts = await ethers.provider.listAccounts();
  accounts.forEach((account) => console.log(account));
});

task("balances", "Prints an account's balances")
  .addPositionalParam("account", "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    // Ether Balance
    const balance = await ethers.provider.getBalance(
      await addr(ethers, taskArgs.account)
    );
    console.log(formatUnits(balance, "ether"), "ETH");
  });

task("blockNumber", "Prints the block number", async (_, { ethers }) => {
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log(blockNumber);
});

function send(signer, txparams) {
  return signer.sendTransaction(txparams, (error, transactionHash) => {
    if (error) {
      debug(`Error: ${error}`);
    }
    debug(`transactionHash: ${transactionHash}`);
    // checkForReceipt(2, params, transactionHash, resolve)
  });
}

task("send", "Send ETH")
  .addParam("from", "From address or account index")
  .addOptionalParam("to", "To address or account index")
  .addOptionalParam("amount", "Amount to send in ether")
  .addOptionalParam("data", "Data included in transaction")
  .addOptionalParam("gasPrice", "Price you are willing to pay in gwei")
  .addOptionalParam("gasLimit", "Limit of how much gas to spend")

  .setAction(async (taskArgs, { network, ethers }) => {
    const from = await addr(ethers, taskArgs.from);
    debug(`Normalized from address: ${from}`);
    const fromSigner = await ethers.provider.getSigner(from);

    let to;
    if (taskArgs.to) {
      to = await addr(ethers, taskArgs.to);
      debug(`Normalized to address: ${to}`);
    }

    const txRequest = {
      from: await fromSigner.getAddress(),
      to,
      value: parseUnits(
        taskArgs.amount ? taskArgs.amount : "0",
        "ether"
      ).toHexString(),
      nonce: await fromSigner.getTransactionCount(),
      gasPrice: parseUnits(
        taskArgs.gasPrice ? taskArgs.gasPrice : "1.001",
        "gwei"
      ).toHexString(),
      gasLimit: taskArgs.gasLimit ? taskArgs.gasLimit : 24000,
      chainId: network.config.chainId,
    };

    if (taskArgs.data !== undefined) {
      txRequest.data = taskArgs.data;
      debug(`Adding data to payload: ${txRequest.data}`);
    }
    debug(txRequest.gasPrice / 1000000000 + " gwei");
    debug(JSON.stringify(txRequest, null, 2));

    return send(fromSigner, txRequest);
  });

task("setupTestAccount", "Setup a test account")
  .addPositionalParam("account", "The address to setup")
  .addPositionalParam("nftId", "Starting NFT ID")
  .setAction(async (args, { ethers, run, getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // Send some ETH
    await run('send', {
      from: deployer,
      to: args.account,
      amount: '1'
    })

    // Mint a test nft
    await run('mintNft', {
      to: args.account,
      uri: 'https://arweave.net/M_dGSWzQ-MbkJawoaGl2s8gTMvm96LTUPQrufvzF6ug/rocket-nft.json',
      id: Number(args.nftId)
    })

    // Mint a test nft
    await run('mintNft', {
      to: args.account,
      uri: 'ipfs://ipfs/QmR5pxkm3NGa9QQCFNgxfxgSZbFSbj5Uee98i38YJg9SKg',
      id: Number(args.nftId) + 1
    })

    // Transfer a case to address
    await run('transferEnrichment', {
      to: args.account,
      id: '1',
      amount: '1'
    })
  });

/**
 * NOTE: we can use the DefaultProxyAdmin
 * to manage the deployed TransparentProxy/Implementation.
 * 
 * For the OZ TransparentProxy, the owner of the proxy is 
 * the DefaultProxyAdmin which we can use to adjust
 * ownership and perform upgrades.
 */
task("proxyControl", "Manage proxy")
  .setAction(async (args, { ethers, run, getNamedAccounts, deployments }) => {
    const { deployer, admin } = await getNamedAccounts();

    const adminSigner = ethers.provider.getSigner(admin);
    const deployed = await deployments.get('FungyProofEnrichments', deployer);
    const proxy = await deployments.get("DefaultProxyAdmin", adminSigner);
    const proxyContract = await ethers.getContractAt(proxy.abi, proxy.address, adminSigner);

    // Admin of FungyProofEnrichments_Proxy 0x0B306BF915C4d645ff596e518fAf3F9669b97016 (DefaultProxyAdmin)
    // Owner of DefaultProxyAdmin: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (address 2)

    // Example: change owner from DefaultProxyAdmin to another ProxyAdmin
    // await proxyContract.changeProxyAdmin(deployed.address, newProxyAdmin)

    // Example: renounce ownership over proxy to prevent future upgrades once ready
    // await proxyContract.renounceOwnership()
  });

// ---------- Local dev specific tasks ------------

task("wallet", "Create a wallet (pk) link", async (_, { ethers }) => {
  const randomWallet = ethers.Wallet.createRandom();
  const privateKey = randomWallet._signingKey().privateKey;
  console.log("🔐 WALLET Generated as " + randomWallet.address + "");
  console.log("🔗 http://localhost:3000/pk#" + privateKey);
});

task("fundedwallet", "Create a wallet (pk) link and fund it with deployer?")
  .addOptionalParam(
    "amount",
    "Amount of ETH to send to wallet after generating"
  )
  .addOptionalParam("url", "URL to add pk to")
  .setAction(async (taskArgs, { network, ethers }) => {
    const randomWallet = ethers.Wallet.createRandom();
    const privateKey = randomWallet._signingKey().privateKey;
    console.log("🔐 WALLET Generated as " + randomWallet.address + "");
    let url = taskArgs.url ? taskArgs.url : "http://localhost:3000";

    let localDeployerMnemonic;
    try {
      localDeployerMnemonic = fs.readFileSync("./mnemonic.txt");
      localDeployerMnemonic = localDeployerMnemonic.toString().trim();
    } catch (e) {
      /* do nothing - this file isn't always there */
    }

    let amount = taskArgs.amount ? taskArgs.amount : "0.01";
    const tx = {
      to: randomWallet.address,
      value: ethers.utils.parseEther(amount),
    };

    //SEND USING LOCAL DEPLOYER MNEMONIC IF THERE IS ONE
    // IF NOT SEND USING LOCAL HARDHAT NODE:
    if (localDeployerMnemonic) {
      let deployerWallet = new ethers.Wallet.fromMnemonic(
        localDeployerMnemonic
      );
      deployerWallet = deployerWallet.connect(ethers.provider);
      console.log(
        "💵 Sending " +
        amount +
        " ETH to " +
        randomWallet.address +
        " using deployer account"
      );
      let sendresult = await deployerWallet.sendTransaction(tx);
      console.log("\n" + url + "/pk#" + privateKey + "\n");
      return;
    } else {
      console.log(
        "💵 Sending " +
        amount +
        " ETH to " +
        randomWallet.address +
        " using local node"
      );
      console.log("\n" + url + "/pk#" + privateKey + "\n");
      return send(ethers.provider.getSigner(), tx);
    }
  });

task(
  "generate",
  "Create a mnemonic for builder deploys",
  async (_, { ethers }) => {
    const bip39 = require("bip39");
    const hdkey = require("ethereumjs-wallet/hdkey");
    const mnemonic = bip39.generateMnemonic();
    if (DEBUG) console.log("mnemonic", mnemonic);
    const seed = await bip39.mnemonicToSeed(mnemonic);
    if (DEBUG) console.log("seed", seed);
    const hdwallet = hdkey.fromMasterSeed(seed);
    const wallet_hdpath = "m/44'/60'/0'/0/";
    const account_index = 0;
    let fullPath = wallet_hdpath + account_index;
    if (DEBUG) console.log("fullPath", fullPath);
    const wallet = hdwallet.derivePath(fullPath).getWallet();
    const privateKey = "0x" + wallet._privKey.toString("hex");
    if (DEBUG) console.log("privateKey", privateKey);
    var EthUtil = require("ethereumjs-util");
    const address =
      "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");
    console.log(
      "🔐 Account Generated as " +
      address +
      " and set as mnemonic in packages/hardhat"
    );
    console.log(
      "💬 Use 'yarn run account' to get more information about the deployment account."
    );

    fs.writeFileSync("./" + address + ".txt", mnemonic.toString());
    fs.writeFileSync("./mnemonic.txt", mnemonic.toString());
  }
);

task(
  "mineContractAddress",
  "Looks for a deployer account that will give leading zeros"
)
  .addParam("searchFor", "String to search for")
  .setAction(async (taskArgs, { network, ethers }) => {
    let contract_address = "";
    let address;

    const bip39 = require("bip39");
    const hdkey = require("ethereumjs-wallet/hdkey");

    let mnemonic = "";
    while (contract_address.indexOf(taskArgs.searchFor) != 0) {
      mnemonic = bip39.generateMnemonic();
      if (DEBUG) console.log("mnemonic", mnemonic);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      if (DEBUG) console.log("seed", seed);
      const hdwallet = hdkey.fromMasterSeed(seed);
      const wallet_hdpath = "m/44'/60'/0'/0/";
      const account_index = 0;
      let fullPath = wallet_hdpath + account_index;
      if (DEBUG) console.log("fullPath", fullPath);
      const wallet = hdwallet.derivePath(fullPath).getWallet();
      const privateKey = "0x" + wallet._privKey.toString("hex");
      if (DEBUG) console.log("privateKey", privateKey);
      var EthUtil = require("ethereumjs-util");
      address =
        "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");

      const rlp = require("rlp");
      const keccak = require("keccak");

      let nonce = 0x00; //The nonce must be a hex literal!
      let sender = address;

      let input_arr = [sender, nonce];
      let rlp_encoded = rlp.encode(input_arr);

      let contract_address_long = keccak("keccak256")
        .update(rlp_encoded)
        .digest("hex");

      contract_address = contract_address_long.substring(24); //Trim the first 24 characters.
    }

    console.log(
      "⛏  Account Mined as " +
      address +
      " and set as mnemonic in packages/hardhat"
    );
    console.log(
      "📜 This will create the first contract: " +
      chalk.magenta("0x" + contract_address)
    );
    console.log(
      "💬 Use 'yarn run account' to get more information about the deployment account."
    );

    fs.writeFileSync(
      "./" + address + "_produces" + contract_address + ".txt",
      mnemonic.toString()
    );
    fs.writeFileSync("./mnemonic.txt", mnemonic.toString());
  });

task(
  "account",
  "Get balance informations for the deployment account.",
  async (_, { ethers }) => {
    const hdkey = require("ethereumjs-wallet/hdkey");
    const bip39 = require("bip39");
    let mnemonic = fs.readFileSync("./mnemonic.txt").toString().trim();
    if (DEBUG) console.log("mnemonic", mnemonic);
    const seed = await bip39.mnemonicToSeed(mnemonic);
    if (DEBUG) console.log("seed", seed);
    const hdwallet = hdkey.fromMasterSeed(seed);
    const wallet_hdpath = "m/44'/60'/0'/0/";
    const account_index = 0;
    let fullPath = wallet_hdpath + account_index;
    if (DEBUG) console.log("fullPath", fullPath);
    const wallet = hdwallet.derivePath(fullPath).getWallet();
    const privateKey = "0x" + wallet._privKey.toString("hex");
    if (DEBUG) console.log("privateKey", privateKey);
    var EthUtil = require("ethereumjs-util");
    const address =
      "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");

    var qrcode = require("qrcode-terminal");
    qrcode.generate(address);
    console.log("‍📬 Deployer Account is " + address);
    for (let n in config.networks) {
      //console.log(config.networks[n],n)
      try {
        let provider = new ethers.providers.JsonRpcProvider(
          config.networks[n].url
        );
        let balance = await provider.getBalance(address);
        console.log(" -- " + n + " --  -- -- 📡 ");
        console.log("   balance: " + ethers.utils.formatEther(balance));
        console.log(
          "   nonce: " + (await provider.getTransactionCount(address))
        );
      } catch (e) {
        if (DEBUG) {
          console.log(e);
        }
      }
    }
  }
);

