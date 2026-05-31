# AITI 测试网页

这是一个纯前端 React + Vite 项目，用于运行 AITI（AI Type Index）测试：用户回答 30 道四选一题后，页面会生成 AI 助手相似度、主人格、副人格和隐藏 bug。

## 用 IntelliJ IDEA 打开

1. 解压项目压缩包。
2. 用 IntelliJ IDEA 选择 `Open`，打开 `aiti-test` 文件夹。
3. 确认电脑已经安装 Node.js。建议使用 Node.js 22 LTS 或更新版本。
4. 打开 IDEA 底部 Terminal，执行：

```bash
npm install
npm run dev
```

5. 浏览器会自动打开测试页面；如果没有自动打开，访问终端显示的地址，一般是：

```text
http://localhost:5173
```

## 目录结构

```text
aiti-test/
├── public/
│   └── aiti_v0_1_config.json      # 16 AI × 24 人格 × 30 题配置
├── src/
│   ├── App.jsx                    # 主页面逻辑
│   ├── main.jsx                   # React 入口
│   ├── styles.css                 # 页面样式
│   ├── data/
│   │   └── resultCopy.js          # 结果页文案库
│   └── utils/
│       └── scoring.js             # 计分与 AI 匹配算法
├── index.html
├── package.json
└── vite.config.js
```

## 怎么修改题目和权重

直接改：

```text
public/aiti_v0_1_config.json
```

每个选项使用 `scores` 字段给人格加分，例如：

```json
{
  "id": "A",
  "text": "先把问题拆成几个小问题。",
  "scores": {
    "SOLVER": 3,
    "REASONER": 2,
    "PLANNER": 1
  }
}
```

## 算法说明

1. 用户每题选一个选项。
2. 程序把选项里的 `scores` 累加成用户的 24 人格向量。
3. 计算用户人格向量与 16 个 AI 权重向量的余弦相似度。
4. 排名前 5 的 AI 经过 softmax 转换为百分比。
5. `LIAR` 和 `FLATTERER` 不参与 AI 相似度计算，只作为隐藏 bug 展示。
