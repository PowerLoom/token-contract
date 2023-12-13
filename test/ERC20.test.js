const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

const {
  shouldBehaveLikeERC20,
} = require('./ERC20.behavior.js');

const TOKENS = [{ Token: 'PowerloomToken' }];

const name = 'Powerloom Token';
const symbol = 'POWER';
const initialSupply = 1000000000000000000000000000n;

describe('ERC20', function () {
  for (const { Token, forcedApproval } of TOKENS) {
    describe(Token, function () {
      const fixture = async () => {
        const [initialHolder, recipient, anotherAccount] = await ethers.getSigners();
        const token = await ethers.deployContract(Token, [initialHolder.address]);

        return { initialHolder, recipient, anotherAccount, token };
      };

      beforeEach(async function () {
        Object.assign(this, await loadFixture(fixture));
      });

      shouldBehaveLikeERC20(initialSupply, { forcedApproval });

      it('has a name', async function () {
        expect(await this.token.name()).to.equal(name);
      });

      it('has a symbol', async function () {
        expect(await this.token.symbol()).to.equal(symbol);
      });

      it('has 18 decimals', async function () {
        expect(await this.token.decimals()).to.equal(18n);
      });

    });
  }
});
