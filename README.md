# Powerloom Token Contract Project

Uses a standard Hardhat template and includes tests from OpenZeppelin's main [repository](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/release-v5.0/test)

```shell
npm install
npm run test
```

## Local Deployment
1. Run a local hardhat node using `npx hardhat node`
2. Start a separate terminal window and set the `MULTISIG_ADDR` environment variable to the address of the multisig wallet you want to use using `export MULTISIG_ADDR=<multisig_address>`
4. Run the deployment script using `npx hardhat run scripts/deploy.js --network localhost`