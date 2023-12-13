/// ENVVAR
// - CI:                output gas report to file instead of stdout
// - COVERAGE:          enable coverage report
// - ENABLE_GAS_REPORT: enable gas report
// - COMPILE_MODE:      production modes enables optimizations (default: development)

const fs = require('fs');
const path = require('path');
const proc = require('child_process');

const argv = require('yargs/yargs')()
  .env('')
  .options({
    coverage: {
      type: 'boolean',
      default: false,
    },
    gas: {
      alias: 'enableGasReport',
      type: 'boolean',
      default: false,
    },
    gasReport: {
      alias: 'enableGasReportPath',
      type: 'string',
      implies: 'gas',
      default: undefined,
    },
    mode: {
      alias: 'compileMode',
      type: 'string',
      choices: ['production', 'development'],
      default: 'development',
    },
    ir: {
      alias: 'enableIR',
      type: 'boolean',
      default: false,
    },
    foundry: {
      alias: 'hasFoundry',
      type: 'boolean',
      default: hasFoundry(),
    },
    compiler: {
      alias: 'compileVersion',
      type: 'string',
      default: '0.8.20',
    },
    coinmarketcap: {
      alias: 'coinmarketcapApiKey',
      type: 'string',
    },
  }).argv;

require('@nomiclabs/hardhat-truffle5'); // deprecated
require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-ethers');
require('hardhat-ignore-warnings');
require('hardhat-exposed');
require('solidity-docgen');
argv.foundry && require('@nomicfoundation/hardhat-foundry');

if (argv.foundry && argv.coverage) {
  throw Error('Coverage analysis is incompatible with Foundry. Disable with `FOUNDRY=false` in the environment');
}

const withOptimizations = argv.gas || argv.coverage || argv.compileMode === 'production';

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: withOptimizations,
        runs: 200,
      },
      viaIR: withOptimizations && argv.ir,
      outputSelection: { '*': { '*': ['storageLayout'] } },
    },
  },
  warnings: {
    'contracts-exposed/**/*': {
      'code-size': 'off',
      'initcode-size': 'off',
    },
    '*': {
      'code-size': withOptimizations,
      'unused-param': !argv.coverage, // coverage causes unused-param warnings
      default: 'error',
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: !withOptimizations,
    },
  },
  exposed: {
    imports: true,
    initializers: true,
    exclude: ['vendor/**/*'],
  },
};

if (argv.coverage) {
  require('solidity-coverage');
  module.exports.networks.hardhat.initialBaseFeePerGas = 0;
}

function hasFoundry() {
  return proc.spawnSync('forge', ['-V'], { stdio: 'ignore' }).error === undefined;
}

