import React, { useState, useEffect } from 'react';
import '../css/smallbox2.css';
import { 
  checkMetaMask, 
  getAdmins, 
  sendMessageToAdmin, 
  uploadToIPFS,
  getReceivedMessages,
  fetchIPFSContent
} from './Metamask';

function SmallBox2({ onClose }) {
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [messageType, setMessageType] = useState('verify');
  const [customContent, setCustomContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

   // 获取消息
   const loadMessages = async () => {
    try {
      setLoadingMessages(true);
      const userAddress = await checkMetaMask();
      const rawMessages = await getReceivedMessages(userAddress);
      
      const detailedMessages = await Promise.all(
        rawMessages.map(async msg => {
          try {
            const content = await fetchIPFSContent(msg.ipfsHash);
            return {
              ...msg,
              content,
              time: new Date(msg.timestamp).toLocaleString(),
              shortAddress: `${msg.sender.slice(0,6)}...${msg.sender.slice(-4)}`
            };
          } catch (error) {
            return { ...msg, content: "内容加载失败", time: "未知时间" };
          }
        })
      );
      
      setMessages(detailedMessages);
    } catch (error) {
      console.error('加载消息失败:', error);
      alert('无法加载消息，请检查控制台');
    } finally {
      setLoadingMessages(false);
    }
  };

  // 获取管理员列表
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const list = await getAdmins();
        if (list.length === 0) {
          console.warn("Admin list is empty");
        }
        setAdmins(list);
        setSelectedAdmin(list[0] || '');
      } catch (error) {
        console.error('获取管理员失败:', error);
        alert('获取管理员列表失败，请检查控制台');
      }
    };
    fetchAdmins();
  }, []);

  // 生成IPFS内容模板
  const generateMessageContent = async () => {
    const userAddress = await checkMetaMask();
    const templates = {
      verify: `请求重新验证地址 ${userAddress} 的身份`,
      addUser: `申请将地址 ${userAddress} 加入系统，成为该系统用户`,
      removeUser: `申请将地址 ${userAddress} 在系统内删除`,
      addContact: '申请添加管理员联系方式',
      other: customContent
    };
    return {
      type: messageType,
      content: templates[messageType],
      timestamp: new Date().toISOString()
    };
  };

  // 发送消息
// 发送消息时调用
const handleSend = async () => {
  if (!selectedAdmin) {
    alert('请选择管理员');
    return;
  }

  try {
    setIsSending(true);
    const content = await generateMessageContent();
    const ipfsHash = await uploadToIPFS(content);
    
    // 传入选中的管理员地址
    await sendMessageToAdmin(selectedAdmin, ipfsHash);
    
    alert('消息发送成功！');
    onClose();
  } catch (error) {
    console.error('发送失败:', error);
    alert(`发送失败: ${error.reason || error.message}`);
  } finally {
    setIsSending(false);
  }
};

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>X</button>
        <h2>联系管理员</h2>
        {/* 顶部切换按钮 */}
        <div className="mode-switcher">
          <button 
            className={`switch-btn ${!showInbox ? 'active' : ''}`}
            onClick={() => setShowInbox(false)}
          >
            发送消息
          </button>
          <button 
            className={`switch-btn ${showInbox ? 'active' : ''}`}
            onClick={() => {
              setShowInbox(true);
              loadMessages();
            }}
          >
            查看消息 ({messages.length})
          </button>
        </div>

            {/* 消息列表 */}
        {showInbox ? (
          <div className="message-inbox">
            {loadingMessages ? (
              <div className="loading-msg">加载中...</div>
            ) : messages.length === 0 ? (
              <div className="empty-msg">暂无消息</div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className="message-card">
                  <div className="message-header">
                    <span className="admin-badge">管理员</span>
                    <span className="message-time">{msg.time}</span>
                    <span className="message-address">{msg.shortAddress}</span>
                  </div>
                  <pre className="message-content">{JSON.stringify(msg.content, null, 2)}</pre>
                </div>
              ))
            )}
          </div>
        ) : (
          /* 原有发送表单 */
          <div className="message-form">
          {/* 管理员选择 */}
          <div className="form-group">
            <label>选择管理员：</label>
            <select 
              value={selectedAdmin} 
              onChange={(e) => setSelectedAdmin(e.target.value)}
              className="admin-select"
            >
              {admins.map(admin => (
                <option key={admin} value={admin}>
                  {`${admin.slice(0, 6)}...${admin.slice(-4)}`}
                </option>
              ))}
            </select>
          </div>

          {/* 消息类型选择 */}
          <div className="form-group">
            <label>请求类型：</label>
            <div className="type-grid">
              {[
                { value: 'verify', label: '验证身份' },
                { value: 'addUser', label: '添加用户' },
                { value: 'removeUser', label: '删除用户' },
                { value: 'addContact', label: '添加联系方式' },
                { value: 'other', label: '其他请求' }
              ].map((type) => (
                <label key={type.value} className="type-option">
                  <input
                    type="radio"
                    name="messageType"
                    value={type.value}
                    checked={messageType === type.value}
                    onChange={() => setMessageType(type.value)}
                  />
                  <span className="radio-custom"></span>
                  {type.label}
                </label>
              ))}
            </div>
          </div>

          {/* 自定义内容输入 */}
          {messageType === 'other' && (
            <div className="form-group">
              <label>详细描述：</label>
              <textarea
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                className="custom-input"
                placeholder="请输入您的请求内容..."
              />
            </div>
          )}

          <button 
            onClick={handleSend}
            disabled={isSending}
            className="send-button"
          >
            {isSending ? '发送中...' : '发送请求'}
          </button>
        </div>
          
        )}
      </div>
    </div>
  );
}

export default SmallBox2;