import React, { useState, useEffect } from 'react';
import '../css/smallbox1.css';
import * as XLSX from 'xlsx';
import { checkMetaMask, getUserOperationsTable } from './Metamask'; // 引入新的函数

function SmallBox1({ onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [lockOperations, setLockOperations] = useState([]);
  const [currentUser, setCurrentUser] = useState(''); // 存储当前登录用户地址

  // 获取当前登录用户地址和操作记录
  useEffect(() => {
    const fetchData = async () => {
      const userAddress = await checkMetaMask(); // 获取 MetaMask 当前用户地址
      if (userAddress) {
        setCurrentUser(userAddress);
        const operations = await getUserOperationsTable(userAddress); // 获取用户操作记录
        setLockOperations(operations); // 将获取的操作记录设置到 state 中
      }
    };

    fetchData();
  }, []); // 组件首次加载时执行一次

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
              <th>User Address</th>
              <th>Timestamp</th>
              <th>Operation</th>
            </tr>
          </thead>
          <tbody id="operations-table-body">
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (
                <tr key={index}>
                  <td>{item.user}</td>
                  <td>{new Date(item.timestamp * 1000).toLocaleString()}</td> {/* 格式化时间戳 */}
                  <td>{item.operation}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3">没有匹配的数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div> 
  );
}

export default SmallBox1;
