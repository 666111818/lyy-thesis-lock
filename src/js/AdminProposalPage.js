import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import { GOVERNANCE_ADDRESS, GOVERNANCE_ABI } from '../contract/Governance';
import '../css/AdminProposalPage.css';

const PINATA_API_KEY = process.env.REACT_APP_PINATA_KEY;
const PINATA_SECRET = process.env.REACT_APP_PINATA_SECRET;

const AdminProposalPage = ({ onClose }) => {
  const [currentAdmins, setCurrentAdmins] = useState([]);
  const [selectedRemove, setSelectedRemove] = useState('');
  const [newAdmin, setNewAdmin] = useState('');
  const [ipfsHash, setIpfsHash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // 初始化获取管理员列表
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, provider);
        const admins = await contract.getAdmins();
        setCurrentAdmins(admins);
        setSelectedRemove(admins[0] || '');
      } catch (error) {
        console.error('获取管理员列表失败：', error);
      }
    };

    fetchAdmins();
  }, []);

  // 生成提案描述
const generateDescription = () => {
    if (!selectedRemove || !newAdmin) return '';
    return `更换管理员：移除 ${selectedRemove} 添加 ${newAdmin}`;
  };

  // 上传到IPFS
  const uploadToIPFS = async () => {
    const changeData = {
      timestamp: Date.now(),
      remove: selectedRemove,
      add: newAdmin,
      reason: "管理员更换提案"
    };

    try {
      const res = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        changeData,
        {
          headers: {
            'Content-Type': 'application/json',
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET
          }
        }
      );
      return res.data.IpfsHash;
    } catch (error) {
      if (error.response) {
        console.error('IPFS上传失败，响应数据：', error.response.data);
      } else {
        console.error('IPFS上传失败:', error.message);
      }
      throw new Error('IPFS上传失败');
    }
  };

  // 提交提案
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatusMessage('处理中...');

    try {
      // 检查上一次提案时间
      const lastProposalTime = localStorage.getItem('lastProposalTime');
      const currentTime = Date.now();
      if (lastProposalTime && currentTime - lastProposalTime < 10 * 60 * 1000) {
        throw new Error('在10分钟内已提交过提案，请稍后再试。');
      }

      // 验证地址有效性
      if (!ethers.isAddress(newAdmin)) {
        throw new Error('新管理员地址无效');
      }

      // 生成IPFS哈希
      const hash = await uploadToIPFS();
      setIpfsHash(hash);

      // 准备提案数据
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, signer);

      // 构造新的管理员列表
      const newAdmins = currentAdmins
        .filter(a => a.toLowerCase() !== selectedRemove.toLowerCase())
        .concat([newAdmin]);

      // 编码函数调用数据
      const encodedFunction = contract.interface.encodeFunctionData(
        'updateAdminList',
        [newAdmins, hash]
      );

      // 创建提案，目标合约为治理合约本身
      const tx = await contract.createProposal(
        generateDescription(),
        GOVERNANCE_ADDRESS,
        encodedFunction
      );

      await tx.wait();
      setStatusMessage('提案创建成功！');
      // 记录本次提案时间
      localStorage.setItem('lastProposalTime', currentTime);
    } catch (error) {
      console.error('提交失败:', error);
      setStatusMessage(`错误：${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="admin-proposal-container">
        <button onClick={onClose} className="close-button">
          ×
        </button>
      <h2 className="page-title">管理员更换提案</h2>

      <div className="admin-list">
        <h3>当前管理员列表</h3>
        <ul>
          {currentAdmins.map(admin => (
            <li key={admin}>{admin}</li>
          ))}
        </ul>
      </div>

      <form className="proposal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="removeSelect">选择要移除的管理员</label>
          <select
            id="removeSelect"
            value={selectedRemove}
            onChange={(e) => setSelectedRemove(e.target.value)}
            required
          >
            {currentAdmins.map(admin => (
              <option key={admin} value={admin}>
                {admin}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="newAdmin">新管理员地址</label>
          <input
            id="newAdmin"
            type="text"
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="0x..."
            required
          />
        </div>

        <div className="preview">
          <p><strong>提案描述：</strong>{generateDescription()}</p>
          {ipfsHash && <p><strong>IPFS哈希：</strong>{ipfsHash}</p>}
        </div>

        <button
          type="submit"
          disabled={isProcessing}
          className={`submit-button ${isProcessing ? 'processing' : ''}`}
        >
          {isProcessing ? '提交中...' : '发起提案'}
        </button>

        {statusMessage && <div className="status">{statusMessage}</div>}
      </form>
      
    </div>
  );
};

export default AdminProposalPage;
