// UserMessages.js
import React, { useState, useEffect } from 'react';
import { checkMetaMask, getReceivedMessages, sendMessageToAdmin, uploadToIPFS, createMessageListener,fetchIPFSContent,checkIfAdmin } from './Metamask';
import '../css/UserMessages.css';

function UserMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [userAddress, setUserAddress] = useState(''); 

  // 加载消息
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const address = await checkMetaMask();
        setUserAddress(address); // 设置用户地址
        const rawMessages = await getReceivedMessages(address);
        
        const detailedMessages = await Promise.all(
          rawMessages.map(async msg => await formatMessage(msg))
        );
        
        setMessages(detailedMessages);
      } catch (error) {
        console.error('加载消息失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMessages();
  }, []);

    // 消息格式化函数
  const formatMessage = async (msg) => {
    const isAdmin = await checkIfAdmin(msg.sender);
    return {
      ...msg,
      content: await fetchIPFSContent(msg.ipfsHash),
      time: new Date(msg.timestamp).toLocaleString(),
      shortAddress: `${msg.sender.slice(0,6)}...${msg.sender.slice(-4)}`,
      isAdmin
    };
  };

  // 实时监听
  useEffect(() => {
    if (!userAddress) return;
    
    const cleanup = createMessageListener(async (newMsg) => {
      if (newMsg.receiver === userAddress) {
        const formatted = await formatMessage(newMsg);
        setMessages(prev => [formatted, ...prev]);
      }
    });
    
    return cleanup;
  }, [userAddress]); 

  // 回复处理
  const handleReply = async () => {
    if (!replyContent || !replyingTo) return;
    
    try {
      setIsSending(true);
      const content = {
        type: 'admin_reply',
        content: replyContent,
        original: replyingTo.content,
        timestamp: new Date().toISOString()
      };
      
      const ipfsHash = await uploadToIPFS(content);
      await sendMessageToAdmin(replyingTo.sender, ipfsHash);
      
      setMessages(prev => prev.map(msg => 
        msg.txHash === replyingTo.txHash 
          ? { ...msg, replied: true } 
          : msg
      ));
      
      setReplyingTo(null);
      setReplyContent('');
      alert('回复已发送!');
    } catch (error) {
      console.error('发送失败:', error);
      alert(`发送失败: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="user-messages-container">
      <h2 className="section-title">用户来信 ({messages.length})</h2>
      
      <div className="messages-list">
        {loading ? (
          <div className="loading-indicator">
            <div className="loader"></div>
            加载消息中...
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <img src="/empty-inbox.png" alt="空信箱" />
            <p>暂无用户消息</p>
          </div>
        ) : messages.map((msg, index) => (
          <div key={index} className={`message-card ${msg.replied ? 'replied' : ''}`}>
            <div className="message-header">
              <span className="user-address">{msg.shortAddress}</span>
              <span className="message-time">{msg.time}</span>
              {msg.replied && <span className="replied-badge">已回复</span>}
            </div>
            
            <div className="message-content">
              <pre>{JSON.stringify(msg.content, null, 2)}</pre>
            </div>

            {!msg.replied && (
              <button 
                className="reply-button"
                onClick={() => setReplyingTo(msg)}
              >
                回复该用户
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 回复弹窗 */}
      {replyingTo && (
        <div className="reply-modal-overlay">
          <div className="reply-modal">
            <h3>回复用户 {replyingTo.shortAddress}</h3>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="输入回复内容..."
              className="reply-textarea"
            />
            <div className="modal-actions">
              <button 
                className="cancel-button"
                onClick={() => setReplyingTo(null)}
              >
                取消
              </button>
              <button
                className="send-button"
                onClick={handleReply}
                disabled={isSending}
              >
                {isSending ? '发送中...' : '发送回复'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMessages;