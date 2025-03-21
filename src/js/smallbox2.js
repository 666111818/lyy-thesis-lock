import React, { useState } from 'react';
import '../css/smallbox2.css'; 


function SmallBox2({ onClose }) {
    const [searchTerm, setSearchTerm] = useState('');

    // 模拟表格数据
    const data = [
        { Admin: '小小', contact: '245', sex: '女' },
      { Admin: '数据', contact: '423346544554', sex: '男' },
      { Admin: '小猫', contact: '4234554', sex: '女' }
    ];
  
    // 处理搜索框输入
    const handleSearchChange = (event) => {
      setSearchTerm(event.target.value);
    };
  
    // 过滤表格数据
    const filteredData = data.filter(item =>      
        item.Admin.includes(searchTerm) || item.contact.includes(searchTerm) || item.sex.includes(searchTerm)
      );
      

  
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <button className="close-btn" onClick={onClose}>X</button>
          <h2>联系管理员</h2>
  
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
    
  </div>
  
  
          {/* 表格 */}
          <table className="table">
            <thead>
              <tr>
                <th>管理员</th>
                <th>联系方式</th>
                <th>性别</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <tr key={index}>
                    <td>{item.Admin}</td>
                    <td>{item.contact}</td>
                    <td>{item.sex}</td>
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

export default SmallBox2;
