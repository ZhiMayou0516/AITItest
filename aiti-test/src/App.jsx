import { useEffect, useMemo, useState } from 'react';
import { calculateResult, getTraitMeta } from './utils/scoring.js';
import { bugCopy, traitCopy } from './data/resultCopy.js';

const CONFIG_PATH = '/aiti_v0_1_config.json';

export default function App() {
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState('start');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch(CONFIG_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`配置文件加载失败：${res.status}`);
        return res.json();
      })
      .then((data) => setConfig(data))
      .catch((error) => setLoadError(error.message));
  }, []);

  const totalQuestions = config?.questions?.length ?? 0;
  const currentQuestion = config?.questions?.[currentIndex];
  const progressPercent = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;

  const answeredMap = useMemo(() => {
    return new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  }, [answers]);

  function startQuiz() {
    setPhase('quiz');
    setCurrentIndex(0);
    setAnswers([]);
    setResult(null);
  }

  function chooseOption(optionId) {
    if (!currentQuestion || !config) return;

    const nextAnswers = [
      ...answers.filter((answer) => answer.questionId !== currentQuestion.id),
      { questionId: currentQuestion.id, optionId }
    ];
    setAnswers(nextAnswers);

    if (currentIndex < totalQuestions - 1) {
      setTimeout(() => setCurrentIndex((prev) => prev + 1), 140);
    } else {
      const finalResult = calculateResult(config, nextAnswers, { topN: 5, alpha: 9 });
      setResult(finalResult);
      setTimeout(() => setPhase('result'), 140);
    }
  }

  function goPrevious() {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  }

  function restart() {
    setPhase('start');
    setCurrentIndex(0);
    setAnswers([]);
    setResult(null);
  }

  if (loadError) {
    return (
      <Shell>
        <div className="card narrow-card">
          <p className="eyebrow">AITI</p>
          <h1>配置文件没加载成功</h1>
          <p className="muted">{loadError}</p>
          <p className="muted small">请确认 <code>public/aiti_v0_1_config.json</code> 存在，然后重新运行。</p>
        </div>
      </Shell>
    );
  }

  if (!config) {
    return (
      <Shell>
        <div className="loading-card">
          <div className="spinner" />
          <p>正在加载 AITI 配置...</p>
        </div>
      </Shell>
    );
  }

  if (phase === 'start') {
    return <StartPage config={config} onStart={startQuiz} />;
  }

  if (phase === 'quiz') {
    return (
      <QuizPage
        question={currentQuestion}
        currentIndex={currentIndex}
        totalQuestions={totalQuestions}
        progressPercent={progressPercent}
        selectedOptionId={answeredMap.get(currentQuestion?.id)}
        onChoose={chooseOption}
        onPrevious={goPrevious}
      />
    );
  }

  if (phase === 'result' && result) {
    return <ResultPage config={config} result={result} onRestart={restart} />;
  }

  return null;
}

function Shell({ children }) {
  return (
    <main className="app-shell">
      <div className="bg-orb orb-one" />
      <div className="bg-orb orb-two" />
      {children}
    </main>
  );
}

function StartPage({ config, onStart }) {
  return (
    <Shell>
      <section className="hero-card">
        <div className="pill-row">
          <span className="pill">16 AI 助手</span>
          <span className="pill">24 人格标签</span>
          <span className="pill">30 道题</span>
        </div>
        <p className="eyebrow">AI TYPE INDEX</p>
        <h1>测测你是哪款 AI 助手投胎做人</h1>
        <p className="hero-text">
          回答 30 个生活化选择题，生成你的 AI 相似度配方、主人格、副人格和隐藏 bug。
        </p>
        <button className="primary-button" onClick={onStart}>开始生成我的 AI 配方</button>
        <div className="ai-strip" aria-label="AI 助手列表">
          {Object.values(config.ai_profiles ?? {}).slice(0, 8).map((item) => (
            <span className="ai-strip-item" key={item.display_name}>
              {item.icon && <img src={item.icon} alt="" />}
              {item.display_name}
            </span>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function QuizPage({ question, currentIndex, totalQuestions, progressPercent, selectedOptionId, onChoose, onPrevious }) {
  return (
    <Shell>
      <section className="quiz-card">
        <div className="quiz-topbar">
          <span>第 {currentIndex + 1} / {totalQuestions} 题</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>

        <h2>{question.text}</h2>

        <div className="option-list">
          {question.options.map((option) => (
            <button
              key={option.id}
              className={`option-button ${selectedOptionId === option.id ? 'selected' : ''}`}
              onClick={() => onChoose(option.id)}
            >
              <span className="option-id">{option.id}</span>
              <span>{option.text}</span>
            </button>
          ))}
        </div>

        <div className="quiz-actions">
          <button className="ghost-button" onClick={onPrevious} disabled={currentIndex === 0}>上一题</button>
          <span className="muted small">选中后会自动进入下一题</span>
        </div>
      </section>
    </Shell>
  );
}

function ResultPage({ config, result, onRestart }) {
  const mainMeta = getTraitMeta(config, result.mainTrait.trait);
  const mainCopy = traitCopy[result.mainTrait.trait] ?? {
    title: mainMeta.zh ?? result.mainTrait.trait,
    line: mainMeta.description ?? '你的画像已经生成。',
    share: `测出来我是 ${result.mainTrait.trait} 型 AI。`
  };
  const hiddenBugMeta = getTraitMeta(config, result.hiddenBug.trait);
  const hiddenBugCopy = bugCopy[result.hiddenBug.trait] ?? {
    title: `隐藏 bug：${result.hiddenBug.trait}`,
    line: '你的隐藏 bug 已经出现，但它还没来得及写自我介绍。'
  };

  return (
    <Shell>
      <section className="result-card" id="result-card">
        <p className="eyebrow">YOUR AI RECIPE</p>
        <h1>你的 AI 配方已经生成</h1>

        <div className="match-list">
          {result.aiMatches.map((item, index) => (
            <div className="match-item" key={item.key}>
              <div className="match-rank">#{index + 1}</div>
              <div className="match-icon-wrap">
                {item.icon && <img src={item.icon} alt={`${item.name} 图标`} />}
              </div>
              <div className="match-main">
                <div className="match-name-row">
                  <strong>{item.name}</strong>
                  <span>{item.percent}%</span>
                </div>
                <div className="match-track">
                  <div className="match-bar" style={{ width: `${item.percent}%` }} />
                </div>
                <p>{item.shortProfile}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="result-grid">
          <InfoBlock
            icon={mainMeta.icon}
            title="主人格"
            value={result.mainTrait.trait}
            sub={`${mainMeta.zh ?? ''} · ${result.mainTrait.score} 分`}
          />
          <InfoBlock
            icon={result.subTraits[0] ? getTraitMeta(config, result.subTraits[0].trait).icon : ''}
            title="副人格"
            value={result.subTraits.map((item) => item.trait).join(' / ')}
            sub={result.subTraits.map((item) => `${getTraitMeta(config, item.trait).zh ?? item.trait} ${item.score}`).join(' · ')}
          />
          <InfoBlock
            icon={hiddenBugMeta.icon}
            title="隐藏 bug"
            value={result.hiddenBug.trait}
            sub={`${result.hiddenBug.score} 分`}
          />
        </div>

        <article className="copy-card">
          <h2>{mainCopy.title}</h2>
          <p>{mainCopy.line}</p>
          <div className="bug-box">
            <strong>{hiddenBugCopy.title}</strong>
            <p>{hiddenBugCopy.line}</p>
          </div>
          <div className="share-box">
            <span>分享文案</span>
            <p>{mainCopy.share}</p>
          </div>
        </article>

        <div className="top-traits">
          <h3>你的高分人格</h3>
          <div className="trait-chip-list">
            {result.topTraits.slice(0, 6).map((item) => {
              const meta = getTraitMeta(config, item.trait);
              return (
                <span className="trait-chip" key={item.trait}>
                  {meta.icon && <img src={meta.icon} alt="" />}
                  <span>{item.trait}</span> <em>{meta.zh}</em> <b>{item.score}</b>
                </span>
              );
            })}
          </div>
        </div>

        <div className="result-actions">
          <button className="primary-button" onClick={onRestart}>再测一次</button>
          <button className="ghost-button" onClick={() => window.print()}>打印 / 保存结果</button>
        </div>
      </section>
    </Shell>
  );
}

function InfoBlock({ title, value, sub, icon }) {
  return (
    <div className="info-block">
      {icon && <img className="info-icon" src={icon} alt="" />}
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <p>{sub}</p>
      </div>
    </div>
  );
}
