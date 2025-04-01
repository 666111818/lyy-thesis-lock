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
      console.log('Pinata响应:', res.data); // 添加日志
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
      const governanceContract = new ethers.Contract(
        GOVERNANCE_ADDRESS,
        GOVERNANCE_ABI,
        provider
      );
      
      // 直接调用合约的 getAdmins 方法
      const admins = await governanceContract.getAdmins();
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
    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS, 
      SMART_LOCK_ABI, 
      provider
    );
    
    try {
      // 获取完整的用户状态
      const state = await contract.userStates(userAddress);
      return {
        isLocked: state.isLocked,
        lastUnlockTime: state.lastUnlockTime.toString()
      };
    } catch (error) {
      console.error('获取锁状态失败:', error);
      return {
        isLocked: false,
        lastUnlockTime: '0'
      };
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
  // 修改后的普通用户切换锁状态方法
  export const toggleUserLockWithIPFS = async (userAddress, currentLockStatus) => {
    try {
      // 生成IPFS记录（参数顺序修正）
      const ipfsHash = await recordLockOperation(
        userAddress, 
        currentLockStatus ? 'unlock' : 'lock' // 根据当前状态反向操作
      );

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        SMART_LOCK_CONTRACT_ADDRESS, 
        SMART_LOCK_ABI, 
        signer
      );

      // 正确调用合约方法
      let tx;
      if (currentLockStatus) {
        // 当前状态为锁定，执行解锁
        tx = await contract.unlock(userAddress, ipfsHash);
      } else {
        // 当前状态为解锁，执行锁定
        tx = await contract.lock(userAddress, ipfsHash);
      }

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

  export const getUserOperations = async (address) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        SMART_LOCK_CONTRACT_ADDRESS,
        SMART_LOCK_ABI,
        provider
      );

      // 查询LockOperation事件
      const filter = contract.filters.LockOperation(address);
      const events = await contract.queryFilter(filter);

      // 格式化事件数据
      return events.map(event => ({
        user: event.args.user,
        timestamp: event.args.timestamp.toString(),
        operation: event.args.operation,
        ipfsHash: event.args.ipfsHash
      }));
    } catch (error) {
      console.error('获取操作记录失败:', error);
      return [];
    }
  };

  // ***********************对话
  
 
// 在getReceivedMessages中添加地址校验
export const getReceivedMessages = async () => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const userAddress = (await signer.getAddress()).toLowerCase();

    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS,
      SMART_LOCK_ABI,
      signer  // 使用signer代替provider进行写入操作
    );

    const messages = await contract.getMyReceivedMessages();
    
    return messages
      .map(msg => ({
        sender: msg.sender.toLowerCase(),
        receiver: msg.receiver.toLowerCase(),
        timestamp: msg.timestamp,
        ipfsHash: msg.ipfsHash
      }))
      .filter(msg => msg.receiver === userAddress);
  } catch (error) {
    console.error('获取消息失败:', error);
    throw error;
  }
};

  // 新增管理员发送接口
  export const adminSendMessage = async (userAddress, ipfsHash) => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS, 
      SMART_LOCK_ABI, 
      signer
    );
    
    // 添加管理员权限检查
    const isAdmin = await checkIfAdmin(await signer.getAddress());
    if (!isAdmin) throw new Error("无管理员权限");
  
    const tx = await contract.adminSendMessage(userAddress, ipfsHash);
    return tx;
  }

  // 增强版消息发送（带重试机制）
export const sendMessageToAdmin = async (adminAddress, ipfsHash, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        SMART_LOCK_CONTRACT_ADDRESS,
        SMART_LOCK_ABI,
        signer
      );

      const today = Math.floor(Date.now() / 86400000);
      const count = await contract.dailyMessageCount(signer.getAddress(), today);
      if (count >= 5) {
        throw new Error("今日发送消息已达上限");
      }

      const tx = await contract.sendMessageToAdmin(adminAddress, ipfsHash);
      const receipt = await tx.wait();
      
      return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        timestamp: Date.now()
      };
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

// ====================== IPFS 功能增强 ====================== //
// 通用IPFS内容获取（带缓存）
const ipfsCache = new Map();
const IPFS_GATEWAYS = [
  'https://cloudflare-ipfs.com',
  'https://ipfs.io',
  'https://gateway.pinata.cloud',
  'https://dweb.link'
];

// 修改后的 fetchIPFSContent 函数
// export const fetchIPFSContent = async (cid, timeout = 5000, retries = 3) => {
//   const IPFS_GATEWAYS = [
//     'https://ipfs.io',
//     'https://dweb.link',
//     'https://gateway.pinata.cloud',
//     'https://cf-ipfs.com'
//   ];

//   for (let attempt = 0; attempt < retries; attempt++) {
//     for (const gateway of IPFS_GATEWAYS) {
//       try {
//         const controller = new AbortController();
//         const timeoutId = setTimeout(() => controller.abort(), timeout);
//         // const content = await originalFetchIPFSContent(cid);
        
//         const response = await axios.get(`${gateway}/ipfs/${cid}`, {
//           signal: controller.signal
//         });
        
//         clearTimeout(timeoutId);
//         return response.data;
//       } catch (error) {
//         console.warn(`尝试 ${attempt + 1}，网关 ${gateway} 失败: ${error.message}`);
//         if (attempt === retries - 1) throw error;
//         await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
//       }
//     }
//   }
//   throw new Error('所有网关尝试失败');
// };
export const fetchIPFSContent = async (cid) => {
  try {
    const gateways = [
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/'
    ];

    for (const gateway of gateways) {
      try {
        const response = await axios.get(`${gateway}${cid}`, {
          timeout: 10000,
          transformResponse: [data => data] // 防止自动JSON解析
        });

        // 内容类型检测
        const contentType = response.headers['content-type'] || '';
        
        // 处理文本内容
        if (contentType.includes('text/plain')) {
          try {
            return JSON.parse(response.data);
          } catch {
            return { content: response.data };
          }
        }
        
        // 处理JSON内容
        if (contentType.includes('application/json')) {
          return JSON.parse(response.data);
        }

        return response.data;
      } catch (error) {
        console.warn(`网关 ${gateway} 失败: ${error.message}`);
      }
    }
    throw new Error('所有IPFS网关请求失败');
  } catch (error) {
    console.error(`IPFS内容获取失败 ${cid}: ${error.message}`);
    return { error: `无法加载内容: ${error.message}` };
  }
};


// ====================== 实时更新功能 ====================== //
// 消息监听器工厂函数
export const createMessageListener = (callback) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(
    SMART_LOCK_CONTRACT_ADDRESS,
    SMART_LOCK_ABI,
    provider
  );

  const listener = async (sender, receiver, timestamp, ipfsHash, event) => {
    try {
      const content = await fetchIPFSContent(ipfsHash);
      callback({
        sender,
        receiver,
        timestamp: Number(timestamp) * 1000,
        ipfsHash,
        content,
        txHash: event.transactionHash
      });
    } catch (error) {
      callback({
        sender,
        receiver,
        timestamp: Number(timestamp) * 1000,
        ipfsHash,
        error: error.message
      });
    }
  };
  contract.on("MessageSent", (sender, receiver, timestamp, ipfsHash, event) => {
    // 新增 receiver 参数处理
    callback({
      sender,
      receiver, // 新增字段
      timestamp: Number(timestamp) * 1000,
      ipfsHash,
      txHash: event.transactionHash
    });
  });
  contract.on("MessageSent", listener);
  
  // 返回关闭监听的方法
  return () => contract.off("MessageSent", listener);
};

// 新增发送消息给用户的方法
export const sendMessageToUser = async (userAddress, ipfsHash) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS, 
      SMART_LOCK_ABI, 
      signer
    );
    
    const tx = await contract.sendMessageToUser(userAddress, ipfsHash);
    await tx.wait();
    return {
      txHash: tx.hash,
      blockNumber: tx.blockNumber,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('发送消息失败:', error);
    throw error;
  }
};

// ====================== 消息相关方法 ====================== 
// 获取管理员接收的消息（封装合约调用）
export const getAdminMessages = async () => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS,
      SMART_LOCK_ABI,
      signer // 改为使用signer而不是provider
    );

    // 检查管理员权限
    const isAdmin = await checkIfAdmin(await signer.getAddress());
    if (!isAdmin) throw new Error("无管理员权限");

    // 调用合约方法
    const rawMessages = await contract.getAdminMessages();
    
    return rawMessages.map(msg => ({
      sender: msg.sender,
      receiver: msg.receiver,
      timestamp: Number(msg.timestamp) * 1000,
      ipfsHash: msg.ipfsHash
    }));
  } catch (error) {
    console.error("获取管理员消息失败:", error);
    throw error;
  }
};

// 发送解决方案（封装合约调用）
export const sendResolutionToUser = async (userAddress, content) => {
  try {
    // 生成IPFS记录
    const resolution = {
      type: "admin_response",
      content: content,
      timestamp: Date.now(),
      displayContent: "您的问题已解决" // 添加易读内容
    };
    
    const ipfsHash = await uploadToIPFS(resolution);

    // 获取合约实例
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS, 
      SMART_LOCK_ABI, 
      signer
    );

    // 调用管理员专用发送方法
    const tx = await contract.adminSendMessage(userAddress, ipfsHash);
    await tx.wait();
    
    return {
      txHash: tx.hash,
      receiver: userAddress,
      ipfsHash: ipfsHash
    };
  } catch (error) {
    console.error('发送解决方案失败:', error);
    throw error;
  }
};

// 获取完整对话记录（封装业务逻辑）
export const getMessageThread = async (userAddress) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(
      SMART_LOCK_CONTRACT_ADDRESS,
      SMART_LOCK_ABI,
      provider
    );

    // 获取用户和管理员之间的双向消息
    const [received, sent] = await Promise.all([
      contract.getMyReceivedMessages(),
      contract.getMySentMessages()
    ]);

    // 过滤出与目标用户的对话
    const filtered = [...received, ...sent]
      .filter(msg => 
        msg.sender === userAddress || 
        msg.receiver === userAddress
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    return filtered.map(msg => ({
      direction: msg.receiver === userAddress ? 'out' : 'in',
      sender: msg.sender,
      timestamp: Number(msg.timestamp) * 1000,
      ipfsHash: msg.ipfsHash
    }));
  } catch (error) {
    console.error('获取对话记录失败:', error);
    throw error;
  }
};

// 持久化存储解决方案
export const persistResolvedMessages = (resolvedList) => {
  try {
    const resolvedMap = resolvedList.reduce((acc, hash) => {
      acc[hash] = true;
      return acc;
    }, {});
    localStorage.setItem('resolvedMessages', JSON.stringify(resolvedMap));
  } catch (error) {
    console.error('持久化解决方案失败:', error);
  }
};

// 初始化时加载
export const loadResolvedMessages = () => {
  try {
    return JSON.parse(localStorage.getItem('resolvedMessages')) || {};
  } catch {
    return {};
  }
};