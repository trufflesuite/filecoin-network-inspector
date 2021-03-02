import types from "../constants";
import { FilecoinNumber } from "@openworklabs/filecoin-number";
import { getClient } from "../../utils/lotus";
import { ipfs } from "../../utils/ipfs";
const client = getClient();

const dealStateNames = [
  // Unknown means the current status of a deal is undefined
  "Unknown",

  // ProposalNotFound is a status returned in responses when the deal itself cannot
  // be located
  "ProposalNotFound",

  // ProposalRejected is returned by a StorageProvider when it chooses not to accept
  // a DealProposal
  "ProposalRejected",

  // ProposalAccepted indicates an intent to accept a storage deal proposal
  "ProposalAccepted",

  // Staged means a deal has been published and data is ready to be put into a sector
  "Staged",

  // Sealing means a deal is in a sector that is being sealed
  "Sealing",

  // Finalizing means a deal is in a sealed sector and we're doing final
  // housekeeping before marking it active
  "Finalizing",

  // Active means a deal is in a sealed sector and the miner is proving the data
  // for the deal
  "Active",

  // Expired means a deal has passed its final epoch and is expired
  "Expired",

  // Slashed means the deal was in a sector that got slashed from failing to prove
  "Slashed",

  // Rejecting means the Provider has rejected the deal, and will send a rejection response
  "Rejecting",

  // Failing means something has gone wrong in a deal. Once data is cleaned up the deal will finalize on
  // Error
  "Failing",

  // FundsReserved means we've deposited funds as necessary to create a deal, ready to move forward
  "FundsReserved",

  // CheckForAcceptance means the client is waiting for a provider to seal and publish a deal
  "CheckForAcceptance",

  // Validating means the provider is validating that deal parameters are good for a proposal
  "Validating",

  // AcceptWait means the provider is running any custom decision logic to decide whether or not to accept the deal
  "AcceptWait",

  // StartDataTransfer means data transfer is beginning
  "StartDataTransfer",

  // Transferring means data is being sent from the client to the provider via the data transfer module
  "Transferring",

  // WaitingForData indicates either a manual transfer
  // or that the provider has not received a data transfer request from the client
  "WaitingForData",

  // VerifyData means data has been transferred and we are attempting to verify it against the PieceCID
  "VerifyData",

  // ReserveProviderFunds means that provider is making sure it has adequate funds for the deal in the StorageMarketActor
  "ReserveProviderFunds",

  // ReserveClientFunds means that client is making sure it has adequate funds for the deal in the StorageMarketActor
  "ReserveClientFunds",

  // ProviderFunding means that the provider has deposited funds in the StorageMarketActor and it is waiting
  // to see the funds appear in its balance
  "ProviderFunding",

  // ClientFunding means that the client has deposited funds in the StorageMarketActor and it is waiting
  // to see the funds appear in its balance
  "ClientFunding",

  // Publish means the deal is ready to be published on chain
  "Publish",

  // Publishing means the deal has been published but we are waiting for it to appear on chain
  "Publishing",

  // Error means the deal has failed due to an error, and no further updates will occur
  "Error",

  // ProviderTransferAwaitRestart means the provider has restarted while data
  // was being transferred from client to provider, and will wait for the client to
  // resume the transfer
  "ProviderTransferAwaitRestart",

  // ClientTransferRestart means a storage deal data transfer from client to provider will be restarted
  // by the client
  "ClientTransferRestart",

  // AwaitingPreCommit means a deal is ready and must be pre-committed
  "AwaitingPreCommit"
];

export const getChainStats = () => async (dispatch) => {
  client.chainNotify((changes) => {
    dispatch({
      type: types.GET_CHAIN_STATS,
      payload: changes,
    });
  });
};

export const getWalletDetails = () => async (dispatch) => {
  const nodeClient = getClient({ nodeNumber: 0, nodeOrMiner: "node" });
  const defaultWalletAddress = await nodeClient.walletDefaultAddress();
  const balance = await nodeClient.walletBalance(defaultWalletAddress);
  const filBalance = new FilecoinNumber(balance, "attofil");
  dispatch({
    type: types.GET_WALLET_DETAILS,
    payload: {
      address: defaultWalletAddress,
      balance: filBalance.toFil(),
    },
  });
};

export const uploadToFilecoin = (payload) => async (dispatch) => {
  // Adding file to IPFS
  const nodeClient = getClient({ nodeNumber: 0, nodeOrMiner: "node" });

  for await (const result of ipfs.add(payload.fileBuffer)) {
    // Creating a Storage Deal with a Miner
    const dataRef = {
      Data: {
        TransferType: "graphsync",
        Root: {
          "/": result.path,
        },
        PieceCid: null,
        PieceSize: 0,
      },
      Wallet: payload.defaultWalletAddress,
      Miner: payload.targetMiner,
      EpochPrice: payload.epochPrice,
      MinBlocksDuration: 300,
    };

    const deal = await nodeClient.clientStartDeal(dataRef);

    document.getElementById("uploadToFilecoin").innerText =
      "Upload to Filecoin Network";

    dispatch({
      type: types.ADD_DATA_TO_FILECOIN,
      payload: {
        id: deal["/"],
        cid: result.path,
      },
    });
  }
};
export const getClientDeals = () => async (dispatch) => {
  const nodeClient = getClient({ nodeNumber: 0, nodeOrMiner: "node" });
  let clientDeals = await nodeClient.clientListDeals();
  clientDeals = clientDeals.map((deal) => {
    let color;
    switch (deal.State) {
      case 6:
        color = "green";
        break;
      case 22:
        color = "red";
        break;
      default:
        color = "grey";
        break;
    }
    return { ...deal, stateName: dealStateNames[deal.State], color: color };
  });
  dispatch({
    type: types.GET_CLIENT_DEALS,
    payload: clientDeals.sort(dynamicsort("DealID")),
  });
};

export const getStorageDealStatus = (payload) => async (dispatch) => {
  const nodeClient = getClient({ nodeNumber: 0, nodeOrMiner: "node" });
  const dealInfo = await nodeClient.ClientGetDealInfo([{ "/": payload.cid }]);
  console.log({ dealInfo });
};

export const getAllStorageDealsStatus = (payload) => async (dispatch) => {
  const nodeClient = getClient({ nodeNumber: 0, nodeOrMiner: "node" });
  const deals = await nodeClient.clientListDeals();
  console.log({ deals });
};

export const getDataFromFilecoinNetwork = (payload) => async (dispatch) => {
  const nodeClient = getClient({ nodeNumber: 0, nodeOrMiner: "node" });
  window.nodeClient = nodeClient;

  // Check if the cid is available locally on the node or not
  const hasLocal = await nodeClient.clientHasLocal({ "/": payload.cid });
  console.log({ hasLocal });

  // Fetch the retrieval offer from the lotus node
  const offers = await nodeClient.clientFindData({ "/": payload.cid });
  console.log({ offers });

  const retrievalOffer = {
    Root: offers[0].Root,
    Size: offers[0].Size,
    Total: offers[0].MinPrice,
    PaymentInterval: offers[0].PaymentInterval,
    PaymentIntervalIncrease: offers[0].PaymentIntervalIncrease,
    Client: payload.walletAddress,
    Miner: offers[0].Miner,
    MinerPeerID: offers[0].MinerPeerID,
  };

  // const ask = await nodeClient.clientQueryAsk(
  //   "12D3KooWGzxzKZYveHXtpG6AsrUJBcWxHBFS2HsEoGTxrMLvKXtf",
  //   "t01234"
  // );

  const randomId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  console.log({ retrievalOffer });
  const fileRef = {
    Path: `/home/vasa/Desktop/filecoin/lotus/${payload.cid}-${randomId}.txt`,
    IsCAR: false,
  };
  console.log("clientRetrieve", retrievalOffer, fileRef);
  const result = await nodeClient.clientRetrieve(retrievalOffer, fileRef);

  console.log("Retrieve result", result);
  console.log({
    url:
      `http://localhost:7777/` +
      `0/testplan/downloads/` +
      `${payload.cid}-${randomId}.txt`,
  });
};

export const stateListMiners = () => async (dispatch) => {
  let result = await client.stateListMiners([]);
  result = result.map(async (miner) => {
    let minerPow = await client.stateMinerPower(miner, []);
    return { name: miner, power: minerPow };
  });
  Promise.all(result).then((values) => {
    dispatch({
      type: types.STATE_LIST_MINERS,
      payload: values,
    });
  });
};

export const getChainHead = () => async (dispatch) => {
  const chainHead = await client.chainHead();
  dispatch({
    type: types.GET_CHAIN_HEAD,
    payload: chainHead,
  });
};

export const getMinerAddress = () => async (dispatch) => {
  const minerClient = getClient({ nodeNumber: 0, nodeOrMiner: "miner" });
  const address = await minerClient.actorAddress();
  dispatch({
    type: types.GET_MINER_ADDRESS,
    payload: address,
  });
};

function dynamicsort(property, order) {
  var sort_order = 1;
  if (order === "desc") {
    sort_order = -1;
  }
  return function (a, b) {
    // a should come before b in the sorted order
    if (a[property] < b[property]) {
      return -1 * sort_order;
      // a should come after b in the sorted order
    } else if (a[property] > b[property]) {
      return 1 * sort_order;
      // a and b are the same
    } else {
      return 0 * sort_order;
    }
  };
}
