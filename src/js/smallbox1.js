import React, { useState, useEffect } from 'react';
import '../css/smallbox1.css';
import * as XLSX from 'xlsx';
import { checkMetaMask, getUserOperationsTable,getUserIdentityExpiry,getUserOperations } from './Metamask'; // 引入新的函数

function SmallBox1({ onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [lockOperations, setLockOperations] = useState([]);
  const [currentUser, setCurrentUser] = useState(''); // 存储当前登录用户地址

  // 获取当前登录用户地址和操作记录
useEffect(() => {
  let isMounted = true; // 添加组件挂载状态标识
  const fetchData = async () => {
    try {
      const userAddress = await checkMetaMask();
      if (!userAddress || !isMounted) return;

      // 新增身份过期检查（添加判断避免重复提示）
      const expiry = await getUserIdentityExpiry(userAddress);
      const currentTime = Math.floor(Date.now() / 1000);
      if (expiry < currentTime) {
        if (isMounted) {
          alert('身份验证已过期，请联系管理员重新验证身份');
          onClose();
        }
        return;
      }

      if (isMounted) {
        setCurrentUser(userAddress);
        const operations = await getUserOperations(userAddress);
        setLockOperations(operations);
      }
    } catch (error) {
      if (isMounted) {
        console.error('数据获取失败:', error);
      }
    }
  };

  fetchData();
  return () => {
    isMounted = false; // 组件卸载时更新状态
  };
}, []);

  // 处理搜索框输入
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    
  };

  // 过滤表格数据，忽略大小写
  const filteredData = lockOperations.filter(item =>
    item.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.operation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 导出按钮点击事件
  const handleExport = () => {
    // 创建工作表 
    const ws = XLSX.utils.json_to_sheet(filteredData);

    // 创建工作簿并附加工作表
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "操作记录");

    // 导出 Excel 文件，命名为 "操作记录.xlsx"
    XLSX.writeFile(wb, "操作记录.xlsx");
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>X</button>
        <h2>操作门锁记录</h2>

        <div className="search-container">
          <div className="search-box">
            <input
              type="text"
              placeholder="搜索..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
            />
            <button className="search-button">搜索</button>
          </div>
          <button className="export-button" onClick={handleExport}>导出</button>
        </div>

        {/* 表格 */}

<table className="table">
  <thead>
    <tr>
      <th>用户地址</th>
      <th>操作时间</th>
      <th>操作状态</th>
      <th>IPFS记录</th>
    </tr>
  </thead>
  <tbody>
    {filteredData.length > 0 ? (
      filteredData.map((event, index) => (
        <tr key={index}>
          <td>{event.user}</td>
          <td>{new Date(event.timestamp * 1000).toLocaleString()}</td>
          <td>{event.operation === "Lock" ? "锁定" : "解锁"}</td>
          <td>
            <a 
              href={`https://ipfs.io/ipfs/${event.ipfsHash}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              查看凭证
            </a>
          </td>
        </tr>
      ))
    ) : (
      <tr>
        <td colSpan="4">暂无操作记录</td>
      </tr>
    )}
  </tbody>
</table>
      </div>
    </div> 
  );
}

export default SmallBox1;
