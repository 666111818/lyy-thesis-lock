import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import dayjs from 'dayjs';
import { GOVERNANCE_ADDRESS, GOVERNANCE_ABI } from '../contract/Governance';
import '../css/AdminVote.css';

const AdminVote = ({ onClose }) => {
  const [activeProposals, setActiveProposals] = useState([]);
  const [currentAccount, setCurrentAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [requiredApprovals, setRequiredApprovals] = useState(0);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));


  // 获取有效提案
 const fetchProposals = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, provider);
      
      const count = Number(await contract.proposalCount());
      const requiredApprovals = Number(await contract.requiredApprovals());
      setRequiredApprovals(requiredApprovals);

      const proposals = [];
      for (let i = 0; i < count; i++) {
        const proposal = await contract.proposals(i);
        const voteEnd = Number(proposal.voteEnd);
        const approvals = Number(proposal.approvals);
        const executed = proposal.executed;

        // 精确过滤条件（使用当前实时时间）
        const isActive = voteEnd > currentTime;
        const isPassedUnexecuted = 
          voteEnd <= currentTime && 
          approvals >= requiredApprovals && 
          !executed;

        if (isActive || isPassedUnexecuted) {
          proposals.push({
            id: i,
            description: proposal.description,
            voteEnd,
            approvals,
            executed,
            targetContract: proposal.targetContract
          });
        }
      }

      setActiveProposals(proposals);
      setLoading(false);
    } catch (error) {
      console.error('获取提案失败:', error);
      setLoading(false);
    }
  };

  // 初始化连接
  useEffect(() => {
    const init = async () => {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setCurrentAccount(accounts[0]);
      await fetchProposals();
    };
    init();
  }, []);
// 每秒刷新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 处理投票
  const handleVote = async (proposalId) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, signer);

      const tx = await contract.vote(proposalId);
      await tx.wait();
      await fetchProposals();
    } catch (error) {
      console.error('投票失败:', error);
      alert(error.reason || error.message);
    }
  };

  // 执行提案
  const handleExecute = async (proposalId) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, signer);

      const tx = await contract.executeProposal(proposalId);
      await tx.wait();
      await fetchProposals();
    } catch (error) {
      console.error('执行失败:', error);
      alert(error.reason || error.message);
    }
  };

  // 计算状态信息
  const getProposalStatus = (proposal) => {
    const isActive = proposal.voteEnd > currentTime;
    
    if (isActive) {
      const diffSeconds = proposal.voteEnd - currentTime;
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;
      return {
        type: 'active',
        timeLabel: '剩余时间',
        timeValue: `${minutes}分${seconds.toString().padStart(2, '0')}秒`
      };
    }
    
    return {
      type: 'executable',
      timeLabel: '截止时间',
      timeValue: dayjs(proposal.voteEnd * 1000).format('YYYY-MM-DD HH:mm:ss')
    };
  };

  return (
    <div className="vote-container">
      <div className="vote-header">
        <h1>治理投票面板</h1>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      <div className="wallet-info">
        当前账户：{currentAccount.slice(0,6)}...{currentAccount.slice(-4)}
        <div>当前所需赞成票：{requiredApprovals}</div>
      </div>

      {loading ? (
        <div className="loading">加载提案中...</div>
      ) : activeProposals.length === 0 ? (
        <div className="no-proposals">当前没有需要处理的提案</div>
      ) : (
        <div className="proposal-grid">
          {activeProposals.map((proposal) => {
            const status = getProposalStatus(proposal);
            
            return (
              <div key={proposal.id} className="proposal-card">
                <div className="proposal-header">
                  <h3>提案 #{proposal.id}</h3>
                  <span className={`status-tag ${status.type}`}>
                    {status.type === 'active' ? '进行中' : '待执行'}
                  </span>
                </div>

                <div className="description">
                  {proposal.description}
                </div>

                <div className="vote-stats">
                  <div className="stat-item">
                    <label>当前票数</label>
                    <div className="approvals-bar">
                      <div 
                        className="progress" 
                        style={{ width: `${(proposal.approvals / requiredApprovals) * 100}%` }}
                      />
                      <span>{proposal.approvals}/{requiredApprovals}</span>
                    </div>
                  </div>
                  
                  <div className="stat-item">
                    <label>{status.timeLabel}</label>
                    <div className="time-value">{status.timeValue}</div>
                  </div>
                </div>

                <div className="action-buttons">
                  {status.type === 'active' ? (
                    <button 
                      className="vote-button"
                      onClick={() => handleVote(proposal.id)}
                    >
                      投赞成票
                    </button>
                  ) : (
                    <button
                      className="execute-button"
                      onClick={() => handleExecute(proposal.id)}
                    >
                      立即执行
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminVote;