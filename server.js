cat <<'EOF' > server.js
// ====================================================
//  最终修正版 server.js
//  功能:
//  1. 在根路径 '/' 提供 phone.html
//  2. 完整保留 V2 云同步 API 功能
// ====================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// --- 核心配置 ---
const PROJECT_ROOT = '/root/eephone'; // 项目根目录
const DATA_DIR = path.join(PROJECT_ROOT, 'data'); // 统一的数据存储目录
const MANUAL_BACKUP_PATH = path.join(DATA_DIR, 'backup_manual.json');
const AUTO_BACKUP_PATH = path.join(DATA_DIR, 'backup_auto.json');

// --- 启动前准备 ---

// 1. 确保data文件夹存在，用于存放云同步的备份文件
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`✅ 备份目录 ${DATA_DIR} 已创建`);
}

// 2. 中间件: 解析JSON请求体 (为云同步API的POST请求服务)
app.use(express.json({ limit: '50mb' }));

// 3. 中间件: 静态文件服务 (可选，但推荐)
// 如果你的 phone.html 引用了同目录下的CSS或JS文件，这个设置会自动处理
app.use(express.static(PROJECT_ROOT));


// ===================================
//  V2 云同步 API 路由 (功能保留)
// ===================================

// API 1: 获取备份文件列表
app.get('/api/data/list', (req, res) => {
    try {
        const getFileInfo = (filePath) => {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                try {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    return {
                        timestamp: content.metadata.timestamp,
                        size: stats.size,
                        sourceDeviceId: content.metadata.sourceDeviceId
                    };
                } catch (e) {
                    // 如果JSON解析失败，返回基础信息
                    return { timestamp: null, size: stats.size, sourceDeviceId: 'unknown' };
                }
            }
            return null;
        };
        const versions = { manual: getFileInfo(MANUAL_BACKUP_PATH), auto: getFileInfo(AUTO_BACKUP_PATH) };
        console.log('✅ API [列表] 请求：成功发送备份版本信息。');
        res.json(versions);
    } catch (err) {
        console.error('❌ API [列表] 出错:', err);
        res.status(500).json({ error: '获取备份列表失败', details: err.message });
    }
});

// API 2: 获取指定类型的备份数据
app.get('/api/data', (req, res) => {
    const backupType = req.query.type;
    if (!backupType) return res.status(400).json({ error: '必须提供 "type" 查询参数 (manual/auto)' });

    const filePath = backupType === 'manual' ? MANUAL_BACKUP_PATH : AUTO_BACKUP_PATH;
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
        console.log(`✅ API [恢复] 请求：成功发送 ${backupType} 备份数据。`);
    } else {
        res.status(404).json({ error: `未找到 ${backupType} 备份文件` });
        console.log(`🟡 API [恢复] 请求：未找到 ${backupType} 备份文件。`);
    }
});

// API 3: 保存备份数据
app.post('/api/data', (req, res) => {
    const backupType = req.query.type;
    if (!backupType) return res.status(400).json({ error: '必须提供 "type" 查询参数 (manual/auto)' });
    if (!req.body || !req.body.data || !req.body.metadata) return res.status(400).json({ error: '请求体格式不正确' });

    const filePath = backupType === 'manual' ? MANUAL_BACKUP_PATH : AUTO_BACKUP_PATH;
    fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
        if (err) {
            console.error(`❌ API [备份] 写入 ${backupType} 文件时出错:`, err);
            return res.status(500).json({ error: '服务器写入备份文件失败。' });
        }
        console.log(`✅ API [备份] 请求：${backupType} 数据成功写入文件！`);
        res.status(200).json({ message: `${backupType} 备份成功` });
    });
});


// ===================================
//  主页面路由 
// ===================================

// 规则: 访问根目录 "/" 时，直接返回 "phone.html"
app.get('/', (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'phone.html'));
  console.log('✅ 页面请求 [/]：已发送 "phone.html"');
});


// ===================================
//  启动服务器
// ===================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n服务已在 http://0.0.0.0:${PORT} 上启动`);
  console.log('----------- 路由规则 -----------');
  console.log(`http://<你的IP>:${PORT}/         -> phone.html (主页面)`);
  console.log('--------------------------------');
  console.log('云同步API已准备就绪。\n');
});
EOF