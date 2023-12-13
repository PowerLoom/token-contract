const { constants, expectEvent, time } = require('@openzeppelin/test-helpers');

const { MAX_UINT256, ZERO_ADDRESS } = constants;

const { fromRpcSig } = require('ethereumjs-util');
const ethSigUtil = require('eth-sig-util');
const Wallet = require('ethereumjs-wallet').default;

const { shouldBehaveLikeERC6372 } = require('./ERC6372.behavior');
const {
  getDomain,
  domainType,
  types: { Delegation },
} = require('./helpers/eip712');
const { clockFromReceipt } = require('./helpers/time');
const { expectRevertCustomError } = require('./helpers/customError');

const buildAndSignDelegation = (contract, message, pk) =>
  getDomain(contract)
    .then(domain => ({
      primaryType: 'Delegation',
      types: { EIP712Domain: domainType(domain), Delegation },
      domain,
      message,
    }))
    .then(data => fromRpcSig(ethSigUtil.signTypedMessage(pk, { data })));

function shouldBehaveLikeVotes(accounts, tokens, { mode = 'blocknumber', fungible = true }) {
  shouldBehaveLikeERC6372(mode);

  const getWeight = token => web3.utils.toBN(fungible ? token : 1);

  describe('run votes workflow', function () {
    it('initial nonce is 0', async function () {
      expect(await this.votes.nonces(accounts[0])).to.be.bignumber.equal('0');
    });

    describe('delegation with signature', function () {
      const token = tokens[0];

      it('delegation without tokens', async function () {
        expect(await this.votes.delegates(accounts[1])).to.be.equal(ZERO_ADDRESS);

        const { receipt } = await this.votes.delegate(accounts[1], { from: accounts[1] });
        expectEvent(receipt, 'DelegateChanged', {
          delegator: accounts[1],
          fromDelegate: ZERO_ADDRESS,
          toDelegate: accounts[1],
        });
        expectEvent.notEmitted(receipt, 'DelegateVotesChanged');

        expect(await this.votes.delegates(accounts[1])).to.be.equal(accounts[1]);
      });

      it('delegation with tokens', async function () {
        const weight = getWeight(token);

        expect(await this.votes.delegates(accounts[1])).to.be.equal(ZERO_ADDRESS);

        const { receipt } = await this.votes.delegate(accounts[1], { from: accounts[1] });
        const timepoint = await clockFromReceipt[mode](receipt);

        expectEvent(receipt, 'DelegateChanged', {
          delegator: accounts[1],
          fromDelegate: ZERO_ADDRESS,
          toDelegate: accounts[1],
        });
  
        expect(await this.votes.delegates(accounts[1])).to.be.equal(accounts[1]);
        expect(await this.votes.getVotes(accounts[1])).to.be.bignumber.equal(weight);
        expect(await this.votes.getPastVotes(accounts[1], timepoint - 1)).to.be.bignumber.equal('0');
        await time.advanceBlock();
        expect(await this.votes.getPastVotes(accounts[1], timepoint)).to.be.bignumber.equal(weight);
      });

      it('delegation update', async function () {
        await this.votes.delegate(accounts[1], { from: accounts[1] });
        const weight = getWeight(token);

        expect(await this.votes.delegates(accounts[1])).to.be.equal(accounts[1]);
        expect(await this.votes.getVotes(accounts[1])).to.be.bignumber.equal(weight);
        expect(await this.votes.getVotes(accounts[2])).to.be.bignumber.equal('0');

        const { receipt } = await this.votes.delegate(accounts[2], { from: accounts[1] });
        const timepoint = await clockFromReceipt[mode](receipt);

        expectEvent(receipt, 'DelegateChanged', {
          delegator: accounts[1],
          fromDelegate: accounts[1],
          toDelegate: accounts[2],
        });
        expectEvent(receipt, 'DelegateVotesChanged', {
          delegate: accounts[1],
          previousVotes: weight,
          newVotes: '0',
        });
        expectEvent(receipt, 'DelegateVotesChanged', {
          delegate: accounts[2],
          previousVotes: '0',
          newVotes: weight,
        });

        expect(await this.votes.delegates(accounts[1])).to.be.equal(accounts[2]);
        expect(await this.votes.getVotes(accounts[1])).to.be.bignumber.equal('0');
        expect(await this.votes.getVotes(accounts[2])).to.be.bignumber.equal(weight);

        expect(await this.votes.getPastVotes(accounts[1], timepoint - 1)).to.be.bignumber.equal(weight);
        expect(await this.votes.getPastVotes(accounts[2], timepoint - 1)).to.be.bignumber.equal('0');
        await time.advanceBlock();
        expect(await this.votes.getPastVotes(accounts[1], timepoint)).to.be.bignumber.equal('0');
        expect(await this.votes.getPastVotes(accounts[2], timepoint)).to.be.bignumber.equal(weight);
      });

      describe('with signature', function () {
        const delegator = Wallet.generate();
        const [delegatee, other] = accounts;
        const nonce = 0;
        delegator.address = web3.utils.toChecksumAddress(delegator.getAddressString());

        it('accept signed delegation', async function () {
          const weight = getWeight(token);

          const { v, r, s } = await buildAndSignDelegation(
            this.votes,
            {
              delegatee,
              nonce,
              expiry: MAX_UINT256,
            },
            delegator.getPrivateKey(),
          );

          expect(await this.votes.delegates(delegator.address)).to.be.equal(ZERO_ADDRESS);

          const { receipt } = await this.votes.delegateBySig(delegatee, nonce, MAX_UINT256, v, r, s);
          const timepoint = await clockFromReceipt[mode](receipt);

          expectEvent(receipt, 'DelegateChanged', {
            delegator: delegator.address,
            fromDelegate: ZERO_ADDRESS,
            toDelegate: delegatee,
          });
          

          expect(await this.votes.delegates(delegator.address)).to.be.equal(delegatee);
          expect(await this.votes.getVotes(delegator.address)).to.be.bignumber.equal('0');
          expect(await this.votes.getVotes(delegatee)).to.be.bignumber.equal(weight);
          expect(await this.votes.getPastVotes(delegatee, timepoint - 1)).to.be.bignumber.equal('0');
          await time.advanceBlock();
          expect(await this.votes.getPastVotes(delegatee, timepoint)).to.be.bignumber.equal(weight);
        });

        it('rejects reused signature', async function () {
          const { v, r, s } = await buildAndSignDelegation(
            this.votes,
            {
              delegatee,
              nonce,
              expiry: MAX_UINT256,
            },
            delegator.getPrivateKey(),
          );

          await this.votes.delegateBySig(delegatee, nonce, MAX_UINT256, v, r, s);

          await expectRevertCustomError(
            this.votes.delegateBySig(delegatee, nonce, MAX_UINT256, v, r, s),
            'InvalidAccountNonce',
            [delegator.address, nonce + 1],
          );
        });

        it('rejects bad delegatee', async function () {
          const { v, r, s } = await buildAndSignDelegation(
            this.votes,
            {
              delegatee,
              nonce,
              expiry: MAX_UINT256,
            },
            delegator.getPrivateKey(),
          );

          const receipt = await this.votes.delegateBySig(other, nonce, MAX_UINT256, v, r, s);
          const { args } = receipt.logs.find(({ event }) => event === 'DelegateChanged');
          expect(args.delegator).to.not.be.equal(delegator.address);
          expect(args.fromDelegate).to.be.equal(ZERO_ADDRESS);
          expect(args.toDelegate).to.be.equal(other);
        });

        it('rejects bad nonce', async function () {
          const { v, r, s } = await buildAndSignDelegation(
            this.votes,
            {
              delegatee,
              nonce: nonce + 1,
              expiry: MAX_UINT256,
            },
            delegator.getPrivateKey(),
          );

          await expectRevertCustomError(
            this.votes.delegateBySig(delegatee, nonce + 1, MAX_UINT256, v, r, s),
            'InvalidAccountNonce',
            [delegator.address, 0],
          );
        });

        it('rejects expired permit', async function () {
          const expiry = (await time.latest()) - time.duration.weeks(1);
          const { v, r, s } = await buildAndSignDelegation(
            this.votes,
            {
              delegatee,
              nonce,
              expiry,
            },
            delegator.getPrivateKey(),
          );

          await expectRevertCustomError(
            this.votes.delegateBySig(delegatee, nonce, expiry, v, r, s),
            'VotesExpiredSignature',
            [expiry],
          );
        });
      });
    });

    describe('getPastTotalSupply', function () {
      beforeEach(async function () {
        await this.votes.delegate(accounts[1], { from: accounts[1] });
      });

      it('reverts if block number >= current block', async function () {
        const timepoint = 5e10;
        const clock = await this.votes.clock();
        await expectRevertCustomError(this.votes.getPastTotalSupply(timepoint), 'ERC5805FutureLookup', [
          timepoint,
          clock,
        ]);
      });

      it('returns 0 if there are no checkpoints', async function () {
        expect(await this.votes.getPastTotalSupply(0)).to.be.bignumber.equal('0');
      });

    });

    // The following tests are an adaptation of
    // https://github.com/compound-finance/compound-protocol/blob/master/tests/Governance/CompTest.js.
    describe('Compound test suite', function () {
      beforeEach(async function () {
      });

      describe('getPastVotes', function () {
        it('reverts if block number >= current block', async function () {
          const clock = await this.votes.clock();
          const timepoint = 5e10; // far in the future
          await expectRevertCustomError(this.votes.getPastVotes(accounts[2], timepoint), 'ERC5805FutureLookup', [
            timepoint,
            clock,
          ]);
        });

        it('returns 0 if there are no checkpoints', async function () {
          expect(await this.votes.getPastVotes(accounts[2], 0)).to.be.bignumber.equal('0');
        });

        it('returns the latest block if >= last checkpoint block', async function () {
          const { receipt } = await this.votes.delegate(accounts[2], { from: accounts[1] });
          const timepoint = await clockFromReceipt[mode](receipt);
          await time.advanceBlock();
          await time.advanceBlock();

          const latest = await this.votes.getVotes(accounts[2]);
          expect(await this.votes.getPastVotes(accounts[2], timepoint)).to.be.bignumber.equal(latest);
          expect(await this.votes.getPastVotes(accounts[2], timepoint + 1)).to.be.bignumber.equal(latest);
        });

        it('returns zero if < first checkpoint block', async function () {
          await time.advanceBlock();
          const { receipt } = await this.votes.delegate(accounts[2], { from: accounts[1] });
          const timepoint = await clockFromReceipt[mode](receipt);
          await time.advanceBlock();
          await time.advanceBlock();

          expect(await this.votes.getPastVotes(accounts[2], timepoint - 1)).to.be.bignumber.equal('0');
        });
      });
    });
  });
}

module.exports = {
  shouldBehaveLikeVotes,
};
