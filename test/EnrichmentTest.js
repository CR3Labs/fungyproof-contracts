const { ethers, upgrades, deployments, getNamedAccounts } = require('hardhat');
const { use, expect } = require('chai');
const { solidity } = require('ethereum-waffle');
const { mint721, mint721TestFunc } = require('./utils');

use(solidity);

describe('FungyProofEnrichments', async function () {
  const { deployer, admin, tester } = await getNamedAccounts()
  const testSigner = ethers.provider.getSigner(tester);
  const deploySigner = ethers.provider.getSigner(deployer);

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

    // NOTE: hardhat-deploy handles this automatically
    // We tested this by adding the following function to the 
    // FungyProofEnrichmentsBase and redeploying:
    //
    // function updated() public view virtual returns (uint256)  {
    //   return 123;
    // }
    it.skip('Should properly upgrade the contract', async () => {
      const val = await enrichment.updated();
      expect(val.toString()).to.equal('123');
    });

    it('Should properly implement ERC165', async () => {
      const ERC1155 = '0xd9b67a26';
      const ERC1155_METADATA_URI = '0x0e89341c';

      const erc1155 = await enrichment.supportsInterface(ERC1155);
      const metadata = await enrichment.supportsInterface(ERC1155_METADATA_URI);

      expect(erc1155).to.be.true;
      expect(metadata).to.be.true;
    });

    it('Should set the payee', async () => {
      // NOTE: here we can set it to a gnosis safe
      await enrichment.setPayee(deployer).then(t => t.wait());
      const payee = await enrichment.payee();
      expect(payee).to.be.equal(deployer);
    });

    it('Should mint an enrichment', async () => {
      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), false, true, {
        from: deployer
      }).then(t => t.wait());

      const supply = await enrichment.totalSupply(1);
      const uri = await enrichment.uri(1);
      const price = await enrichment.priceOf(1);
      const fungible = await enrichment.isFungible(1);
      const permanent = await enrichment.isPermanent(1);

      expect(supply.toString()).to.be.equal('10');
      expect(uri).to.be.equal('ceramic://test');
      expect(price.toString()).to.be.equal('20000000000000000');
      expect(fungible).to.be.false;
      expect(permanent).to.be.true;
    });

    it('Should batch mint enrichments', async () => {
      // mint an enrichment
      const result = await enrichment.mintBatch(
        deployer,
        [5, 9],
        ['ceramic://test1', 'ceramic://test2'],
        [ethers.utils.parseEther('0.02'), ethers.utils.parseEther('0.01')],
        [false, true],
        [true, false], {
        from: deployer
      }).then(t => t.wait());

      // console.log(result.gasUsed.toString());

      const supply1 = await enrichment.totalSupply(2);
      const supply2 = await enrichment.totalSupply(3);
      const uri1 = await enrichment.uri(2);
      const uri2 = await enrichment.uri(3);
      const price1 = await enrichment.priceOf(2);
      const price2 = await enrichment.priceOf(3);
      const fungible1 = await enrichment.isFungible(2);
      const fungible2 = await enrichment.isFungible(3);
      const permanent1 = await enrichment.isPermanent(2);
      const permanent2 = await enrichment.isPermanent(3);

      expect(supply1.toString()).to.be.equal('5');
      expect(supply2.toString()).to.be.equal('9');
      expect(uri1).to.be.equal('ceramic://test1');
      expect(uri2).to.be.equal('ceramic://test2');
      expect(price1.toString()).to.be.equal('20000000000000000');
      expect(price2.toString()).to.be.equal('10000000000000000');
      expect(fungible1).to.be.false;
      expect(fungible2).to.be.true;
      expect(permanent1).to.be.true;
      expect(permanent2).to.be.false;
    });

    it('Should allow minting only from deployer address', async () => {
      // address _to, uint256 _enrichmentId, uint256 _amount, string memory _uri, uint256 _price (in wei)
      const result = await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), false, false, {
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
        const result = await enrichment.connect(testSigner).mint(tester, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), false, false).then(t => t.wait());
        expect(false);
      } catch (err) {
        expect(~err.message.indexOf('Ownable: caller is not the owner'));
      }
    });

  });

  describe('Purchase', function () {
    it('Should allow purchasing an enrichment', async () => {
      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), false, false, {
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
      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      try {
        const purchase = await enrichment.connect(testSigner).purchase(1, {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FPNFE: wrong payment value'));
      }
    });

    it('Should fail to purchase if enrichment is not available', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // purchase enrichment
      try {
        const purchase = await enrichment.purchase(999, {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FPNFE: purchase not available'));
      }
    });
  });

  describe('Binding', function () {

    it('Should allow binding an enrichment to a 721', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint enrichment
      await enrichment.mint(tester, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // expect balance
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(1);

      // bind
      const receipt = await enrichment.connect(testSigner).bind(address, id, 1, 'ceramic://testenrichment1').then(t => t.wait());
      console.log('bind gas:', receipt.gasUsed.toString());

      // expect burned
      const newTesterBal = await enrichment.balanceOf(tester, 1);
      expect(newTesterBal.toNumber()).to.be.equal(0);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, id, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, id, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');
    });

    it('Should allow binding a fungible enrichment twice', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint enrichment
      await enrichment.mint(tester, 2, 'ceramic://test', ethers.utils.parseEther('0.01'), true, false, {
        from: deployer
      }).then(t => t.wait());

      // expect balance
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(2);

      // bind
      await enrichment.connect(testSigner).bind(address, id, 1, 'ceramic://testenrichment1').then(t => t.wait());

      // expect burned
      const newTesterBal = await enrichment.balanceOf(tester, 1);
      expect(newTesterBal.toNumber()).to.be.equal(1);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, id, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, id, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');

      // bind again
      await enrichment.connect(testSigner).bind(address, id, 1, '').then(t => t.wait());
      // expect burned
      const newTesterBal2 = await enrichment.balanceOf(tester, 1);
      expect(newTesterBal2.toNumber()).to.be.equal(0);
      // expect nft to have bal
      const enrichmentBal2 = await enrichment.enrichmentBalanceOf(address, id, 1);
      expect(enrichmentBal2.toNumber()).to.be.equal(2);
      // expect enrichmentURI to not have changed
      const enrichmentURI2 = await enrichment.enrichmentURI(address, id, 1);
      expect(enrichmentURI2).to.be.equal('ceramic://testenrichment1');

    });

    it('Should not allow binding a non-fungible enrichment twice', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint enrichment
      await enrichment.mint(tester, 2, 'ceramic://test', ethers.utils.parseEther('0.01'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // expect balance
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(2);

      // bind
      const receipt = await enrichment.connect(testSigner).bind(address, id, 1, 'ceramic://testenrichment1').then(t => t.wait());

      // expect burned
      const newTesterBal = await enrichment.balanceOf(tester, 1);
      expect(newTesterBal.toNumber()).to.be.equal(1);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, id, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, id, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');

      // bind again
      try {
        await enrichment.connect(testSigner).bind(address, id, 1, 'ceramic://testenrichment1').then(t => t.wait());
      } catch(err) {
        expect(~err.message.indexOf('FPNFE: token has enrichment'));
      }
    });

    it('Should allow unbinding a previously bound enrichment', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint non-permanent enrichment
      const e = await enrichment.mint(tester, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // expect balance
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(1);

      // expect not permanent
      const isPermanent = await enrichment.isPermanent(1);
      expect(!isPermanent);

      // --- bind --- //
      await enrichment.connect(testSigner).bind(address, id, 1, 'ceramic://testenrichment1').then(t => t.wait());
      // expect burned
      const newTesterBal = await enrichment.balanceOf(tester, 1);
      expect(newTesterBal.toNumber()).to.be.equal(0);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, id, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, id, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');

      // --- unbind --- //
      await enrichment.connect(testSigner).unbind(address, id, 1).then(t => t.wait());
      // expect balance
      const uTesterBal = await enrichment.balanceOf(tester, 1);
      expect(uTesterBal.toNumber()).to.be.equal(1);
      // expect nft to not hve bal
      const uEnrichmentBal = await enrichment.enrichmentBalanceOf(address, id, 1);
      expect(uEnrichmentBal.toNumber()).to.be.equal(0);
      // expect enrichmentURI to be empty
      const uEnrichmentURI = await enrichment.enrichmentURI(address, id, 1);
      expect(uEnrichmentURI).to.be.empty;
    });

    it('Should not allow unbinding a previously bound permanent enrichment', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint permanent enrichment
      const e = await enrichment.mint(tester, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), false, true, {
        from: deployer
      }).then(t => t.wait());

      // expect balance
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(1);

      // --- bind --- //
      await enrichment.connect(testSigner).bind(address, id, 1, 'ceramic://testenrichment1').then(t => t.wait());
      // expect burned
      const newTesterBal = await enrichment.balanceOf(tester, 1);
      expect(newTesterBal.toNumber()).to.be.equal(0);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, id, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, id, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');

      // --- unbind --- //
      try {
        await enrichment.connect(testSigner).unbind(address, id, 1).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FPNFE: cant be unbound'));
      }

    });

    it('Should fail if enrichment bal is < 1', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint enrichment to deployer
      await enrichment.mint(deployer, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // bind
      try {
        await enrichment.connect(testSigner).bind(address, id, 1, 'ceramic://testenrichment1').then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FPNFE: not enrichment owner'));
      }

    });

    it('Should fail if msg.sender != nft owner', async () => {
      // mint an NFT to deployer
      const { nft, address, id } = await mint721(deployer, deployer, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(deployer);

      // mint enrichment to tester
      await enrichment.mint(tester, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // bind
      try {
        const receipt = await enrichment.connect(testSigner).bind(address, id, 1, 'ceramic://testenrichment1').then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FPNFE: sender does not own token'));
      }
    });

  });

  describe('PurchaseAndBind', function () {

    it('Should allow purchasing and binding an enrichment', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      const purchase = await enrichment.connect(testSigner).purchaseAndBind(1, address, id, 'ceramic://testenrichment1', {
        value: ethers.utils.parseEther('0.02')
      }).then(t => t.wait());
      console.log('purchase gas:', purchase.gasUsed.toString());

      // expect burned
      const testerBal = await enrichment.balanceOf(tester, 1);
      expect(testerBal.toNumber()).to.be.equal(0);
      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, id, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
      // expect enrichmentURI to be set
      const enrichmentURI = await enrichment.enrichmentURI(address, id, 1);
      expect(enrichmentURI).to.be.equal('ceramic://testenrichment1');
    });

    it('Should fail to purchase with wrong payment', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      try {
        const purchase = await enrichment.connect(testSigner).purchaseAndBind(1, address, id, 'ceramic://testenrichment1', {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FPNFE: wrong payment value'));
      }
    });

    it('Should fail to purchase if not owner', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      try {
        const purchase = await enrichment.purchaseAndBind(1, address, 'nottheid', 'ceramic://testenrichment1', {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FPNFE: not token owner'));
      }
    });

    it('Should fail to purchase if enrichment is not available', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // purchase enrichment
      try {
        const purchase = await enrichment.purchaseAndBind(999, address, id, 'ceramic://testenrichment1', {
          value: ethers.utils.parseEther('0.01')
        }).then(t => t.wait());
      } catch (err) {
        expect(~err.message.indexOf('FPNFE: purchase not available'));
      }
    });

    it('Should allow withdrawing funds from PullPayment', async () => {
      // mint an NFT
      const { nft, address, id } = await mint721(deployer, tester, 'ipfs://testtoken');
      const ownerOf = await nft.ownerOf(id);
      expect(ownerOf).to.be.equal(tester);

      // mint an enrichment
      await enrichment.mint(deployer, 10, 'ceramic://test', ethers.utils.parseEther('0.02'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      await enrichment.connect(testSigner).purchaseAndBind(1, address, id, 'ceramic://testenrichment1', {
        value: ethers.utils.parseEther('0.02'),
        from: tester
      })

      const payment = await enrichment.payments(admin);
      const beforeBal = await deploySigner.provider.getBalance(admin);
      const receipt = await enrichment.withdrawPayments(admin).then(t => t.wait());
      const afterBal = await deploySigner.provider.getBalance(admin);

      const p = ethers.utils.formatEther(payment);
      const gas = ethers.utils.formatEther(receipt.gasUsed);
      const total = ethers.utils.formatEther(afterBal.sub(beforeBal));

      expect(p).to.be.equal('0.02');
      expect(total).to.be.equal('0.02');
    });

  });

  describe('Non-standard NFTs', function () {

    it('Should allow owner to set ownerOfFunction', async () => {
      // mint an NFT to deployer
      const { nft, address, id } = await mint721TestFunc(deployer, tester, 'ipfs://testtoken');
      const idToAddress = await nft.idToAddress(id);
      expect(idToAddress).to.be.equal(tester);

      // set a custom ownerOf function
      await enrichment.setOwnerOfFunction(address, 'idToAddress(uint256)', {
        from: deployer
      }).then(t => t.wait());

      // mint enrichment to deployer
      await enrichment.mint(deployer, 1, 'ceramic://test', ethers.utils.parseEther('0.01'), false, false, {
        from: deployer
      }).then(t => t.wait());

      // purchase enrichment
      const purchase = await enrichment.connect(testSigner).purchaseAndBind(1, address, id, 'ceramic://testenrichment1', {
        value: ethers.utils.parseEther('0.01')
      }).then(t => t.wait());

      // expect nft to have bal
      const enrichmentBal = await enrichment.enrichmentBalanceOf(address, id, 1);
      expect(enrichmentBal.toNumber()).to.be.equal(1);
    });

  });
});
