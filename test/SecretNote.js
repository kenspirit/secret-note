var SecretNote = artifacts.require('SecretNote');

contract('SecretNote', function(accounts) {
  it('Fallback function available to accept transfer', function() {
    var contractAccount = accounts[0];
    var transferAmount = web3.toWei(1, "ether");
    var originalBalance;

    return SecretNote.deployed()
      .then(function(instance) {
        originalBalance = web3.eth.getBalance(contractAccount);
        return web3.eth.sendTransaction({
          from: accounts[1],
          to: contractAccount,
          value: transferAmount,
          gas: 820621
        });
      })
      .then(function() {
        var newBalance = web3.eth.getBalance(contractAccount);
        assert.equal(newBalance.minus(transferAmount).equals(originalBalance), true);
      })
  });

  it('User count should be 0 initially', function() {
    return SecretNote.deployed()
      .then(function(instance) {
        return instance.getUserCount()
          .then(function(userCount) {
            return assert.equal(userCount, 0);
          });
      });
  });

  it('User count should be 1 after first setNote', function() {
    return SecretNote.deployed()
      .then(function(instance) {
        var noteKey = 'key1';
        var noteContent = 'key2';
        return instance.setNote(noteKey, noteContent, { from: accounts[1] })
          .then(function() {
            return instance.getUserCount();
          })
          .then(function(userCount) {
            return assert.equal(userCount, 1);
          });
      });
  });

  it('User at index 1 should be the first setNote user.', function() {
    return SecretNote.deployed()
      .then(function(instance) {
        var noteKey = 'key1';
        var noteContent = 'key2';
        return instance.setNote(noteKey, noteContent, { from: accounts[1] })
          .then(function() {
            return instance.getUserAddress(1);
          })
          .then(function(addr) {
            return assert.equal(addr, accounts[1]);
          });
      });
  });

  it('Should set & retrieve note correctly', function() {
    return SecretNote.deployed()
      .then(function(instance) {
        var noteKey = web3.toHex('key1');
        var noteContent = 'key2';
        return instance.setNote(noteKey, web3.toHex(noteContent), { from: accounts[1] })
          .then(function() {
            return instance.getNote(noteKey, { from: accounts[1] });
          })
          .then(function(savedContent) {
            return assert.equal(
              web3.toAscii(savedContent).replace(/\u0000/g, ''), noteContent);
          });
      });
  });

  it('Note count should be correct after setting note', function() {
    return SecretNote.deployed()
      .then(function(instance) {
        var noteKey = web3.toHex('key1');
        var noteContent = 'key2';
        return instance.setNote(noteKey, web3.toHex(noteContent), { from: accounts[1] })
          .then(function() {
            return instance.getNoteKeysCount.call({ from: accounts[1] });
          })
          .then(function(count) {
            return assert.equal(count.valueOf(), 1);
          });
      });
  });

  it('Note key should be able to retrieved by index', function() {
    return SecretNote.deployed()
      .then(function(instance) {
        var noteKey = 'key1';
        var noteContent = 'key2';
        return instance.setNote(web3.toHex(noteKey), web3.toHex(noteContent), { from: accounts[1] })
          .then(function() {
            return instance.getNoteKeyByIndex.call(0, { from: accounts[1] });
          })
          .then(function(savedKey) {
            return assert.equal(
              web3.toAscii(savedKey).replace(/\u0000/g, ''), noteKey);
          });
      });
  });

  it('Destroy account should clear user\'s note', function() {
    return SecretNote.deployed()
      .then(function(instance) {
        var noteKey = 'key1';
        var noteContent = 'key2';
        return instance.setNote(web3.toHex(noteKey), web3.toHex(noteContent), { from: accounts[1] })
          .then(function() {
            return instance.destroyAccount({ from: accounts[1] });
          })
          .then(function() {
            return instance.getNoteKeysCount.call({ from: accounts[1] });
          })
          .then(function(count) {
            return assert.equal(count.valueOf(), 0);
          });
      });
  });

  it('Destroy account should move another user\'s index correctly', function() {
    return SecretNote.deployed()
      .then(function(instance) {
        var contractAccount = accounts[0];
        var accountToRemove = accounts[1];
        var accountToMove = accounts[2];

        var noteKey = 'key1';
        var noteContent = 'key2';
        var userCountAfterDestroy;
        return instance.setNote(web3.toHex(noteKey), web3.toHex(noteContent), { from: accountToRemove })
          .then(function() {
            return instance.setNote(web3.toHex(noteKey), web3.toHex(noteContent), { from: accountToMove })
          })
          .then(function() {
            return instance.destroyAccount({ from: accountToRemove });
          })
          .then(function() {
            return instance.getUserCount();
          })
          .then(function(userCount) {
            userCountAfterDestroy = userCount.valueOf();
            return instance.getUserAddress.call(1, { from: contractAccount });
          })
          .then(function(remainedAccount) {
            assert.equal(userCountAfterDestroy, 1);
            assert.equal(remainedAccount, accountToMove);
          });
      });
  });
});
