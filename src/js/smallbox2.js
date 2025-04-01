import React, { useState, useEffect } from 'react';
import '../css/smallbox2.css';
import { 
  checkMetaMask, 
  getAdmins, 
  sendMessageToAdmin, 
  uploadToIPFS,
  getReceivedMessages,
  fetchIPFSContent,
  checkIfAdmin
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
      const userAddress = (await checkMetaMask()).toLowerCase();
      
      let rawMessages;
      try {
        rawMessages = await getReceivedMessages();
      } catch (error) {
        console.error('合约调用失败:', error);
        alert('无法连接区块链网络，请检查MetaMask');
        return;
      }
  
      if (!Array.isArray(rawMessages)) {
        console.error('无效的消息数据:', rawMessages);
        return;
      }
  
      const filteredMessages = rawMessages
        .filter(msg => 
          msg.receiver?.toLowerCase() === userAddress
        )
        .map(msg => ({
          ...msg,
          sender: msg.sender?.toLowerCase() || '未知发送者',
          timestamp: msg.timestamp ? Number(msg.timestamp.toString()) : 0
        }));
  
     // 在 loadMessages 函数中找到 filteredMessages.map 部分，修改为：
const detailedMessages = await Promise.all(
  filteredMessages.map(async msg => {
    const shortSender = `${msg.sender.slice(0,6)}...${msg.sender.slice(-4)}`;
    
    try {
      const response = await fetchIPFSContent(msg.ipfsHash);
      console.log('IPFS响应:', response);

      // 增强内容解析（支持多级嵌套）
      const parseContent = (content) => {
        try {
          if (typeof content === 'string' && content.startsWith('{')) {
            return parseContent(JSON.parse(content));
          }
      
          if (typeof content === 'object') {
            const operationData = content.operation || content;
      
            if (operationData.type === 'admin_response') {
              return {
                type: '管理员回复',
                content: [
                  `📨 ${operationData.displayContent || '系统通知'}`,
                  `⏱️ ${new Date(operationData.timestamp).toLocaleString()}`,
                  `👮 处理人：${operationData.content.resolver?.slice(0,8)}...`,
                  `📝 处理结果：${operationData.content.message}`,
                  ...(operationData.content.originalRequest ? 
                    [`📩 原始请求：${parseContent(operationData.content.originalRequest).content}`] : [])
                ].join('\n')
              };
            }
      
            return {
              type: operationData.type === 'verify' ? '身份验证' : 
                   operationData.type === 'addUser' ? '添加用户' :
                   operationData.type === 'removeUser' ? '删除用户' : '其他',
              content: [
                `📌 ${operationData.content}`,
                `⏰ 提交时间：${new Date(operationData.timestamp).toLocaleString()}`
              ].join('\n')
            };
          }
          return { content: String(content) };
        } catch(e) {
          console.error('内容解析错误:', e);
          return { content: '内容格式异常' };
        }
      };

      const parsed = parseContent(response);
      
      return {
        ...msg,
        timestamp: msg.timestamp ? Number(msg.timestamp.toString()) : 0,
        // 添加排序用时间戳（优先使用响应时间）
        sortTime: parsed?.content?.resolvedAt || msg.timestamp * 1000,
        content: parsed.content,
        type: parsed.type || '系统消息'
      };
      
    } catch (error) {
      console.error("内容加载失败:", error);
      return {
        ...msg,
        sortTime: Date.now(),
        content: `内容加载失败: ${error.message}`,
        type: '错误'
      };
    }
  })
);

// 排序逻辑（新增）
const sortedMessages = detailedMessages.sort((a, b) => 
  b.sortTime - a.sortTime
).map(msg => ({
  ...msg,
  // 最终显示时间（带时区）
  time: new Date(msg.sortTime).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}));

setMessages(sortedMessages);
  
      setMessages(detailedMessages);
    } catch (error) {
      console.error('加载失败:', error);
      alert(`错误: ${error.message}`);
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

  // 在组件中监听账户变化
useEffect(() => {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      loadMessages(); // 重新加载消息
    });
  }
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
  if (!(await checkIfAdmin(selectedAdmin))) {
    alert('所选地址不是管理员');
    return;
  }
  if (!selectedAdmin) {
    alert('请选择管理员');
    return;
  }

  try {
    setIsSending(true);
    const content = await generateMessageContent();
    const ipfsHash = await uploadToIPFS(content);
    console.log('IPFS内容已上传，哈希:', ipfsHash); // 添加调试日志
    
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
  await loadMessages(); // 发送成功后刷新消息列表
  onClose(); // 关闭弹窗
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
                
                <div className="message-card" key={index}>
    <div className="message-header">
      <span className="message-time">{msg.time}</span>
    </div>
    <pre className="message-content">
      {typeof msg.content === 'object' 
        ? JSON.stringify(msg.content, null, 2)
        : (msg.content || "无有效内容")}
    </pre>
    {msg.content?.error && (
      <div className="error-notice">⚠️ 内容加载异常</div>
    )}
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