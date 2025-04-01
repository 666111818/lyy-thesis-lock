import React, { useState, useEffect } from 'react';
import '../css/AdminPage.css';
import { ethers } from 'ethers';

import AdminProposalPage from './AdminProposalPage';
import AdminVote from'./AdminVote'
import AdminProposalLog from './AdminProposalLog';


import {getVerifiedUsers,
  getLockStatus,
  toggleUserLock,
  getUserUnlockTime,
  updateUserIdentity,
  getUserIdentityExpiry,checkMetaMask,updateUserExpiry,verifyuploadToIPFS,
  getLastLockOperationTime,getAdminMessages,fetchIPFSContent,sendResolutionToUser,checkIfAdmin, persistResolvedMessages,loadResolvedMessages } from './Metamask';

function AdminPage() {
  // 新增钱包地址状态
  const [userAddress, setUserAddress] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableData, setTableData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newUserAddress, setNewUserAddress] = useState('');
  const [deleteUserAddress, setDeleteUserAddress] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showProposalLogModal, setshowProposalLogModal] = useState(false);
  const [processingStates, setProcessingStates] = useState({});
const [showMessageModal, setShowMessageModal] = useState(false);
const [messages, setMessages] = useState([]);
const [selectedMessage, setSelectedMessage] = useState(null);
const [replyContent, setReplyContent] = useState('已解决');
const [isLoadingMessages, setIsLoadingMessages] = useState(false);
const [selectedFilter, setSelectedFilter] = useState('unresolved');
const [resolvedMessages, setResolvedMessages] = useState(() => loadResolvedMessages());


  

  //  新增：连接钱包处理
  const handleConnectMetaMask = async () => {
    const address = await checkMetaMask();
    if (address) {
      setUserAddress(address);
    }
  };

  // 新增：组件加载时自动获取地址
  useEffect(() => {
    const init = async () => {
      const address = await checkMetaMask();
      if (address) {
        setUserAddress(address);
      }
    };
    init();
  }, []);

  // 获取用户数据
const fetchVerifiedUsers = async () => {
  try {
    const users = await getVerifiedUsers();
    
    const usersWithLockData = await Promise.all(
      users.map(async (user) => {
        const [lockStatus, expiry, lastOperation] = await Promise.all([
          getLockStatus(user),
          getUserIdentityExpiry(user),
          getLastLockOperationTime(user)
        ]);
        
        return { 
          address: user, 
          lockStatus,
          expiry: Number(expiry),
          // 添加时间戳转换
          lastLockOperation: lastOperation ? Number(lastOperation) : 0
        };
      })
    );
    
    // 添加本地缓存
    localStorage.setItem('lastOperations', JSON.stringify(
      usersWithLockData.reduce((acc, user) => {
        acc[user.address] = user.lastLockOperation;
        return acc;
      }, {})
    ));
    
    setTableData(usersWithLockData);
  } catch (error) {
    console.log('Error:', error);
    // 从本地缓存加载
    const cached = JSON.parse(localStorage.getItem('lastOperations') || '{}');
    setTableData(prev => prev.map(u => ({
      ...u,
      lastLockOperation: cached[u.address] || u.lastLockOperation
    })));
  }
};

  useEffect(() => {
    fetchVerifiedUsers();
  }, []);

 // 增强的交易记录方法
const recordTransaction = async (txHash, actionType) => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const txReceipt = await provider.getTransaction(txHash);
    const block = await provider.getBlock(txReceipt.blockNumber);
    
    const newRecord = {
      actionType,
      blockNumber: txReceipt.blockNumber,
      timestamp: block.timestamp,
      txHash
    };

    setTransactionHistory(prev => [newRecord, ...prev.slice(0, 49)]); // 保留最近50条记录
  } catch (error) {
    console.error('记录交易失败:', error);
  }
};

  const handleAddUser = async () => {
    try {
      if (!newUserAddress || !ethers.isAddress(newUserAddress)) {
        alert('请输入有效的用户地址');
        return;
      }
      
      await updateUserIdentity(newUserAddress, true);
      alert('用户添加成功！');
      setNewUserAddress('');
      setShowAddModal(false);
      await fetchVerifiedUsers();
    } catch (error) {
      console.error('添加用户失败:', error);
      alert(`操作失败: ${error.reason || error.message}`);
    }
  };

// 在 useEffect 中添加自动缓存逻辑
useEffect(() => {
  if (tableData.length > 0) {
    localStorage.setItem('cachedUsers', JSON.stringify(tableData));
  }
}, [tableData]); // 当 tableData 变化时自动保存
  
  const handleDeleteUser = async () => {
    try {
      if (!deleteUserAddress || !ethers.isAddress(deleteUserAddress)) {
        alert('请输入有效的用户地址');
        return;
      }
      
      await updateUserIdentity(deleteUserAddress, false);
      alert('用户删除成功！');
      setDeleteUserAddress('');
      setShowDeleteModal(false);
      await fetchVerifiedUsers();
    } catch (error) {
      console.error('删除用户失败:', error);
      alert(`操作失败: ${error.reason || error.message}`);
    }
  };
  
// 修改后的 handleVerifyIdentity 函数（在 AdminPage.js 中）
const handleVerifyIdentity = async (address) => {
  try {
    // 生成验证操作描述
    const verifyText = `验证用户 ${address} 身份，有效期至 ${new Date(Date.now() + 300000).toLocaleString()}`;
    
    // 上传到IPFS
    const ipfsHash = await verifyuploadToIPFS({
      action: "identity_verification",
      user: address,
      description: verifyText,
      timestamp: Date.now()
    });

    // 计算过期时间（当前时间 + 5分钟）
    const newExpiry = Math.floor(Date.now() / 1000) + 300;

    // 调用合约
    await updateUserExpiry(address, newExpiry, ipfsHash);

    // 更新本地数据
    const updatedData = tableData.map(user => 
      user.address === address ? { 
        ...user, 
        expiry: newExpiry,
        lockStatus: false
      } : user
    );
    
    setTableData(updatedData);
    alert('用户验证已更新！');
  } catch (error) {
    console.error('验证失败:', error);
    alert(`操作失败: ${error.reason || error.message}`);
  }
};


// 锁状态切换处理
const handleToggleLock = async (address, currentStatus) => {
  try {
    // 获取当前时间戳（秒）
    const now = Math.floor(Date.now() / 1000);  
    // 获取身份验证过期时间
    const identityExpiry = await getUserIdentityExpiry(address);
     // 调试信息
     console.log('当前时间:', now, '过期时间:', identityExpiry);
 
     if (identityExpiry < now) {
      alert(`身份验证已过期！过期时间：${new Date(identityExpiry * 1000).toLocaleString()}`);
      return;
    } 

    // 设置单个按钮的加载状态
    setProcessingStates(prev => ({
      ...prev, 
      [address]: true 
    }));
    
    // 调用合约操作
    const result = await toggleUserLock(address, currentStatus);
    
    // 记录交易详情
    await recordTransaction(result.hash, currentStatus ? '解锁' : '锁定');
    
    // 更新本地数据
    const newExpiry = await getUserUnlockTime(address);
    setTableData(prev => prev.map(user => 
      user.address === address ? {
        ...user,
        lockStatus: !currentStatus,
        lastLockOperation: Math.floor(Date.now() / 1000)
      } : user
    ));
    
    alert(`已成功${currentStatus ? '解锁' : '锁定'}！`);
    const cached = JSON.parse(localStorage.getItem('lockOperations') || '{}');
    cached[address] = Math.floor(Date.now() / 1000);
    localStorage.setItem('lockOperations', JSON.stringify(cached));
  } catch (error) {
    console.error('操作失败:', error);
    alert(`操作失败: ${error.reason || error.message}`);
  } finally {
    // 清除加载状态
    setProcessingStates(prev => ({
      ...prev, 
      [address]: false }));
  }
};



  // 弹窗关闭处理
  const handleCloseModal = (setter) => () => setter(false);

  // 表格过滤
  const filteredData = tableData.filter(item => 
    Object.values(item).some(value =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // CSV导出
  const handleExportTable = () => {
    const csvContent = [
      ['用户地址', '过期时间', '状态'],
      ...tableData.map(user => [
        user.address,
        user.expiry ? new Date(user.expiry * 1000).toLocaleString() : '未设置',
        user.lockStatus ? '已锁定' : '已解锁'
      ])
    ].join('\n');

    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURI(csvContent)}`;
    link.download = 'user_table.csv';
    link.click();
  };

  // 获取消息

// 获取消息
// 修改后的fetchMessages函数
const fetchMessages = async () => {
  try {
    setIsLoadingMessages(true);
    const isAdmin = await checkIfAdmin(userAddress);
    if (!isAdmin) return;

    const rawMessages = await getAdminMessages();
    const currentResolved = loadResolvedMessages();

    const messagesWithContent = await Promise.all(
      rawMessages.map(async (msg) => {
        try {
          // 添加短地址显示
          const shortSender = `${msg.sender.slice(0,6)}...${msg.sender.slice(-4)}`;
          
          // 增强IPFS内容获取
          const content = await fetchIPFSContent(msg.ipfsHash);
          
          // 改进内容解析
          const parsedContent = (() => {
            try {
              const data = typeof content === 'string' ? JSON.parse(content) : content;
              
              // 支持多级嵌套解析
              const getNestedContent = (obj) => {
                if (obj.operation) return getNestedContent(obj.operation);
                if (obj.content) return getNestedContent(obj.content);
                return obj;
              };

              const finalContent = getNestedContent(data);
              
              return {
                type: finalContent.type || '系统消息',
                content: finalContent.content || finalContent,
                timestamp: finalContent.timestamp || msg.timestamp
              };
            } catch(e) {
              return { 
                type: '数据异常',
                content: JSON.stringify(content),
                timestamp: Date.now()
              };
            }
          })();

          return {
            ...msg,
            shortSender,
            status: currentResolved[msg.ipfsHash] ? 'resolved' : 'unresolved',
            ...parsedContent,
            formattedTime: new Date(parsedContent.timestamp).toLocaleString()
          };
        } catch (error) {
          console.error('消息加载失败:', error);
          return {
            ...msg,
            shortSender: '未知用户',
            type: '数据异常',
            content: `无法加载内容: ${error.message}`,
            status: 'unresolved'
          };
        }
      })
    );

    setMessages(messagesWithContent);
  } catch (error) {
    console.error('消息加载失败:', error);
    alert(`加载失败: ${error.message}`);
  } finally {
    setIsLoadingMessages(false);
  }
};

const filteredMessages = messages.filter(msg => {
  if (selectedFilter === 'all') return true;
  if (selectedFilter === 'resolved') return resolvedMessages[msg.ipfsHash];
  return !resolvedMessages[msg.ipfsHash];
});

// 发送解决方案
const handleSendResolution = async (originalMsg) => {
  try {
    setIsProcessing(true);
    
    // 生成解决确认消息
    const resolutionContent = {
      type: "issue_resolved",
      message: "您的问题已解决",
      originalRequest: originalMsg.content,
      resolvedAt: Date.now(),
      resolver: userAddress
    };

    // 发送解决确认消息
    const result = await sendResolutionToUser(
      originalMsg.sender, // 发送给原请求用户
      resolutionContent
    );

    const newResolved = { ...resolvedMessages, [originalMsg.ipfsHash]: true };
    persistResolvedMessages(newResolved);
    setResolvedMessages(newResolved); // 确保状态更新

    setMessages(prev => 
      prev.map(msg => 
        msg.ipfsHash === originalMsg.ipfsHash 
          ? { ...msg, status: 'resolved' }
          : msg
      )
    );

    alert(`已发送解决确认！交易哈希：${result.txHash}`);
  } catch (error) {
    alert(`操作失败: ${error.message}`);
  } finally {
    setIsProcessing(false);
  }
};

useEffect(() => {
  const loadCache = async () => {
    // 用户数据
    const cachedUsers = JSON.parse(localStorage.getItem('cachedUsers'));
    if (cachedUsers) setTableData(cachedUsers);
    
    // 消息状态
    const resolved = loadResolvedMessages();
    // 可以在此处合并链上数据...
  };
  loadCache();
}, []);
useEffect(() => {
  const checkAdminStatus = async () => {
    if (userAddress) {
      const isAdmin = await checkIfAdmin(userAddress);
      if (!isAdmin) {
        alert('当前账户不是管理员');
        setShowMessageModal(false);
      }
    }
  };
  checkAdminStatus();
}, [showMessageModal]);


useEffect(() => {
  if (showMessageModal && userAddress) {
    fetchMessages();
  }
}, [showMessageModal]);
  return (
    <div className="admin-container">
      <button
        onClick={handleConnectMetaMask}
        style={{
          position: 'absolute',
          top: '20px',
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
      <h1>管理员页面</h1>
      <div className="block-info-button" onClick={() => setShowBlockModal(true)}>
        区块详情
      </div>
      <div className="block-info-button-1" onClick={() => setShowProposalModal(true)}>
        发起提案
      </div>
      <div className="block-info-button-2" onClick={() => setshowProposalLogModal(true)}>
        提案记录
      </div>
      <div className="block-info-button-3" onClick={() => setShowVoteModal(true)}>
  投票
</div>    

<div className="block-info-button-4" onClick={() => setShowMessageModal(true)}>
  消息中心
</div>

          {/* 消息中心模态框 */}
{/* 消息中心模态框 */}
{showMessageModal && (
  <div className="modal-overlay">
    <div className="modal-content message-modal">
      <h2>📨 用户消息中心</h2>
      <div className="message-filter">
        <button
          className={`filter-btn ${selectedFilter === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('all')}
          
        >
          全部消息
        </button>
        <button
          className={`filter-btn ${selectedFilter === 'resolved' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('resolved')}
        >
          已解决
        </button>
        <button
          className={`filter-btn ${selectedFilter === 'unresolved' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('unresolved')}
        >
          未解决
        </button>
      </div>
      
      {isLoadingMessages ? (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )  : (
        <>

                <div className="message-list">
                  {filteredMessages.length === 0 ? (
                    <div className="empty-message">
                      <div className="empty-icon">📭</div>
                      <p className="empty-text">当前没有相关消息</p>
                    </div>
                  ) : (
                    filteredMessages.map((msg, index) => (
                      <div 
                        key={index}
                        className={`message-item ${msg.status === 'resolved' ? 'resolved' : ''} ${selectedMessage?.ipfsHash === msg.ipfsHash ? 'selected' : ''}`}
                        onClick={() => setSelectedMessage(msg)}
                      >
                        <div className="message-header">
                          <span className="user-address">
                            👤 {msg.shortSender}
                            {msg.status === 'resolved' && (
                              <span className="status-badge resolved">✅ 已解决</span>
                            )}
                          </span>
                          <span className="message-time">
                            🕒 {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="message-preview">
  {(() => {
    const content = msg.content;
    if (typeof content === 'object') {
      const displayContent = content.content || content.operation;
      // 检查是否为对象，如果是则转换为JSON字符串
      if (typeof displayContent === 'object') {
        return JSON.stringify(displayContent, null, 2);
      }
      return displayContent || '系统消息';
    }
    return content || '点击查看详情...';
  })()}
</div>
                      </div>
                    ))
                  )}
                </div>
          
          {/* // 修改消息详情渲染部分 */}
          {selectedMessage && (
  <div className="message-detail">
    <h3>📄 消息详情
    <button 
        onClick={() => setSelectedMessage(null)}
        className="close-detail-btn"
        style={{background: '#224320'}}
      >
        ✖
      </button>
    </h3>
    <div className="detail-content">
      <div className="message-meta">
        <p>发送者: {selectedMessage.sender}</p>
        <p>时间: {new Date(selectedMessage.timestamp).toLocaleString()}</p>
      </div>
  {/* 修改消息详情渲染部分 */}
  <div className="message-content">
  {selectedMessage.content ? (
    (() => {
      try {
        let content;
        if (typeof selectedMessage.content === 'string') {
          content = JSON.parse(selectedMessage.content);
        } else {
          content = selectedMessage.content;
        }

        // 递归处理嵌套对象
        const safeStringify = (obj) => {
          return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              return safeStringify(value); // 递归处理嵌套对象
            }
            return value;
          }, 2);
        };

        if (typeof content === 'object') {
          return <pre>{safeStringify(content)}</pre>;
        }
        return content.toString();
      } catch (e) {
        // 解析失败时显示原始内容
        return typeof selectedMessage.content === 'string' 
          ? selectedMessage.content 
          : JSON.stringify(selectedMessage.content);
      }
    })()
  ) : '无内容'}
</div>
    </div>
    <div className="message-actions">
      <button 
        className="resolve-button"
        onClick={() => handleSendResolution(selectedMessage)}
        disabled={isProcessing}
      >
        {isProcessing ? '发送中...' : '✅ 标记为已解决'}
      </button>
    </div>
  </div>
)}
        </>
      )}

      <button 
        onClick={() => setShowMessageModal(false)}
        className="close-modal-button"
      >
        ✖ 关闭
      </button>
    </div>
  </div>
)}
      

      {/* 区块详情模态框 */}
      {showBlockModal && (
        <div className="modal-overlay">
          <div className="modal-content block-modal">
            <h2>区块链操作记录</h2>
            <table className="block-table">
              <thead>
                <tr>
                  <th>操作类型</th>
                  <th>区块高度</th>
                  <th>时间戳</th>
                  <th>交易哈希</th>
                </tr>
              </thead>
              <tbody>
                {transactionHistory.map((tx, index) => (
                  <tr key={index}>
                    <td>{tx.actionType}</td>
                    <td>{tx.blockNumber}</td>
                    <td>{tx.timestamp}</td>
                    <td className="tx-hash">{tx.txHash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button 
              onClick={() => setShowBlockModal(false)}
              className="close-modal-button"
            >
              关闭
            </button>
          </div>
        </div>
      )}

       {/* 发起提案模态框 */}
{showProposalModal && (
  <div className="modal-overlay">
    <div className="modal-content">
      <AdminProposalPage onClose={() => setShowProposalModal(false)} />
      
    </div>
  </div>
)}

{/* 提案记录模态框 */}
{showProposalLogModal && (
  <div className="modal-overlay">
    <div className="modal-content">
      <AdminProposalLog onClose={() => setshowProposalLogModal(false)} />
     
    </div>
  </div>
)}

{/* 投票模态框 */}
{showVoteModal && (
  <div className="modal-overlay">
    <div className="modal-content">
      <AdminVote onClose={() => setShowVoteModal(false)} />
     
    </div>
  </div>
)}

      <div className="admin-boxes">
        <div className="admin-box">
          <h2>用户信息</h2>
          <button onClick={() => setShowUserModal(true)}>查看用户信息</button>
        </div>

        <div className="admin-box">
          <h2>操作</h2>
          <p>开关锁/添加新用户</p>
          <button onClick={() => setShowOtherModal(true)}>进入页面</button>
        </div>
      </div>

      {/* 用户信息弹窗 */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>用户管理</h2>
            <div className="search-export">
  <input
    type="text"
    placeholder="搜索用户地址或状态..."
    style={{ borderRadius: '30px' }}
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="search-input"
  />
  <div className="stats-container">
    <span className="total-count">共102条</span>
    <button className="export-button" onClick={handleExportTable}>
      导出表格
    </button>
  </div>
</div>


            <table className="user-table">
    <thead>
      <tr>
        <th>用户地址</th>
        <th>最后操作时间</th>
        <th>锁状态</th>
      </tr>
    </thead>
    <tbody>
      {filteredData.map((user, index) => (
        <tr key={index}>
          <td>{user.address}</td>
          {/* <td>
            {user.lastLockOperation > 0 ? 
              new Date(user.lastLockOperation * 1000).toLocaleString() : 
              '暂无记录'}
          </td> */}
          <td>
  {user.lastLockOperation > 0 ? 
    new Date(
      // 优先使用实时数据，其次用缓存数据
      (user.lastLockOperation || (JSON.parse(localStorage.getItem('lastOperations') || '{}')[user.address] || 0)) * 1000
    ).toLocaleString() 
    : '暂无记录'
  }
</td>

                    <td>
    <button   
      className={`lock-btn ${user.lockStatus ? 'locked' : 'unlocked'}`}
      onClick={() => handleToggleLock(user.address, user.lockStatus)}
      disabled={processingStates[user.address] || user.expiry < Date.now()/1000}
    >
      {processingStates[user.address] ? (
        <span className="loading-dots">处理中</span>
      ) : user.lockStatus ? (
        '解锁'
      ) : (
        '关锁'
      )}
    </button>
  </td>
        </tr>
      ))}
    </tbody>
  </table>
            <button 
              onClick={handleCloseModal(setShowUserModal)}
              className="close-modal-button"
            >
              关闭
            </button>
          </div>
        </div>
      )}

{showOtherModal && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h2>用户操作</h2>
      <div className="action-buttons">
  <button className="operation-button" onClick={() => setShowAddModal(true)}>
    添加新用户
  </button>
  <button className="operation-button delete" onClick={() => setShowDeleteModal(true)}>
    删除用户
  </button>
  <div className="stats-container">
    <span className="total-count">共 {tableData.length} 条</span>
  </div>
</div>

      <table className="user-table">
        <thead>
          <tr>
            <th>用户地址</th>
            <th>身份过期时间</th>
            <th>验证身份</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((user, index) => (
      <tr key={index}>
        <td>{user.address}</td>
        <td>
          {user.expiry > 0 ? 
            new Date(user.expiry * 1000).toLocaleString() : 
            '未验证'}
        </td>
        <td>
          <button 
            className="verify-button"
            onClick={() => handleVerifyIdentity(user.address)}
            disabled={isProcessing}
          >
            {user.expiry > Date.now()/1000 ? '续期验证' : '立即验证'}
          </button>
        </td>
      </tr> 
    ))}
  </tbody>
</table>

      <button
        onClick={handleCloseModal(setShowOtherModal)}
        className="close-modal-button"
      >
        关闭
      </button>
    </div>
  </div>
)}
{showAddModal && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h2>添加用户</h2>
      <div className="modal-input-group">
        <input
          type="text"
          placeholder="输入用户地址"
          value={newUserAddress}
          onChange={(e) => setNewUserAddress(e.target.value)}
          className="modal-input"
        />
      </div>
      <div className="modal-action-buttons">
        <button className="confirm-button" onClick={handleAddUser}>
          确认添加
        </button>
        <button className="cancel-button" onClick={() => setShowAddModal(false)}>
          取消
        </button>
      </div>
    </div>
  </div>
)}

{/* 删除用户弹窗 */}
{showDeleteModal && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h2>删除用户</h2>
      <div className="modal-input-group">
        <input
          type="text"
          placeholder="输入用户地址"
          value={deleteUserAddress}
          onChange={(e) => setDeleteUserAddress(e.target.value)}
          className="modal-input"
        />
      </div>
      <div className="modal-action-buttons">
        <button className="confirm-button delete" onClick={handleDeleteUser}>
          确认删除
        </button>
        <button className="cancel-button" onClick={() => setShowDeleteModal(false)}>
          取消
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default AdminPage;