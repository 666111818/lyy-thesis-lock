import React, { useState, useEffect } from 'react';
import '../css/AdminPage.css';

import {getVerifiedUsers,getLockStatus,toggleUserLock,getUserUnlockTime,updateUserIdentity,getUserIdentityExpiry,fetchTransactionDetails} from './Metamask';

function AdminPage() {
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
  

  // 获取用户数据
  const fetchVerifiedUsers = async () => {
    try {
      const users = await getVerifiedUsers();
      const usersWithLockData = await Promise.all(
        users.map(async (user) => {
          const [unlockTime, lockStatus, expiry] = await Promise.all([
            getUserUnlockTime(user),
            getLockStatus(user),
            getUserIdentityExpiry(user) // 获取身份验证过期时间
          ]);
          return { 
            address: user, 
            unlockTime: Number(unlockTime),
            lockStatus,
            expiry: Number(expiry)
          };
        })
      );
      setTableData(usersWithLockData);
    } catch (error) {
      console.log('Error fetching verified users:', error);
    }
  };

  useEffect(() => {
    fetchVerifiedUsers();
  }, []);

  // 获取交易详情的方法
  const recordTransaction = async (txHash, actionType) => {
    const details = await fetchTransactionDetails(txHash);
    if (details) {
      setTransactionHistory(prev => [
        {
          ...details,
          actionType,
          timestamp: details.timestamp
        },
        ...prev
      ]);
    }
  };

  const handleAddUser = async () => {
    try {
      if (!newUserAddress) {
        alert('请输入用户地址');
        return;
      }
      await updateUserIdentity(newUserAddress, true);
      alert('用户添加成功！');
      setNewUserAddress('');
      setShowAddModal(false);
      await fetchVerifiedUsers(); // 刷新数据
    } catch (error) {
      console.error('添加用户失败:', error);
      alert(`操作失败: ${error.reason || error.message}`);
    }
  };
  
  const handleDeleteUser = async () => {
    try {
      if (!deleteUserAddress) {
        alert('请输入用户地址');
        return;
      }
      await updateUserIdentity(deleteUserAddress, false);
      alert('用户删除成功！');
      setDeleteUserAddress('');
      setShowDeleteModal(false);
      await fetchVerifiedUsers(); // 刷新数据
    } catch (error) {
      console.error('删除用户失败:', error);
      alert(`操作失败: ${error.reason || error.message}`);
    }
  };


  const handleToggleLock = async (address, currentStatus) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const result = await toggleUserLock(address, !currentStatus);
  await recordTransaction(result.hash, currentStatus ? '解锁' : '锁定');
     
      
      // 获取最新解锁时间
      const newExpiry = await getUserUnlockTime(address);
      
      const updatedData = tableData.map(user => 
        user.address === address ? { 
          ...user, 
          lockStatus: !currentStatus,
          expiry: Number(newExpiry)
        } : user
      );
      
      setTableData(updatedData);
      alert('锁状态已更新！');
    } catch (error) {
      console.error('切换锁状态失败:', error);
      alert(`操作失败: ${error.reason || error.message}`);
    }
    setIsProcessing(false);
  };

  const handleVerifyIdentity = async (address) => {
    try {
      await updateUserIdentity(address, true);
      
      // 获取最新身份验证过期时间
      const newExpiry = await getUserIdentityExpiry(address);
      
      const updatedData = tableData.map(user => {
        if (user.address === address) {
          return {
            ...user,
            expiry: Number(newExpiry),
            lockStatus: false
          };
        }
        return user;
      });
      
      setTableData(updatedData);
      alert('用户验证已更新！');
    } catch (error) {
      console.error('验证失败:', error);
      alert(`操作失败: ${error.reason || error.message}`);
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

  return (
    <div className="admin-container">
      <h1>管理员页面</h1>
      <div className="block-info-button" onClick={() => setShowBlockModal(true)}>
        区块详情
      </div>
      

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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button className="export-button" onClick={handleExportTable}>
                导出表格
              </button>
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
          <td>
                      {user.expiry > 0 ? 
                        new Date(user.expiry * 1000).toLocaleString() : 
                        '暂无记录'}
                    </td>
          <td>
            <button 
              className={`lock-btn ${user.lockStatus ? 'locked' : 'unlocked'}`}
              onClick={() => handleToggleLock(user.address, user.lockStatus)}
              disabled={isProcessing}
            >
              {user.lockStatus ? '解锁' : '关锁'}
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
                >
                  验证
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