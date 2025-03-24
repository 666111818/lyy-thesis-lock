import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  checkMetaMask,
  checkIfAdmin,
  checkIfVerified,
  getUserIdentityExpiry,
  getLockStatus,
  toggleLockStatus,
  sendMessageToAdmin,
  getLastOperationTimeWithCache,
  toggleUserLockWithIPFS
} from './js/Metamask';
import './App.css';
import AdminPage from './js/AdminPage';
import SmallBox1 from './js/smallbox1';
import SmallBox2 from './js/smallbox2';

function App() {
  const [userAddress, setUserAddress] = useState('');
  const [isLocked, setIsLocked] = useState(null); // 门锁状态
  const [expirationTime, setExpirationTime] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [isSystemUser, setIsSystemUser] = useState(false);
  const navigate = useNavigate();
  const [lastOperationTime, setLastOperationTime] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

 // 连接钱包处理
 const handleConnectMetaMask = async () => {
  const address = await checkMetaMask();
  if (!address) return;

  setUserAddress(address);
  
  
  const isAdmin = await checkIfAdmin(address);
  if (isAdmin) {
    navigate('/admin');
    return;
  }

  // 检查用户验证状态
  const isVerified = await checkIfVerified(address);
  if (isVerified) {
    setIsSystemUser(true);
    await fetchLockStatus();
    // 获取并设置过期时间
    const expiryTimestamp = await getUserIdentityExpiry(address);
    const expiryDate = new Date(expiryTimestamp * 1000);
    setExpirationTime(expiryDate);
  } else {
    alert('你不是该系统用户，请联系管理员');
    setActiveModal('box2');
    setIsSystemUser(false);
  }
};

// 获取锁状态和最后操作时间
const fetchLockStatus = async () => {
  if (!userAddress) return;
  
  try {
    const [locked, lastOp] = await Promise.all([
      getLockStatus(userAddress),
      getLastOperationTimeWithCache(userAddress)
    ]);
    
    setIsLocked(locked);
    setLastOperationTime(lastOp);
  } catch (error) {
    console.error('获取状态失败:', error);
  }
};


  // 切换门锁状态（调用合约的 lock 或 unlock 方法）
  const toggleLock = async () => {
    if (!userAddress || !isSystemUser) {
      alert('请先登录并确保您是系统用户！');
      return;
    }
    
    try {
      setIsProcessing(true);
      const result = await toggleUserLockWithIPFS(userAddress, isLocked);
      
      // 更新本地状态
      setIsLocked(!isLocked);
      setLastOperationTime(Math.floor(Date.now() / 1000));
      
      // 更新缓存
      const cached = JSON.parse(localStorage.getItem('lockOperations') || '{}');
      cached[userAddress] = Math.floor(Date.now() / 1000);
      localStorage.setItem('lockOperations', JSON.stringify(cached));
      
      alert(`操作成功！区块高度：${result.blockNumber}`);
    } catch (error) {
      console.error('操作失败:', error);
      alert(`操作失败: ${error.reason || error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 根据点击不同的小框体打开对应弹窗
  const handleSmallBoxClick = (boxId) => {
    if (!userAddress || !isSystemUser) {
      alert('请先登录并确保您是系统用户！');
      return;
    }
    setActiveModal(boxId);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  // 发送消息给管理员，管理员地址从合约动态获取
  const handleSendMessage = async () => {
    // 请替换为实际生成且符合格式的 IPFS 哈希
    const ipfsHash = "QmdBG43dzTkvR2nLTgU6zrqGvummSzKtegNGwuJLvgrsNg";
    await sendMessageToAdmin(ipfsHash);
  };

  // 粒子效果，仅作示例，不影响业务逻辑
  useEffect(() => {
    const particleContainer = document.querySelector('.particle-container');
    const generateParticle = (x, y) => {
      const particle = document.createElement('div');
      particle.className = 'particle';
      const size = Math.random() * 5 + 5;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${x - size / 2}px`;
      particle.style.top = `${y - size / 2}px`;
      particleContainer.appendChild(particle);
      setTimeout(() => {
        particle.remove();
      }, 3000);
    };
    const handleMouseMove = (event) => {
      generateParticle(event.clientX, event.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="container">
      <div className="big-box">
        <p>
          验证过期时间：
          {expirationTime ? expirationTime.toLocaleString() : '加载中...'}
        </p>
        <p className="big-box-p">当前锁的状态</p>
        <div className="lock-status">
        <div className={`lock-icon ${isLocked ? 'locked' : 'unlocked'}`}>
          {isLocked ? '🔒' : '🔓'}
        </div>
        <h2 className="lock-message">
          {isLocked ? '锁已关闭' : '锁已打开'}
        </h2>
        <button
          className={`circle-button ${isLocked ? 'locked' : 'unlocked'}`}
          onClick={toggleLock}
          disabled={isProcessing}
        >
          {isProcessing ? '处理中...' : (isLocked ? '🔓 开锁' : '🔒 关锁')}
        </button>
      </div>
      </div>

      <div className="small-boxes">
        <div className="small-box small-box-1" onClick={() => handleSmallBoxClick('box1')}>
          <h3>操作门锁记录</h3>
        </div>
        <div className="small-box small-box-2" onClick={() => handleSmallBoxClick('box2')}>
          <h3>联系管理员</h3>
        </div>
      </div>

      {activeModal === 'box1' && <SmallBox1 onClose={handleCloseModal} />}
      {activeModal === 'box2' && <SmallBox2 onClose={handleCloseModal} />}

      <button
        onClick={handleConnectMetaMask}
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
        {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Connect MetaMask'}
      </button>

      <button
        onClick={handleSendMessage}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          padding: '10px 20px',
          backgroundColor: '#007bff',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '16px',
          borderRadius: '5px'
        }}
      >
        联系管理员
      </button>

      <div className="particle-container"></div>
    </div>
  );
}

export default App;
