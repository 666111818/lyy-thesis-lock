// AdminProposalLog.js
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import dayjs from 'dayjs';
import axios from 'axios';
import { GOVERNANCE_ADDRESS, GOVERNANCE_ABI } from '../contract/Governance';
import '../css/AdminProposalLog.css';

const AdminProposalLog = ({ onClose }) => {
    const [allProposals, setAllProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProposal, setSelectedProposal] = useState(null);
    const [ipfsDetails, setIpfsDetails] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(5);
    const [filter, setFilter] = useState('all');

    // 先定义状态判断函数
  const getProposalStatus = (proposal) => {
    const now = Math.floor(Date.now() / 1000);
    if (proposal.executed) return '已执行';
    return proposal.voteEnd > now ? '进行中' : '已结束';
  };
  // 获取所有提案
  const fetchProposals = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, provider);
      
      const count = Number(await contract.proposalCount());
      const proposals = [];
      
      for (let i = 0; i < count; i++) {
        const proposal = await contract.proposals(i);
        proposals.push({
          id: Number(proposal.id),
          description: proposal.description,
          proposer: proposal.proposer,
          voteEnd: Number(proposal.voteEnd),
          approvals: Number(proposal.approvals),
          executed: proposal.executed,
          targetContract: proposal.targetContract
        });
      }
      
      setAllProposals(proposals);
      setLoading(false);
    } catch (error) {
      console.error('获取提案失败:', error);
      setLoading(false);
    }
  };

  // 提案过滤逻辑（使用已定义的getProposalStatus）
  const filteredProposals = allProposals.filter(proposal => {
    const status = getProposalStatus(proposal);
    if (filter === 'all') return true;
    return status === filter;
  });

  // 获取IPFS详情
  const fetchIpfsDetails = async (hash) => {
    try {
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${hash}`);
      setIpfsDetails(response.data);
    } catch (error) {
      console.error('获取IPFS详情失败:', error);
      setIpfsDetails({ error: "无法获取提案详情" });
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);


  // 分页逻辑
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProposals.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProposals.length / itemsPerPage);

  // 格式化时间
  const formatTime = (timestamp) => {
    return dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss');
  };


  // 分页控制
  const handlePagination = (direction) => {
    setCurrentPage(prev => {
      if (direction === 'prev' && prev > 1) return prev - 1;
      if (direction === 'next' && prev < totalPages) return prev + 1;
      return prev;
    });
  };

  return (
    <div className="proposal-log-container">
      <div className="header">
        <h1>提案记录</h1>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="controls">
        <div className="filter-control">
          <label>筛选状态：</label>
          <select 
            value={filter} 
            onChange={(e) => {
              setFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">全部</option>
            <option value="进行中">进行中</option>
            <option value="已结束">已结束</option>
            <option value="已执行">已执行</option>
          </select>
        </div>
        
        <div className="pagination-control">
          <button 
            onClick={() => handlePagination('prev')}
            disabled={currentPage === 1}
          >
            上一页
          </button>
          <span>第 {currentPage} 页 / 共 {totalPages} 页</span>
          <button 
            onClick={() => handlePagination('next')}
            disabled={currentPage === totalPages}
          >
            下一页
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">加载提案中...</div>
      ) : (
        <>
          <div className="proposal-list">
            {currentItems.map(proposal => (
              <div 
                key={proposal.id} 
                className={`proposal-card ${getProposalStatus(proposal).toLowerCase()}`}
              >
                <div className="proposal-header">
                  <h3>提案 #{proposal.id}</h3>
                  <span className={`status-tag ${getProposalStatus(proposal).toLowerCase()}`}>
                    {getProposalStatus(proposal)}
                  </span>
                </div>
                
                <div className="proposal-body">
                  <p className="description">{proposal.description}</p>
                  
                  <div className="details-grid">
                    <div className="detail-item">
                      <label>发起人</label>
                      <span>{proposal.proposer.slice(0,6)}...{proposal.proposer.slice(-4)}</span>
                    </div>
                    <div className="detail-item">
                      <label>截止时间</label>
                      <span>{formatTime(proposal.voteEnd)}</span>
                    </div>
                    <div className="detail-item">
                      <label>赞成票数</label>
                      <span>{proposal.approvals}</span>
                    </div>
                    <div className="detail-item">
                      <label>目标合约</label>
                      <span>{proposal.targetContract.slice(0,8)}...</span>
                    </div>
                  </div>

                  {proposal.description.includes('Qm') && (
                    <button 
                      className="detail-btn"
                      onClick={() => {
                        const ipfsHash = proposal.description.split(' ').find(str => str.startsWith('Qm'));
                        if (ipfsHash) fetchIpfsDetails(ipfsHash);
                      }}
                    >
                      查看提案详情
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredProposals.length === 0 && !loading && (
            <div className="no-data">没有找到符合条件的提案</div>
          )}
        </>
      )}

      {ipfsDetails && (
        <div className="ipfs-modal">
          <div className="ipfs-content">
            <h3>提案详细信息</h3>
            <pre>{JSON.stringify(ipfsDetails, null, 2)}</pre>
            <button onClick={() => setIpfsDetails(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProposalLog;