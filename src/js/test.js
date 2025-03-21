import { ethers } from 'ethers';
import { GOVERNANCE_ADDRESS, GOVERNANCE_ABI } from '../contract/Governance.js';

async function checkIfAdminExample() {
  // 判断是否存在 MetaMask
  if (window.ethereum) {
    try {
      // 创建 provider，并请求连接账户
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const userAddress = accounts[0];
      console.log('连接的地址:', userAddress);

      // 获取 signer
      const signer = provider.getSigner();

      // 创建 Governance 合约实例
      const governanceContract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, signer);

      // 调用 isAdmin 方法判断是否为管理员
      const isAdmin = await governanceContract.isAdmin(userAddress);
      if (isAdmin) {
        console.log(`地址 ${userAddress} 是管理员`);
      } else {
        console.log(`地址 ${userAddress} 不是管理员`);
      }
    } catch (error) {
      console.error('调用出错:', error);
    }
  } else {
    alert('请安装 MetaMask！');
  }
}

// 直接调用示例函数
checkIfAdminExample();
