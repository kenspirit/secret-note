<template>
  <div id="app" v-loading="isLoadingMaskShow">
    <el-row :gutter="24">
      <el-col :span="20" :offset="2">
        <h1>Decentralized Secret Note</h1>
      </el-col>
      <el-col :span="2">
        <a href="https://github.com/kenspirit/secret-note" target="__blank">Github</a>
      </el-col>
    </el-row>
    <el-row :gutter="24">
      <el-col :span="10" :offset="2">
        <h4>Connected to: <small class="text-muted">{{ networkName }}</small></h4>
      </el-col>
      <el-col :span="10">
        <h4>Gas Price: <small class="text-muted">{{ gasPrice }} ETH</small></h4>
      </el-col>
    </el-row>
    <el-row :gutter="24">
      <el-col :span="10" :offset="2">
        <h5>Eth Account: <small class="text-muted">{{ account }}</small></h5>
      </el-col>
    </el-row>
    <el-row :gutter="24">
      <el-col :span="20" :offset="2">
        <el-alert
          title=""
          type="info">
          Blockchain &amp; Dapp development is really exciting.  I hope this tool can benefit any blockchain enthusiast as you.<br/>
          Donation of any ERC20 token to <code>0x713C8C77112858A3bd14A5FB380Fa0c4c5b1A8Bd</code> is greatly appreciated.  I wonder what kind of token I can get. ;)<br/>
          Or send Bitcoin to <code>196XA8S8ZwBu7UNap2A84cLzCAKoPPGck3</code> if you are such a generous rich in blockchain world. :D
        </el-alert>
      </el-col>
    </el-row>
    <el-row :gutter="24" class="main-form">
      <el-col :span="14" :offset="2">
        <el-form ref="noteForm" :model="noteForm" label-width="100px" :label-position="'left'" @submit.native.prevent>
          <el-form-item label="Note Name">
            <el-input v-model="noteForm.noteName" :disabled="isNoteLoaded"></el-input>
            <span>（Note identifier.  Non-updatable.  Prefer short alphanumeric characters.  Truncated if too long）</span>
          </el-form-item>
          <el-form-item label="Content">
            <el-input type="textarea" v-model="noteForm.noteContent" :rows="5"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button size="small" type="primary" @click="saveNote" plain>Save</el-button>
            <el-button size="small" @click="newNote" v-if="isNoteLoaded" plain>New</el-button>
          </el-form-item>
          <el-form-item label="Private Key">
            <el-input type="textarea" v-model="privateKey"></el-input>
          </el-form-item>
          <el-form-item label="Remember">
            <el-switch v-model="isKeySavedLocally" :disabled="localStorageNotAvailable" @change="savePrivateKeyToStorage"></el-switch>
            <el-button size="small" type="primary" @click="generatePrivateKey" plain>Generate</el-button>
          </el-form-item>
          <el-form-item label="">
            <p class="lead">
              <mark>REMEMBER ONLY</mark> in your browser.<br/>
              Private Key is used to <mark>ENCRYPT &amp; DECRYPT</mark> your notes.<br/>
              Please backup locally and safely.
              <mark>IF LOST, NO ONE</mark> is able to restore your notes.
            </p>
          </el-form-item>
        </el-form>
      </el-col>
      <el-col :span="6">
        <h3>Secrets Kept</h3>
        <ul>
          <li v-for="(note) of noteAccount.notes" :key="note.keyHash" @click="openSavedNote(note.keyHash)">{{ note.keyName }}</li>
        </ul>
      </el-col>
    </el-row>
    <el-dialog
      title="Dangerous"
      :visible.sync="dialogVisible"
      width="30%">
      <span>Your private key will be regenerated!<br/>Backup the old one if needed.</span>
      <span slot="footer" class="dialog-footer">
        <el-button size="small" type="danger" @click="dialogVisible = false" plain>Stooop!</el-button>
        <el-button size="small" type="success" @click="confirmGeneratePrivateKey" plain>Proceed</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import Vue from 'vue';
import { Row, Col, Message, Form, FormItem, Input, Button, Switch, Dialog, Loading, Alert } from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css'

// TODO
// Importing this cause getting ipfs content empty.
// Don't know why.  Use MetaMask injected instead.
// import Web3 from 'web3';
import Base58 from 'base-58';
import { Buffer } from 'buffer';
import IpfsApi from 'ipfs-api';
import { JSEncrypt } from 'jsencrypt';

Vue.use(Row);
Vue.use(Col);
Vue.use(Alert);
Vue.use(Form);
Vue.use(FormItem);
Vue.use(Input);
Vue.use(Button);
Vue.use(Switch);
Vue.use(Dialog);
Vue.use(Loading);

let web3js = null;
let ipfs = null;
let storage = null;
let secretNoteInstance = null;
let noteUpdatedEvent = null;

// RINKEBY Testnet
// const CONTRACT_ADDRESS = '0x6c945a26dA250D2FD8A41F9dF5959831A79355b0';
// const CONTRACT_CREATION_BLOCK = 1613212;

// Mainnet
const CONTRACT_ADDRESS = '0xb01b98a50781c454c9daa3d43eb5399ff5b604ee';
const CONTRACT_CREATION_BLOCK = 4950615;

// Taken from Shmigers's answer in
// https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in/
function fromIPFSHash(hash) {
  const bytes = Base58.decode(hash);
  const multiHashId = 2;
  // remove the multihash hash id
  return bytes.slice(multiHashId, bytes.length);
};

function toIPFSHash(str) {
    // remove leading 0x
    const remove0x = str.slice(2, str.length);
    // add back the multihash id
    const bytes = Buffer.from(`1220${remove0x}`, "hex");
    const hash = Base58.encode(bytes);
    return hash;
};

export default {
  name: 'app',
  data () {
    return {
      networkName: 'unknown',
      gasPrice: 0,
      isNetworkReady: false,
      isLoadingMaskShow: false,
      dialogVisible: false,
      account: null,
      noteAccount: {
        latestNoteBlockNumber: CONTRACT_CREATION_BLOCK,
        notes: []
      },
      isNoteLoaded: false,
      localStorageNotAvailable: false,
      isKeySavedLocally: true,
      privateKey: '',
      noteForm: {
        noteName: '',
        noteContent: ''
      }
    }
  },
  created() {
    if (typeof web3 !== 'undefined') {
      // Use MetaMask's provider
      web3js = new Web3(web3.currentProvider);
    } else {
      this.showAlertMsg('Please install <a href="https://metamask.io/" target="__blank">MetaMask</a> extension for your browser before using.', 'warning', 0);
      return;
    }

    this.initStorage();
    this.initContract();
    this.initIPFS();

    // Async
    this.detectNetwork();
    this.getGasPrice();
    this.initAccount();
  },
  methods: {
    detectNetwork() {
      const that = this;
      web3js.version.getNetwork((err, netId) => {
        that.isNetworkReady = true;

        switch (netId) {
          case "1":
            that.networkName = 'mainnet';
            break;
          case "2":
            that.networkName = 'deprecated Morden test network';
            break;
          case "3":
            that.networkName = 'Ropsten test network';
            break;
          case "4":
            that.networkName = 'Rinkeby test network';
            break;
          case "42":
            that.networkName = 'Kovan test network';
            break;
          default:
            that.isNetworkReady = false;
            break;
        }
      });
    },
    initStorage() {
      function noop() {};

      storage = {
        getItem: noop,
        setItem: noop,
        removeItem: noop
      };

      try {
        storage = window.localStorage;
      } catch (e) {
        this.localStorageNotAvailable = true;
        this.isKeySavedLocally = false;
      }
    },
    initContract() {
      var abiArray = [{"constant":true,"inputs":[{"name":"_index","type":"uint256"}],"name":"getNoteKeyByIndex","outputs":[{"name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getNoteKeysCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_user","type":"address"}],"name":"userExisted","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_noteKey","type":"bytes32"},{"name":"_content","type":"bytes32"}],"name":"setNote","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"_index","type":"uint256"}],"name":"getUserAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_noteKey","type":"bytes32"}],"name":"getNote","outputs":[{"name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getUserCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"destroyAccount","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_sender","type":"address"},{"indexed":true,"name":"_noteKey","type":"bytes32"},{"indexed":false,"name":"_success","type":"bool"}],"name":"SecretNoteUpdated","type":"event"}];

      var SecretNote = web3js.eth.contract(abiArray);

      secretNoteInstance = SecretNote.at(CONTRACT_ADDRESS);
    },
    initIPFS() {
      ipfs = IpfsApi('ipfs.infura.io', '5001', { protocol: 'https' });
    },
    getGasPrice() {
      const that = this;
      web3js.eth.getGasPrice(function(err, priceInWei) {
        that.gasPrice = web3js.fromWei(priceInWei, 'ether').toString(10);
      })
    },
    initAccount() {
      function _getAccount() {
        const that = this;

        web3js.eth.getAccounts(function(err, result) {
          if (err) {
            return;
          }

          if (result.length === 0 || result[0] === that.account) {
            return;
          }

          that.account = result[0];

          that.loadPreviousSavedNotes();

          var pk = storage.getItem('pk');
          if (pk) {
            that.privateKey = pk;
            that.isKeySavedLocally = true;
          }
        });
      }

      setInterval(_getAccount.bind(this), 100);
    },
    loadPreviousSavedNotes() {
      const noteAccount = storage.getItem('na:' + this.account);

      if (noteAccount) {
        this.noteAccount = JSON.parse(noteAccount);
      }

      this.loadNotesFromContractEventAndWatch();
    },
    loadNotesFromContractEventAndWatch() {
      if (noteUpdatedEvent) {
        noteUpdatedEvent.stopWatching();
      }

      noteUpdatedEvent = secretNoteInstance.SecretNoteUpdated(
        { _sender: this.account },
        { fromBlock: this.noteAccount.latestNoteBlockNumber + 1, toBlock: 'latest' });

      const that = this;

      noteUpdatedEvent.get(function(err, result) {
        var newNotes = result.filter(function(log) {
          return log.args._success;
        });

        if (newNotes.length === 0) {
          // No new note since last check
          that.updateNoteToStorage();
          noteUpdatedEvent.watch(that.addNewNoteFromLog.bind(that));
          return;
        }

        that.noteAccount.latestNoteBlockNumber = newNotes[newNotes.length - 1].blockNumber;

        newNotes = newNotes.map(function(log) {
          return {
            keyHash: log.args._noteKey,
            keyName: web3js.toAscii(log.args._noteKey)
          }
        });

        that.addNewNotes(newNotes);

        that.updateNoteToStorage();

        noteUpdatedEvent.watch(that.addNewNoteFromLog.bind(that));
      });
    },
    updateNoteToStorage() {
      storage.setItem('na:' + this.account, JSON.stringify(this.noteAccount));
    },
    addNewNotes(newNotes) {
      const that = this;

      newNotes.forEach(function(newNote) {
        var index = that.noteAccount.notes.findIndex(function(note) {
          return note.keyHash === newNote.keyHash;
        })

        if (index === -1) {
          that.noteAccount.notes.splice(0, 0, newNote); // Add to the beginning
        }
      });
    },
    addNewNoteFromLog(err, log) {
      var newNote = {
        keyHash: log.args._noteKey,
        keyName: web3js.toAscii(log.args._noteKey)
      };

      this.addNewNotes([newNote]);
    },
    saveNote() {
      if (!this.account || !this.isNetworkReady) {
        this.showAlertMsg('Please check MetaMask network and account.');
        return false;
      }

      const that = this;
      const privateKey = this.privateKey;
      const noteName = this.noteForm.noteName;
      const noteContent = this.noteForm.noteContent;

      if (!noteName || !noteContent || !privateKey) {
        this.showAlertMsg('Missing Note Name, Note Content or Private Key.');
        return false;
      }

      const encryptApi = new JSEncrypt();
      encryptApi.setPrivateKey(privateKey);

      ipfs.files.add(new Buffer(encryptApi.encrypt(noteContent)), function(err, res) {
        const ipfsFile = res[0];

        const nameHash = web3js.toHex(noteName);

        const newHash = '0x' + new Buffer(fromIPFSHash(ipfsFile.hash)).toString('hex');

        secretNoteInstance.setNote(nameHash, newHash, function (err, txHash) {
          if (err) {
            that.showAlertMsg('Failed.  Please check trx or try again later.', 'error');
            return;
          }

          that.showAlertMsg('Trx submiteed successfully.  Once confirmed, note will be listed.', 'success');
          that.isNoteLoaded = true;
        });
      });

      return false;
    },
    newNote() {
      this.noteForm.noteName = '';
      this.noteForm.noteContent = '';
      this.isNoteLoaded = false;
    },
    openSavedNote(keyHash) {
      this.showLoadingMask(true);

      const that = this;

      secretNoteInstance.getNote(keyHash, function(err, noteContent) {
        if (err) {
          that.showLoadingMask(false);
          console.log(err);
          that.showAlertMsg('Failed to load note.  Please try again later', 'error');
          return;
        }

        if (!noteContent) {
          that.showLoadingMask(false);
          return;
        }

        if (!that.privateKey) {
          that.showLoadingMask(false);
          that.noteForm.noteName = web3js.toAscii(keyHash);
          that.noteForm.noteContent = noteContent;
          that.isNoteLoaded = true;
          return;
        }

        var encryptApi = new JSEncrypt();
        encryptApi.setPrivateKey(that.privateKey);

        var ipfsHash = toIPFSHash(noteContent);

        ipfs.files.cat(ipfsHash, function(err, file) {
          that.showLoadingMask(false);
          if (err) {
            console.log(err);
            that.showAlertMsg('Failed to load note.  Please try again later', 'error');
            return;
          }

          that.noteForm.noteName = web3js.toAscii(keyHash);
          that.noteForm.noteContent = encryptApi.decrypt(file.toString());
          that.isNoteLoaded = true;
        });
      });
    },
    showLoadingMask(isShow) {
      this.isLoadingMaskShow = isShow;
    },
    showAlertMsg(alertMsg, alertType = 'warning', duration = 3500) {
      this.$notify({
        title: '',
        dangerouslyUseHTMLString: true,
        message: alertMsg,
        type: alertType,
        showClose: true,
        center: true,
        duration
      });
    },
    generatePrivateKey() {
      this.dialogVisible = true;
    },
    savePrivateKeyToStorage() {
      if (this.isKeySavedLocally) {
        storage.setItem('pk', this.privateKey);
      } else {
        storage.removeItem('pk');
      }
    },
    confirmGeneratePrivateKey() {
      var encryptApi = new JSEncrypt();

      this.privateKey = encryptApi.getPrivateKey();
      this.savePrivateKeyToStorage();

      this.dialogVisible = false;
    }
  }
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin-top: 20px;
}

h1, h2, h3, h4, h5, h6 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-family: inherit;
  font-weight: 500;
  line-height: 1.2;
  color: inherit;
}

ul {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-orient: vertical;
  -webkit-box-direction: normal;
  -ms-flex-direction: column;
  flex-direction: column;
  padding-left: 0;
  margin-top: 0;
  margin-bottom: 0;
}

li:first-child {
  border-top-left-radius: .25rem;
  border-top-right-radius: .25rem;
}

li {
  position: relative;
  display: block;
  padding: .75rem 1.25rem;
  margin-bottom: -1px;
  background-color: #fff;
  border: 1px solid rgba(0,0,0,.125);
}

li:hover {
  cursor: pointer;
  background-color: #2C3E50;
  color: white;
  font-weight: bold;
}

p {
  margin: 0;
  font-size: 1.1rem;
  line-height: normal;
}

.text-muted {
  color: #6c757d!important;
}

.main-form {
  margin-top: 20px;
}

code {
  color: #000;
  background-color: #f9fafc;
  padding: 0 4px;
  border: 1px solid #eaeefb;
  border-radius: 4px;
}
</style>
