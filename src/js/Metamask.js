import { ethers } from 'ethers';
import { IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI } from '../contract/identityOracle.js';
import { SMART_LOCK_CONTRACT_ADDRESS, SMART_LOCK_ABI } from '../contract/SmartLock.js';
import {GOVERNANCE_ADDRESS,GOVERNANCE_ABI} from '../contract/Governance.js'

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

/**
 * 检查是否为系统用户
 * 示例逻辑：使用 IdentityOracle 合约中的 getIdentityExpiry 方法，如果返回值大于 0，则认为用户已验证为系统用户
 */
export const checkSystemUser = async (userAddress) => {
  if (!window.ethereum) return false;
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = provider.getSigner();
    const identityContract = new ethers.Contract(IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI, signer);
    // 这里假设如果身份过期时间不为0，用户已验证（根据业务可进一步判断是否超过当前时间）
    const expiry = await identityContract.getIdentityExpiry(userAddress);
    console.log(`Identity expiry for ${userAddress}:`, expiry.toString());
    return expiry.gt(0); // 如果返回的是 BigNumber
  } catch (error) {
    console.error('Error checking system user:', error);
    alert('检查系统用户状态失败，请重试。');
    return false;
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
export const getUserIdentityExpiry = async (userAddress) => {
  if (!window.ethereum) return null;
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = provider.getSigner();
    const identityContract = new ethers.Contract(IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI, signer);
    const expiry = await identityContract.getIdentityExpiry(userAddress);
    console.log(`Expiry for ${userAddress}:`, expiry.toString());
    return expiry.toNumber();
  } catch (error) {
    console.error('Error getting identity expiry:', error);
    return null;
  }
};


// Metamask.js 新增方法
export const toggleUserLock = async (userAddress, shouldLock) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(SMART_LOCK_CONTRACT_ADDRESS, SMART_LOCK_ABI, signer);

  try {
    let tx;
    if (shouldLock) {
      tx = await contract.lock(userAddress);
    } else {
      tx = await contract.unlock(userAddress);
    }
    const receipt = await tx.wait(); // 等待交易确认
    return { 
      success: true,
      hash: receipt.hash 
    };
  } catch (error) {
    throw error;
  }
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



// *************************************  

// 切换系统锁定状态      
export const toggleLockStatus = async (userAddress, setIsLocked) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(SMART_LOCK_CONTRACT_ADDRESS, SMART_LOCK_ABI, signer);

  try {
    // 获取当前状态
    const currentStatus = await contract.userLockStatus(userAddress);
    
    // 执行相反操作
    if (currentStatus) {
      const tx = await contract.unlock(userAddress);
      await tx.wait();
    } else {
      const tx = await contract.lock(userAddress);
      await tx.wait();
    }

    // 强制刷新状态
    const updatedStatus = await contract.userLockStatus(userAddress);
    setIsLocked(updatedStatus);
    
  } catch (error) {
    console.error('操作失败:', error);
    // 显示具体错误原因
    alert(`操作失败: ${error.reason || error.message}`);
  }
};

// 管理员获取锁的状态
export const checkLockStatus  = async (userAddress)=>{
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer =await provider.getSigner();
  const contract = new ethers.Contract(SMART_LOCK_CONTRACT_ADDRESS,SMART_LOCK_ABI,signer);

  try{
    console.log('Checking lock status for address:',userAddress);
    const lockStatus =await contract.getLockStatus(userAddress);
    console.log('lock status:',lockStatus);
    return lockStatus;
  }catch (error){
    console.log('Error checking lock status:',error);
    return true;// 默认返回关锁状态
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

// 新增updateUserIdentity方法
export const updateUserIdentity = async (userAddress, status) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(IDENTITY_CONTRACT_ADDRESS, IDENTITY_ABI, signer);

  try {
    console.log('Updating identity for:', userAddress, 'Status:', status);
    const tx = await contract.updateUserIdentity(userAddress, status);
    await tx.wait();
    console.log('Transaction confirmed');
    return true;
  } catch (error) {
    console.error('Error updating user identity:', error);
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

// 区块信息
export const fetchTransactionDetails = async (txHash) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    const block = await provider.getBlock(receipt.blockNumber);
    
    return {
      txHash: txHash,
      blockNumber: receipt.blockNumber,
      timestamp: block.timestamp,
      actionType: '合约操作' // 根据实际操作类型修改
    };
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return null;
  }
};