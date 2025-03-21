// ConnectWalletButton.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { checkMetaMask } from './Metamask';
import { GOVERNANCE_ADDRESS, GOVERNANCE_ABI } from '../contract/Governance';
import { ethers } from 'ethers';

const ConnectWalletButton = ({ onConnect }) => {
  const navigate = useNavigate();
  const [userAddress, setUserAddress] = React.useState('');

  const handleConnect = async () => {
    const address = await checkMetaMask();
    if (!address) return;

    // 更新本地状态
    setUserAddress(address);
    
    // 执行管理员检查
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        GOVERNANCE_ADDRESS,
        GOVERNANCE_ABI,
        provider
      );
      const isAdmin = await contract.isAdmin(address);
      
      if (isAdmin) {
        navigate('/admin');
      } else {
        alert('不是管理员');
      }
    } catch (error) {
      console.error('管理员检查失败:', error);
      alert('权限验证失败');
    }

    // 回调父组件（如果有需要）
    if (onConnect) onConnect(address);
  };

  return (
    <button
      onClick={handleConnect}
      style={{
        position: 'absolute',
        top: '55px',
        right: '20px',
        padding: '10px 20px',
        backgroundColor: '#5a9153',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        fontSize: '16px',
        borderRadius: '5px'
      }}
    >
      {userAddress 
        ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
        : 'Connect MetaMask'}
    </button>
  );
};

export default ConnectWalletButton;