import fs from 'node:fs';
import path from 'node:path';

export function advancedOutputs({book,emit,banner,markdown,root}){
 const advanced=book.chapters.filter(c=>c.advanced&&c.id<80);
 const link=(n,prefix='../')=>`${prefix}chapters/${String(n).padStart(2,'0')}.md`;
 emit('quant_v2_advanced.md',banner+`# 量化进阶 随机过程到组合决策

${advanced.length} 讲、${advanced.length*2} 道推导自测。沿用原章号，第45至80讲依次建立信息、模型、定价、证据、执行与风险之间的联系。后续研究与系统内容见 [第81至104讲](quant_v3_research.md)。

[先修地图](docs/KNOWLEDGE_MAP.md) · [公式与单位](docs/ADVANCED_CHEATSHEET.md) · [推导自测](docs/ADVANCED_EXERCISES.md) · [数值复算](docs/NUMERICAL_EXAMPLES.md) · [全书](quant_v1_full.md)

## 目录

`+advanced.map(c=>`- [第 ${c.num} 讲 ${c.title}](#chapter-${c.num})`).join('\n')+'\n\n'+advanced.map(c=>markdown(c)).join('\n\n---\n\n'));
 emit('data/advanced-questions.json',JSON.stringify(book.advanced_questions,null,2));
 let exercise=banner+`# ${book.stats.advanced_questions} 道进阶推导自测\n\n每讲两题，对照正文的同题号讲解。建议先说明假设、手算例子、再解释失效条件。播放器中的参考回答默认折叠，并可按答题停顿朗读。\n\n`;
 for(const q of book.advanced_questions){const c=book.chapters[q.chapter-1];const section=c.toc.find(s=>s.title.startsWith(q.id+' '));exercise+=`## ${q.id} ${c.title}\n\n${q.question}\n\n参考回答：${q.answer}\n\n[正文与推导](${link(q.chapter)}#${section.anchor})\n\n`;}
 emit('docs/ADVANCED_EXERCISES.md',exercise);
 emit('docs/KNOWLEDGE_MAP.md',banner+`# 量化知识体系与先修地图

原01至44讲建立 ETF 交易基础与面试案例；新增45至80讲把随机建模、资产定价、实证信号、历史验证和组合决策连接起来。阅读顺序按任务依赖，不要求先把全部数学证明学完才接触应用。

~~~mermaid
flowchart TD
 A[概率与统计 06至10] --> B[随机过程与信息 45至52]
 B --> C[复制与期权定价 53至60]
 B --> D[时点可见数据与因子 61至67]
 D --> E[因果时间线与回测 68至74]
 E --> F[约束 成本与组合优化 75至80]
 G[ETF 定价 对冲 做市 11至28] --> C
 G --> F
 C --> H[Greeks与风险]
 H --> F
 F --> I[执行与风险复盘]
 I --> E
~~~

## 五个专题的输入输出

| 专题 | 主要输入 | 输出 | 先修与入口 |
| --- | --- | --- | --- |
| 随机过程 | 信息集、状态、转移和噪声假设 | 条件分布、路径、等待与估计误差 | [06 条件概率](${link(6)}) → [45至52](${link(45)}) |
| 期权定价 | 支付、交易资产、资金与模型 | 复制价格、Greeks、IV、数值误差 | 随机过程 → [53至60](${link(53)}) |
| 因子研究 | PIT 面板、特征、标签与股票池 | 截面关系、组合与统计证据 | [26 回测基础](${link(26)}) → [61至67](${link(61)}) |
| 回测验证 | 信号、成交、持仓、费用和切分 | 净值、账本、暴露与样本外证据 | 因子和执行 → [68至74](${link(68)}) |
| 组合优化 | μ、Σ、当前权重、限额与成本 | 可行目标权重及交易计划 | 回测与风险 → [75至80](${link(75)}) |

## 三条完整阅读路线

期权与做市：45、47至49 → 53至60 → 18至25 → 75至80。重点检查定价测度、合约乘数、delta 方向与残余风险。

因子与研究：45、46、50至52 → 61至67 → 68至74 → 75至80。重点检查数据可用时间、搜索过程、成本和最终组合暴露。

已有研究经验补工程接口：62 → 68至71 → 74 → 76、79、80。用三日价格、现金账本和约束冲突的小例子，检查管线是否真的因果可执行。

## 容易跨层误用的概念

| 看似相近 | 应怎样区分 |
| --- | --- |
| P 与 Q | 真实概率预测与交易一致的定价测度 |
| 校准与预测 | 重现当前价格与预测未来实现 |
| IC 与收益 | 排序关联与带权持仓的成本后结果 |
| 特征中性与组合中性 | 输入残差的性质与最终权重的暴露 |
| 时间标签与成交区间 | 学习目标的统计定义与实际产生盈亏的时段 |
| 模型最优与可执行 | 给定输入的数学解与权限、深度、现金和整数约束 |

## 完成标准

每讲能说清输入输出、复算一个数值、回答两道自测，并指出一个失效条件。全线完成后，用 [第80讲综合案例](${link(80)}) 把预测、优化、成本和压力风险串起来；再回到 [39至43讲动态交易案例](${link(39)}) 练习信息变化时的动作。
`);
 emit('docs/ADVANCED_CHEATSHEET.md',banner+`# 进阶公式 假设与单位速查

公式用于配合正文推导，不能脱离模型和时间口径使用。回报与协方差须同周期；期权 r、q、σ 与期限须匹配年化定义。

| 对象 | 关系 | 条件与入口 |
| --- | --- | --- |
| 马尔可夫分布 | 行向量 π_next=πP，平稳 π=πP | [46](${link(46)})，固定转移假设 |
| 鞅 | E[M_t 给定 F_s]=M_s | [47](${link(47)})，适应与可积 |
| Brownian 增量 | ΔW=sqrt(Δt)Z | [48](${link(48)})，Z 标准正态 |
| Itô | df=(f_t+a f_x+0.5b² f_xx)dt+b f_x dW | [49](${link(49)})，光滑与可积条件 |
| GBM | S_T=S0 exp[(μ-σ²/2)T+σsqrt(T)Z] | [49](${link(49)})，恒定参数 |
| OU 半衰期 | log2/κ | [50](${link(50)})，κ>0，注明时间单位 |
| Monte Carlo | SE=s/sqrt(N) | [51](${link(51)})，N 为独立观察或配对数 |
| 一步复制 | Δ=(V_up-V_down)/(S_up-S_down) | [54](${link(54)})，可复制两态模型 |
| 二叉风险中性权重 | p=(R-d)/(u-d) | [54](${link(54)})，d<R<u |
| 欧式平价 | C-P=Se^(-qτ)-Ke^(-rτ) | [53](${link(53)})，相同 K 与期限 |
| BSM PDE | V_t+0.5σ²S²V_SS+(r-q)SV_S-rV=0 | [55](${link(55)})，动态复制假设 |
| BSM Call | Se^(-qτ)N(d1)-Ke^(-rτ)N(d2) | [56](${link(56)})，d1/d2 定义见正文 |
| Greeks 展开 | ΔV≈DeltaΔS+0.5Gamma(ΔS)²+VegaΔσ+ThetaΔt | [57](${link(57)})，局部近似 |
| 特征残差 | x_res=x-Zβ | [63](${link(63)})，β 为规定截面拟合 |
| Rank IC 无并列简式 | 1-6Σd²/[n(n²-1)] | [64](${link(64)})，并列需改用相应秩相关 |
| 净值换手成本 | cost=Σ c_i abs(w_i-w_pre_i) | [65](${link(65)})，完整 L1 成交口径 |
| 时间对齐 | pnl_t=w_(t-1)ᵀr_t-cost_t | [68](${link(68)})，仓位必须已在区间前建立 |
| CAGR | (末值/初值)^(1/年数)-1 | [72](${link(72)})，外部现金流已剥离 |
| 多次独立假阳性 | 1-(1-a)^m | [73](${link(73)})，独立无效检验教学模型 |
| 均值方差 | max μᵀw-(γ/2)wᵀΣw | [75](${link(75)})，加预算和可行域 |
| GMV | Σ^-1 1/(1ᵀΣ^-1 1) | [75](${link(75)})，正定且无其他约束 |
| 收缩 | Σ_hat=(1-δ)S+δF | [77](${link(77)})，固定δ不等于估计最优 |
| 波动贡献 | RC_i=w_i(Σw)_i/σp | [78](${link(78)})，贡献和为 σp |
| 样本 CVaR | min_eta eta+Σmax(L_s-eta,0)/[(1-a)M] | [78](${link(78)})，损失为正且情景等权 |
| 无交易阈值 | abs(a-w0)≤c/γ | [79](${link(79)})，适用正文一维二次目标 |

## 五个数值参照

Black Scholes 标准 call=10.450584、put=5.573526；Vega 按波动改1.00报告约37.524，改1个百分点贡献约0.37524。

零相关、波动20%/10%的 GMV 权重20%/80%，风险平价权重1/3和2/3。

四只资产排名 (1,2,3,4) 与 (2,1,3,4) 的 Rank IC=0.8，不是收益80%。

看完价格110后才做多、再跌到99，后续收益-10%；不能拿之前100到110的+10%。

20个独立无效检验各5%假阳性，至少一个通过约64.15%；相关搜索不能直接套同一数值。
`);
 const r=JSON.parse(fs.readFileSync(path.join(root,'data/numerical-results.json'),'utf8'));
 const f=(x,d=6)=>Number(x).toFixed(d);
 emit('docs/NUMERICAL_EXAMPLES.md',banner+`# 可运行数值例子与交叉核验

脚本仅使用 Python 3.10+ 标准库、合成随机数和正文显式教学参数，不连接行情或账户。它展示方法与对账，不给出真实策略业绩。

~~~sh
python examples/quant_examples.py --output data/numerical-results.json
node scripts/build.mjs
node scripts/check.mjs
~~~

[运行脚本](../examples/quant_examples.py) · [原始计算输出](../data/numerical-results.json)

## 解析定价与有限差分

输入 S=K=100、r=5%、q=0、σ=20%、τ=1年。

| 对象 | 解析值 | 独立差分值 |
| --- | --- | --- |
| Call | ${f(r.black_scholes.call)} | 由树与 Monte Carlo 另行比较 |
| Put | ${f(r.black_scholes.put)} | 同时核对平价 |
| Delta | ${f(r.black_scholes.delta)} | ${f(r.greeks_finite_difference.delta)} |
| Gamma | ${f(r.black_scholes.gamma)} | ${f(r.greeks_finite_difference.gamma)} |
| Vega 每1.00波动 | ${f(r.black_scholes.vega)} | ${f(r.greeks_finite_difference.vega)} |

价格 ${f(r.implied_volatility.call_price_at_22pct)} 反解 σ 得 ${f(r.implied_volatility.recovered_sigma)}。还测试到期、零波动以及含股息平价边界。

## 树收敛与美式行权

| 步数 | CRR 欧式 call |
| --- | --- |
${Object.entries(r.crr_call_convergence).map(([n,p])=>`| ${n} | ${f(p)} |`).join('\n')}

无分红标准 call 的美式树价为 ${f(r.american_exercise.call)}，与同网格欧式值一致。S70 的深度价内 put，欧式树价 ${f(r.american_exercise.deep_put_european)}，美式 ${f(r.american_exercise.deep_put_american)}；检查最优停止价值至少不低于即时行权和欧式。

## Monte Carlo 误差

固定种子 ${r.monte_carlo.seed}，${r.monte_carlo.independent_pairs} 个独立对偶配对，共 ${r.monte_carlo.terminal_payoffs} 笔支付。按配对均值计算估值 ${f(r.monte_carlo.price)}，标准误 ${f(r.monte_carlo.standard_error)}，近似95%区间 [${f(r.monte_carlo.ci95[0])}, ${f(r.monte_carlo.ci95[1])}]。解析基准 ${f(r.monte_carlo.analytic)}。

区间仅量化该模型和抽样法的 Monte Carlo 误差，不覆盖模型、数据或执行风险。固定种子可复现，不意味着区间有确定覆盖保证；校验使用较宽的统计 sanity 阈值，而不是要求每次95%区间都必然覆盖。

## 研究时间与账本

Rank IC=${f(r.factor_and_backtest.rank_ic,1)}，行业残差为 ${r.factor_and_backtest.industry_residuals.join(', ')}。三日价格的正确后续回报为 ${f(100*r.factor_and_backtest.correct_future_return,1)}%，错误同区间记法为 +${f(100*r.factor_and_backtest.incorrect_same_interval_return,1)}%。买卖账本最终现金 ${r.factor_and_backtest.final_cash}，与净价格利润减费用一致。重叠标签清洗只保留 safe 样本。

## 组合与成本

GMV 权重 ${r.portfolio.gmv_weights.map(x=>f(x,2)).join('/')}，波动 ${f(100*r.portfolio.gmv_vol,4)}%。网格独立验证均值方差解40%/60%，加A上限后30%/70%，波动 ${f(100*r.portfolio.constrained_vol,4)}%。相关升至0.8后波动 ${f(100*r.portfolio.correlation_stress_vol,4)}%。单次换手成本 ${f(10000*r.portfolio.one_time_cost,2)}bps，与年化预期分开报告。

对一维成本问题还用网格验证无交易区间；样本 CVaR 优化给 ${f(r.portfolio.cvar80,0)}。这些校验确认对应教学问题的计算，不证明估计输入在真实市场准确。
`);
}
