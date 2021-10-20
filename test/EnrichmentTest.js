const { ethers, deployments, getNamedAccounts } = require('hardhat');
const { use, expect } = require('chai');
const { solidity } = require('ethereum-waffle');
const { mint721, mint721TestFunc } = require('./utils');

use(solidity);

describe('FungyProofEnrichments', async function () {
  const { deployer, admin, tester } = await getNamedAccounts()
  const testSigner = ethers.provider.getSigner(tester);

  let enrichment;
  let enrichmentImplAddr;

  describe('Setup', function () {

    it('Should deploy Enrichment', async () => {
      await deployments.fixture(['FungyProofEnrichments']);
      const deployed = await deployments.get('FungyProofEnrichments');
      const Enrichment = await ethers.getContractFactory('FungyProofEnrichments');
      enrichmentImplAddr = deployed.address;
      enrichment = await Enrichment.attach(enrichmentImplAddr);
      const name = await enrichment.name();
      expect(name).to.be.equal('FungyProofEnrichments')
    });

    it('Should properly set proxy admin', async () => {
      const adminSigner = ethers.provider.getSigner(admin);
      // get proxy
      const proxy = await deployments.get("DefaultProxyAdmin", adminSigner);
      const proxyContract = await ethers.getContractAt(proxy.abi, proxy.address, adminSigner);

      // expect the implementation to be administered by the proxyAdmin contract
      const a = await proxyContract.getProxyAdmin(enrichment.address);
      expect(a).to.be.equal(proxy.address);

      // expect the proxyAdmin to be owned by the admin address
      const owner = await proxyContract.owner();
      expect(owner).to.be.equal(admin);

      // expect implementation to be owned by the deployer address
      const d = await enrichment.owner();
      expect(d).to.be.equal(deployer);
    });

    // TODO test Proxy Upgrade

    it('Should mint an enrichment', async () => {
      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), {
        from: deployer
      }).then(t => t.wait());

      const supply = await enrichment.totalSupply(1);

      expect(supply).to.be.equal(10);
    });

    it('Should batch mint enrichments', async () => {
      // mint an enrichment
      await enrichment.mintBatch(
        deployer, 
        [5, 9], 
        ['ceramic://test1','ceramic://test2'], 
        [ethers.utils.parseEther('0.02'), ethers.utils.parseEther('0.01')],
        [true, false], {
        from: deployer
      }).then(t => t.wait());

      const supply1 = await enrichment.totalSupply(2);
      const supply2 = await enrichment.totalSupply(3);
      const uri1 = await enrichment.uri(2);
      const uri2 = await enrichment.uri(3);
      const price1 = await enrichment.priceOf(2);
      const price2 = await enrichment.priceOf(3);

      expect(supply1.toString()).to.be.equal('5');
      expect(supply2.toString()).to.be.equal('9');
      expect(uri1).to.be.equal('ceramic://test1');
      expect(uri2).to.be.equal('ceramic://test2');
      expect(price1.toString()).to.be.equal('20000000000000000');
      expect(price2.toString()).to.be.equal('10000000000000000');
    });

    it('Should allow minting only from deployer address', async () => {
      // address _to, uint256 _enrichmentId, uint256 _amount, string memory _uri, uint256 _price (in wei)
      const result = await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), {
        from: deployer
      }).then(t => t.wait());

      // get token URI
      const uri = await enrichment.uri(1);
      const bal = await enrichment.balanceOf(deployer, 1);
      const price = await enrichment.priceOf(1);
      expect(uri).to.be.equal('ceramic://test');
      expect(bal.toNumber()).to.be.equal(10);
      expect(price.toString()).to.be.equal('20000000000000000');
    });

    it('Should not allow minting from non-deployer address', async () => {
      try {
        const result = await enrichment.connect(testSigner).mint(tester, 10, 'ceramic://test', 2000, false, "").then(t => t.wait());
        expect(false);
      } catch (err) {
        expect(~err.message.indexOf('Ownable: caller is not the owner'));
      }
    });

  });

  describe('Purchase', function () {
    it('Should allow purchasing an enrichment', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      const purchase = await enrichment.connect(testSigner).purchase(1, {
        value: ethers.utils.parseEther('0.02')
      }).then(t => t.wait());

      // expect balance
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(1);
    });

    it('Should fail to purchase with wrong payment', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      try {
        const purchase = await enrichment.connect(testSigner).purchase(1, address, 1, 'ceramic://testenrichment1', {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FungyProofEnrichments: wrong payment value'));
      }
    });

    it('Should fail to purchase if enrichment is not available', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // purchase enrichment
      try {
        const purchase = await enrichment.purchase(999, address, 1, 'ceramic://testenrichment1', {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FungyProofEnrichments: enrichment is not available for purchase'));
      }
    });
  });

  describe('PurchaseAndBind', function () {

    it('Should allow purchasing an enrichment', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      const purchase = await enrichment.connect(testSigner).purchaseAndBind(1, address, 1, 'ceramic://testenrichment1', {
        value: ethers.utils.parseEther('0.02')
      }).then(t => t.wait());

      // expect burned
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(0);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, 1, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, 1, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');
    });

    it('Should fail to purchase with wrong payment', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      try {
        const purchase = await enrichment.connect(testSigner).purchaseAndBind(1, address, 1, 'ceramic://testenrichment1', {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FungyProofEnrichments: wrong payment value'));
      }
    });

    it('Should fail to purchase if not owner', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      try {
        const purchase = await enrichment.purchaseAndBind(1, address, 1, 'ceramic://testenrichment1', {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FungyProofEnrichments: sender does not own token'));
      }
    });

    it('Should fail to purchase if enrichment is not available', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // purchase enrichment
      try {
        const purchase = await enrichment.purchaseAndBind(999, address, 1, 'ceramic://testenrichment1', {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FungyProofEnrichments: enrichment is not available for purchase'));
      }
    });

  })

  describe('Binding', function () {

    it('Should allow binding with a purchased enrichment', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // mint enrichment
      await enrichment.mint(tester, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), {
        from: deployer
      }).then(t => t.wait());

      // expect balance
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(1);

      // bind
      await enrichment.connect(testSigner).bind(address, 1, 1, 'ceramic://testenrichment1').then(t => t.wait());

      // expect burned
      const newTesterBal = await enrichment.balanceOf(tester, 1);
      expect(newTesterBal.toNumber()).to.be.equal(0);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, 1, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, 1, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');
    });

    it('Should allow unbinding a previously bound enrichment', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // mint non-permanent enrichment
      const e = await enrichment.mint(tester, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), false, {
        from: deployer
      }).then(t => t.wait());

      // expect balance
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(1);

      // expect not permanent
      const isPermanent = await enrichment.isPermanent(1);
      expect(!isPermanent);

      // --- bind --- //
      await enrichment.connect(testSigner).bind(address, 1, 1, 'ceramic://testenrichment1').then(t => t.wait());
      // expect burned
      const newTesterBal = await enrichment.balanceOf(tester, 1);
      expect(newTesterBal.toNumber()).to.be.equal(0);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, 1, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, 1, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');

      // --- unbind --- //
      await enrichment.connect(testSigner).unbind(address, 1, 1).then(t => t.wait());
      // expect balance
      const uTesterBal = await enrichment.balanceOf(tester, 1);
      expect(uTesterBal.toNumber()).to.be.equal(1);
      // expect nft to not hve bal
      const uEnrichmentBal = await enrichment.enrichmentBalanceOf(address, 1, 1);
      expect(uEnrichmentBal.toNumber()).to.be.equal(0);
      // expect enrichmentURI to be empty
      const uEnrichmentURI = await enrichment.enrichmentURI(address, 1, 1);
      expect(uEnrichmentURI).to.be.empty;
    });

    it('Should not allow unbinding a previously bound permanent enrichment', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // mint permanent enrichment
      const e = await enrichment.mint(tester, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), true, {
        from: deployer
      }).then(t => t.wait());

      // expect balance
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(1);

      // --- bind --- //
      await enrichment.connect(testSigner).bind(address, 1, 1, 'ceramic://testenrichment1').then(t => t.wait());
      // expect burned
      const newTesterBal = await enrichment.balanceOf(tester, 1);
      expect(newTesterBal.toNumber()).to.be.equal(0);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, 1, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, 1, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');

      // --- unbind --- //
      try {
        await enrichment.connect(testSigner).unbind(address, 1, 1).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FungyProofEnrichments: enrichment cannot be unbound'));
      }

    });

    it('Should fail if enrichment bal is < 1', async () => {
      // mint an NFT
      const { nft, address } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(tester);

      // mint enrichment to deployer
      await enrichment.mint(deployer, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), {
        from: deployer
      }).then(t => t.wait());

      // bind
      try {
        await enrichment.connect(testSigner).bind(address, 1, 1, 'ceramic://testenrichment1').then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FungyProofEnrichments: sender does not own enrichment'));
      }

    });

    it('Should fail if msg.sender != nft owner', async () => {
      // mint an NFT to deployer
      const { nft, address } = await mint721(deployer, deployer, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(1);
      expect(ownerOf).to.be.equal(deployer);

      // mint enrichment to tester
      await enrichment.mint(tester, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), {
        from: deployer
      }).then(t => t.wait());

      // bind
      try {
        await enrichment.connect(testSigner).bind(address, 1, 1, 'ceramic://testenrichment1').then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FungyProofEnrichments: sender does not own token'));
      }
    });

  });

  describe('Non-standard NFTs', function () {

    it('Should allow owner to set ownerOfFunction', async () => {
      // mint an NFT to deployer
      const { nft, address } = await mint721TestFunc(deployer, tester, 'ipfs://testtoken');
      const idToAddress = await nft.idToAddress(1);
      expect(idToAddress).to.be.equal(tester);

      // set a custom ownerOf function
      await enrichment.setOwnerOfFunction(address, 'idToAddress(uint256)', {
        from: deployer
      }).then(t => t.wait());

      // mint enrichment to deployer
      await enrichment.mint(deployer, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      const purchase = await enrichment.connect(testSigner).purchaseAndBind(1, address, 1, 'ceramic://testenrichment1', {
        value: ethers.utils.parseEther('0.01')
      }).then(t => t.wait());

      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, 1, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
    });

  });
});
