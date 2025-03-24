import { ethers } from 'ethers';
import axios from 'axios';
import { IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI } from '../contract/identityOracle.js';
import { SMART_LOCK_CONTRACT_ADDRESS, SMART_LOCK_ABI } from '../contract/SmartLock.js';
import {GOVERNANCE_ADDRESS,GOVERNANCE_ABI} from '../contract/Governance.js';
const PINATA_API_KEY = process.env.REACT_APP_PINATA_KEY;
const PINATA_SECRET = process.env.REACT_APP_PINATA_SECRET;


// 连接MetaMask，获取用户的地址   
export const checkMetaMask = async () => {
  if (window.ethereum) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      console.log('Connected accounts:', accounts);
      return accounts[0];
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      alert('Failed to connect to MetaMask. Please try again.');
      return null;
    }
  } else {
    alert('Please install MetaMask!');
    return null;
  }
};

/**
 * 检查用户是否为管理员，通过调用 Governance 合约的 isAdmin 方法
 */
export const checkIfAdmin = async (address) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const governanceContract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, provider);
    const isAdmin = await governanceContract.isAdmin(address);
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// 检查用户是否已验证
export const checkIfVerified = async (address) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const identityContract = new ethers.Contract(IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI, provider);
    const isVerified = await identityContract.isVerifiedUser(address);
    return isVerified;
  } catch (error) {
    console.error('Error checking verified status:', error);
    return false;
  }
};

// IPFS上传函数（添加/删除用户）
export const uploadToIPFS = async (content) => {
  try {
    const res = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        timestamp: Date.now(),
        operation: content
      },
      {
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET
        }
      }
    );
    return res.data.IpfsHash;
  } catch (error) {
    if (error.response) {
      console.error('IPFS上传失败，响应数据：', error.response.data);
    } else {
      console.error('IPFS上传失败:', error.message);
    }
    throw new Error('IPFS上传失败');
  
  }
};

// 验证用户
export const verifyuploadToIPFS = async (content) => {
  try {
    const res = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        version: "1.0",
        type: "identity_verification",
        ...content,
        system: "Decentralized Identity System"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET
        }
      }
    );
    return res.data.IpfsHash;
  } catch (error) {
    if (error.response) {
      console.error('IPFS上传失败，响应数据：', error.response.data);
    } else {
      console.error('IPFS上传失败:', error.message);
    }
    throw new Error('IPFS上传失败');
  }
};
// IPFS操作记录上传
export const recordLockOperation = async (userAddress, operationType) => {
  try {
    const operationText = `将用户 ${userAddress} 门锁设为${operationType === 'lock' ? '锁定' : '解锁'}`;
    
    const res = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        operation: operationText,
        timestamp: Date.now(),
        metadata: {
          type: "lock_operation",
          user: userAddress
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: process.env.REACT_APP_PINATA_KEY,
          pinata_secret_api_key: process.env.REACT_APP_PINATA_SECRET
        }
      }
    );
    
    return res.data.IpfsHash;
  } catch (error) {
    console.error('IPFS上传失败:', error);
    throw error;
  }
};

// 锁状态切换函数
export const toggleUserLock = async (userAddress, currentStatus) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS, 
      SMART_LOCK_ABI, 
      signer
    );

    // 生成IPFS记录
    const ipfsHash = await recordLockOperation(
      userAddress, 
      currentStatus ? 'unlock' : 'lock'
    );

    // 调用合约
    const tx = currentStatus ? 
      await contract.unlock(userAddress, ipfsHash) :
      await contract.lock(userAddress, ipfsHash);

    const receipt = await tx.wait();
    return {
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      timestamp: (await provider.getBlock(receipt.blockNumber)).timestamp
    };
  } catch (error) {
    console.error('切换锁状态失败:', error);
    throw error;
  }
};

// 修改后的获取方法
export const getLastLockOperationTime = async (address) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(
    SMART_LOCK_CONTRACT_ADDRESS,
    SMART_LOCK_ABI,
    provider
  );
  
  try {
    const state = await contract.userStates(address);
    return state.lastUnlockTime.toString();
  } catch (error) {
    console.error('Error fetching last operation:', error);
    // 从本地存储获取缓存
    const cached = JSON.parse(localStorage.getItem('lastOperations') || '{}');
    return cached[address] || '0';
  }
};

// 创建提案
export const createProposal = async (description, targetContract, functionSignature, parameters) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const governanceContract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, signer);
    
    const iface = new ethers.Interface([functionSignature]);
    const encodedData = iface.encodeFunctionData(
      functionSignature.split('(')[0],
      parameters.split(',')
    );
    
    const tx = await governanceContract.createProposal(description, targetContract, encodedData);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('Error creating proposal:', error);
    return null;
  }
};

// 获取所有提案
export const getProposals = async () => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const governanceContract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, provider);
    const count = await governanceContract.proposalCount();
    
    const proposals = [];
    for (let i = 0; i < count; i++) {
      const prop = await governanceContract.proposals(i);
      proposals.push({
        id: prop.id,
        description: prop.description,
        status: prop.executed ? 'executed' : 
                prop.voteEnd > Math.floor(Date.now()/1000) ? 'voting' : 'pending',
        approvals: prop.approvals.toString(),
        voteEnd: new Date(prop.voteEnd * 1000)
      });
    }
    return proposals;
  } catch (error) {
    console.error('Error fetching proposals:', error);
    return [];
  }
};

// 对提案投票
export const vote = async (proposalId) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const governanceContract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, signer);
    
    const tx = await governanceContract.vote(proposalId);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('Error voting on proposal:', error);
    return null;
  }
};

// 执行提案
export const executeProposal = async (proposalId) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const governanceContract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, signer);
    
    const tx = await governanceContract.executeProposal(proposalId);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('Error executing proposal:', error);
    return null;
  }
};


/**
 * 获取管理员列表，通过循环调用 Governance 合约中的 admins(uint256) getter
 * 注意：这里假设管理员数量为3，如需动态获取请根据实际情况调整管理员数量（Governance 合约未提供管理员数量的 getter）
 */
export const getAdmins = async () => {
  if (!window.ethereum) return [];
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = provider.getSigner();
    const governanceContract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, signer);
    const adminCount = 3; // 假设当前管理员数量为 3
    const admins = [];
    for (let i = 0; i < adminCount; i++) {
      const admin = await governanceContract.admins(i);
      admins.push(admin);
    }
    console.log("Retrieved admin list:", admins);
    return admins;
  } catch (error) {
    console.error("Error getting admins:", error);
    return [];
  }
};

// 验证过去时间
export const updateUserExpiry = async (userAddress, expiry, ipfsHash) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI, signer);
    const tx = await contract.updateUserExpiry(userAddress, expiry, ipfsHash);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('Error updating user expiry:', error);
    throw error;
  }
};




/**
 * 发送消息给管理员，通过从 Governance 合约动态获取管理员地址
 */
export const sendMessageToAdmin = async (ipfsHash) => {
  if (!window.ethereum) return;
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = provider.getSigner();

    // 获取 Governance 合约实例
    const governanceContract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, signer);
    // 这里取第一个管理员地址作为示例
    const adminAddress = await governanceContract.admins(0);
    console.log("Retrieved admin address:", adminAddress);

    // 调用 SmartLock 合约的 sendMessageToAdmin 方法
    const smartLockContract = new ethers.Contract(SMART_LOCK_CONTRACT_ADDRESS, SMART_LOCK_ABI, signer);
    const tx = await smartLockContract.sendMessageToAdmin(adminAddress, ipfsHash);
    await tx.wait();
    console.log(`Message sent to admin ${adminAddress}`);
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

/**
 * 获取用户身份过期时间（调用 IdentityOracle 合约）
 */
export const getUserIdentityExpiry = async (address) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(
    IDENTITY_CONTRACT_ADDRESS, 
    IDENTITY_ABI, 
    provider
  );
  // 直接调用合约中的getIdentityExpiry方法
  const expiry = await contract.getIdentityExpiry(address);
  return Number(expiry); // 转换为数字
}; 




export const getLockStatus = async (userAddress) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(SMART_LOCK_CONTRACT_ADDRESS, SMART_LOCK_ABI, provider);
  
  try {
    return await contract.userLockStatus(userAddress);
  } catch (error) {
    console.error('Error getting lock status:', error);
    return false;
  }
};

export const getUserUnlockTime = async (userAddress) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(SMART_LOCK_CONTRACT_ADDRESS, SMART_LOCK_ABI, provider);
  
  try {
    const time = await contract.userUnlockTimes(userAddress);
    return Number(time.toString()); // 转换为数字
  } catch (error) {
    console.error('Error getting unlock time:', error);
    return 0;
  }
};

export const  getVerifiedUsers =async() =>{
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI, signer);
  try {
    const users = await contract.getAllVerifiedUsers();
    console.log('Verified Users:', users); // 查看返回的数据
    return users; // 返回正确的格式   
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}







// // ******************************************* 
// 获取锁操作记录    
export const getUserOperationsTable = async (address) => {
  if (!window.ethereum) {
    alert('Please install MetaMask!');
    return [];
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum); 
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(SMART_LOCK_CONTRACT_ADDRESS, SMART_LOCK_ABI, signer);  

    // 获取用户的操作记录   
    const userOperations = await contract.getUserOperations(address);
    console.log('User operations:', userOperations);

    // 获取当前时间戳
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // 将操作记录格式化为表格可以显示的数据   
    const operationsData = userOperations.map((operation, index) => {
      return {
        user: address,
        timestamp: currentTimestamp - (userOperations.length - index) * 60, // 假设每个操作间隔为1分钟
        operation: operation,
      };
    });

    return operationsData; // 返回格式化后的操作记录
  } catch (error) {
    console.error('Error fetching user operations:', error);
    alert('Failed to fetch user operations. Please try again.');
    return []; // 如果有错误，返回空数组
  }
};

export const getUsersWithChangedIdentity = async () => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI, provider);
  // 假设您可以在合约中获取已更改身份状态的用户地址列表
  const users = await contract.getChangedIdentities();
  return users;
};

// updateUserIdentity方法，改变用户身份状态
export const updateUserIdentity = async (userAddress, status) => {
  try {
    // 生成操作描述
    const operationText = status ? 
      `将用户 ${userAddress} 添加为系统用户` : 
      `将用户 ${userAddress} 在系统内删除`;

    // 上传到IPFS
    const ipfsHash = await uploadToIPFS(operationText);

    // 调用合约
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI, signer);
    const tx = await contract.updateUserIdentity(userAddress, status, ipfsHash);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('操作失败:', error);
    throw error;
  }
};

// 添加获取验证时间方法
export const getUserIdentityTimestamp = async (userAddress) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI, signer);

  try {
    const timestamp = await contract.getIdentityTimestamp(userAddress);
    return timestamp;
  } catch (error) {
    console.error('Error getting identity timestamp:', error);
    throw error;
  }
};
// **********************************普通用户
// 普通用户切换锁状态
export const toggleUserLockWithIPFS = async (userAddress, currentStatus) => {
  try {
    // 生成IPFS记录
    const ipfsHash = await recordLockOperation(
      userAddress, 
      currentStatus ? 'unlock' : 'lock'
    );

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS, 
      SMART_LOCK_ABI, 
      signer
    );

    const tx = currentStatus ? 
      await contract.unlock(userAddress, ipfsHash) :
      await contract.lock(userAddress, ipfsHash);

    const receipt = await tx.wait();
    return {
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      timestamp: (await provider.getBlock(receipt.blockNumber)).timestamp
    };
  } catch (error) {
    console.error('切换锁状态失败:', error);
    throw error;
  }
};
// 获取用户最后操作时间（带缓存）
export const getLastOperationTimeWithCache = async (address) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS,
      SMART_LOCK_ABI,
      provider
    );
    const state = await contract.userStates(address);
    const lastOp = Number(state.lastUnlockTime.toString());
    
    // 更新本地缓存
    const cached = JSON.parse(localStorage.getItem('lockOperations') || '{}');
    cached[address] = lastOp;
    localStorage.setItem('lockOperations', JSON.stringify(cached));
    
    return lastOp;
  } catch (error) {
    console.error('从合约获取失败，使用缓存:', error);
    const cached = JSON.parse(localStorage.getItem('lockOperations') || '{}');
    return cached[address] || 0;
  }
};