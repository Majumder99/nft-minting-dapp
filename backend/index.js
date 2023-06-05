const express = require("express");
const multer = require("multer");
const cors = require("cors");
const axios = require("axios");
const FormData = require("form-data");
const Blob = require("node-blob");
const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());

const upload = multer({
  limits: {
    fileSize: 100000000,
  },
});

const starton = axios.create({
  baseURL: "https://api.starton.io/v3",
  headers: {
    "x-api-key": "your_api_key",
  },
});

console.log("Starton", starton);

app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("req, res", req, res);
  let data = new FormData();
  let files = JSON.parse(req.file);
  const blob = new Blob([files.buffer], { type: files.mimetype });
  data.append("file", blob, { filename: files.originalname });
  data.append("isSync", "true");

  console.log("After blob", data, blob);

  async function uploadImageOnIpfs() {
    console.log("Inside upload image");
    const ipfsImg = await starton.post("/ipfs/file", data, {
      headers: {
        "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
      },
    });
    return ipfsImg.data;
  }
  async function uploadMetadataOnIpfs(imgCid) {
    console.log("Inside upload metadata");
    const metadataJson = {
      name: `A Wonderful NFT`,
      description: `Probably the most awesome NFT ever created !`,
      image: `ipfs://ipfs/${imgCid}`,
    };
    const myfile = {
      name: "My NFT metadata Json",
      content: JSON.stringify(metadataJson),
      isSync: true,
    };
    const ipfsMetadata = await starton.post(
      "/ipfs/json",
      JSON.stringify(myfile)
    );
    return ipfsMetadata.data;
  }

  const SMART_CONTRACT_NETWORK = "polygon-mumbai";
  const SMART_CONTRACT_ADDRESS = "0xfCdA9b93dC979E15B4abEA11050bE650A56c1F17";
  const WALLET_IMPORTED_ON_STARTON =
    "0xBE9De86317a30fCAB04649Cede9B0B2861619677";
  async function mintNFT(receiverAddress, metadataCid) {
    console.log("Inside mintnft");
    const nft = await starton.post(
      `/smart-contract/${SMART_CONTRACT_NETWORK}/${SMART_CONTRACT_ADDRESS}/call`,
      {
        functionName: "mint",
        signerWallet: WALLET_IMPORTED_ON_STARTON,
        speed: "low",
        params: [receiverAddress, metadataCid],
      }
    );
    return nft.data;
  }
  const RECEIVER_ADDRESS = "0xaa7C5D530d4CA9A4a2b18c5cdf4Dd92CB6b9d897";
  const ipfsImgData = await uploadImageOnIpfs();
  const ipfsMetadata = await uploadMetadataOnIpfs(ipfsImgData.cid);
  console.log("Imagedata and metadata", ipfsImgData, ipfsMetadata);
  const nft = await mintNFT(RECEIVER_ADDRESS, ipfsMetadata.cid);
  console.log(nft);
  res.status(201).json({
    transactionHash: nft.transactionHash,
    cid: ipfsImgData.cid,
  });
});
app.listen(port, () => {
  console.log("Server is running on port " + port);
});
