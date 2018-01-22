var SecretNote = artifacts.require('SecretNote');

module.exports = function(deployer) {
  deployer.deploy(SecretNote);
}
