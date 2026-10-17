import fs from 'node:fs';
import path from 'node:path';

export function marketOutputs({book,emit,banner,markdown,root,outputs}){
 const chapters=book.chapters.filter(c=>c.edition===4);
 const r=JSON.parse(fs.readFileSync(path.join(root,'data/market-results.json'),'utf8'));
 const m=r.microstructure,h=r.high_frequency,p=r.statistical_arbitrage;
 const f=(v,d=6)=>Number(v).toFixed(d),pct=v=>f(v*100,4)+'%';
 const link=n=>`../chapters/${String(n).padStart(2,'0')}.md`;
 emit('quant_v4_market.md',banner+`# 市场微观结构 高频交易与统计套利

第105至128讲，24讲、48道推导自测。由撮合与测量进入队列、延迟、条件成交和双腿研究；每讲包含机制、手算、相邻概念与失效边界。三个标准库案例提供逐状态、逐预测、逐执行与逐期账本证据。

[知识地图](docs/KNOWLEDGE_MAP.md) · [学习路线](docs/LEARNING_PATHS.md) · [运行与实测输出](docs/MARKET_RESEARCH_CASES.md) · [公式与状态速查](docs/MARKET_CHEATSHEET.md) · [六个案例总览](docs/RESEARCH_CASES.md) · [全书](quant_v1_full.md)

## 目录

`+chapters.map(c=>`- [第 ${c.num} 讲 ${c.title}](#chapter-${c.num})`).join('\n')+'\n\n'+chapters.map(c=>markdown(c)).join('\n\n---\n\n'));
 emit('docs/LEARNING_PATHS.md',outputs.get('docs/LEARNING_PATHS.md')+`
## 市场微观结构 两周

先修：03盘口、21至23做市、68时点与98行情。第一周按 [105 撮合](${link(105)}) → [106 成本](${link(106)}) → [107 OFI](${link(107)}) → [108 冲击](${link(108)}) 学习；逐股手算ES=RS+PI与多档均价，标出成交方向、基准和单位。第二周按 [109 队列](${link(109)}) → [110 点过程](${link(110)}) → [111 价格发现](${link(111)}) → [112 案例四](${link(112)}) 练习。

交付601行盘口测量、500笔滚动预测、OFI六类分支与未来后缀不变性结果；说明同期解释与未来预测的差别。Hawkes与价格发现是正文建模主线，本次脚本不拟合这些完整模型。

## 高频交易 两周

先修：97至104系统与105至110微观结构。第一周读 [113 时间线](${link(113)})、[114 信号衰减](${link(114)})、[115 库存报价](${link(115)})、[116 条件成交](${link(116)})，画出事件、接收、决定、到达、成交与回报六个时点，核对半衰期和费用单位。

第二周读 [117 双腿](${link(117)})、[118 回放](${link(118)})、[119 性能](${link(119)})、[120 案例五](${link(120)})。交付四组同源延迟情景，逐事件解释前方量、剩余量、迟到回报与现金；对比触价全填假设。逻辑案例不要求安装低延迟依赖，也不提供实测网关性能。

## 统计套利 三周

先修：51 OU、61至74研究验证、75至80优化、85协整与90正则。第一周读 [121 假设](${link(121)})、[122 形成](${link(122)})、[123 半衰期](${link(123)})，区分价格残差、收益残差、协整、相关和美元/beta中性。

第二周读 [124 PCA](${link(124)})、[125 状态机](${link(125)})、[126 验证](${link(126)})、[127 账务风险](${link(127)})，手算两腿-554分往返例子，写出冻结入场关系与跨折处理规则。第三周运行 [128 案例六](${link(128)})，提交7次形成、700行信号、下一观测成交和701期账本，核对零/基础/双倍成本及期末平仓。

## 三个新增案例的验收清单

| 案例 | 必须说明的边界 | 必须复算的证据 |
| --- | --- | --- |
| 盘口测量 | 外生L1状态，不重建逐订单或产生自己的成交 | 六分支OFI、596笔共同后验样本的价差恒等式 |
| FIFO延迟 | 单显示价、确定路径、非概率估计 | 4/4/2/4股、迟到回报去重、-14/-7分终点盯市 |
| 配对研究 | 合成关系、无正式协整检验、无保证金模型 | 形成截止、下一观测成交、费用与现金恒等式 |

按 [案例详解](MARKET_RESEARCH_CASES.md) 运行，不以盈利作为通过条件。继续扩展时，每增加真实数据、参数搜索或执行机制，都补上相应时间与账务证据。
`);
 emit('docs/RESEARCH_CASES.md',outputs.get('docs/RESEARCH_CASES.md')+`
## 案例四至六 盘口 延迟与配对

新增 [第112讲](${link(112)})、[第120讲](${link(120)})、[第128讲](${link(128)}) 共用另一份标准库脚本 [market_cases.py](../examples/market_cases.py)。[完整实验协议与结果](MARKET_RESEARCH_CASES.md) · [JSON](../data/market-results.json)。8份CSV位于examples/market_output，与前面6份CSV分目录保留。

| 案例 | 核心输出 | 入口 |
| --- | --- | --- |
| 四 盘口与成本 | 601个状态、500笔预测、价差与OFI | [案例四](MARKET_RESEARCH_CASES.md#case-4) |
| 五 FIFO与延迟 | 四情景、队列事件与本地回报 | [案例五](MARKET_RESEARCH_CASES.md#case-5) |
| 六 配对与现金 | 7次形成、700行信号、701行账本 | [案例六](MARKET_RESEARCH_CASES.md#case-6) |

六个案例共用本地离线播放器的研究筛选入口；每讲的“运行本研究案例”提供对应命令、源码、JSON和CSV链接。
`);
 emit('docs/MARKET_CHEATSHEET.md',banner+`# 盘口 高频交易与统计套利速查

下表使用与正文相同的方向、期限和单位。价格分解是测量，成交账本才记录真实资金；合成实验不替代真实执行证据。

| 主题 | 公式或不变量 | 例子与入口 |
| --- | --- | --- |
| 中价与报价价差 | m=(a+b)/2；s=a-b | 99/101得100与2；[105](${link(105)}) |
| 主动方向 | d=+1主动买，-1主动卖 | 不把maker方向直接填入；[106](${link(106)}) |
| 价差分解 | ES=2d(p-m)；RS=2d(p-m_h)；PI=2d(m_h-m) | ES=RS+PI；p101、m100、m_h102得2=-2+4；[106](${link(106)}) |
| 主动方markout | d(m_h-p) | 上例+1，不含费用；被动方向相反 |
| 数量不平衡 | I=(B-A)/(B+A) | 300/100得.5；[107](${link(107)}) |
| 加权中价 | w=(aB+bA)/(A+B)=m+sI/2 | 99/101、300/100得100.5；不是完整条件微价格 |
| OFI买侧 | 1[b1≥b0]B1-1[b1≤b0]B0 | 99量100→100量50得+50；[107](${link(107)}) |
| OFI卖侧 | -1[a1≤a0]A1+1[a1≥a0]A0 | 101量100→100量50得-50 |
| 单步FIFO | fill=min(Qo,max(M-Qa,0)) | Qa5、Qo4、M8得3；[109](${link(109)}) |
| Poisson到达 | P(NΔ≥1)=1-exp(-λΔ) | λ.2/ms、Δ5ms得.6321；[110](${link(110)}) |
| Hawkes核 | g(u)=αexp(-βu)，n=α/β | μ2、α3、β5得n.6、均值5/s；正核稳定等条件需成立 |
| 信号衰减 | A(L)=A0×2^(-L/H) | 4bps、H2ms、L4ms得1bps；[114](${link(114)}) |
| 库存保留价格 | r=s-qγσ²τ | 100-2×.1×.04=99.992；[115](${link(115)}) |
| 到达强度 | λ(δ)=Aexp(-kδ) | 10×exp(-2×.5)=3.6788/s；不是市场总消息速率 |
| 在途与撤单 | 到达前不排队；撤单到达前仍可成交 | 回报迟到不改变事实；[120](${link(120)}) |
| 价格残差 | e=Y-a-βX；z=(e-μ形成)/σ形成 | 164-10-1.5×100=4，σ2得z2；[122](${link(122)}) |
| 残差半衰期 | H=ln(.5)/lnφ；0<φ<1 | φ.9得6.5788个采样间隔；[123](${link(123)}) |
| OU映射 | κ=-lnφ/Δ | 不对负φ机械取实数对数 |
| 因子暴露 | Bᵀw须对最终实际权重检查 | 美元净零不自动beta净零；[124](${link(124)}) |
| 现金与权益 | ΔC=-ΣΔh×p_exec-费用-持有扣款；E=C+Σh×p_mark | 短卖增加现金但受融资规则；[127](${link(127)}) |
| 成交时间 | fill_time=decision_time+1 | 本案例下一观测协议，不是现实成交承诺；[128](${link(128)}) |

[运行与逐行证据](MARKET_RESEARCH_CASES.md) · [原进阶公式](ADVANCED_CHEATSHEET.md) · [时间序列与机器学习公式](RESEARCH_CHEATSHEET.md)
`);
 emit('docs/MARKET_RESEARCH_CASES.md',banner+`# 盘口 高频交易与统计套利研究案例

第112、120、128讲的三项研究均为Python 3.10+标准库实现。固定种子合成L1与双腿价格，加上预设FIFO路径，无下载与外部交易。每项保留原始CSV、时点与状态检查，正文解释模型机制及失效边界。

在项目根目录运行：

~~~sh
python examples/market_cases.py --output data/market-results.json
node scripts/build.mjs
node scripts/check.mjs
~~~

[源码](../examples/market_cases.py) · [计算结果JSON](../data/market-results.json) · [六个案例总览](RESEARCH_CASES.md) · [公式与状态速查](MARKET_CHEATSHEET.md)

脚本支持--artifacts-dir，默认CSV保存examples/market_output，构建与校验读取此默认目录。结果不写墙钟时间，同一运行时重跑可逐字比较；跨实现浮点末位差异不代表金融差异。

<a id="case-4"></a>

## 案例四 盘口状态 测量与滚动预测

种子${m.seed}，${m.quotes}个L1状态，初始中价10000分，价差固定2分，买卖显示量各在20至180股随机生成。已知合成主动方向，成交价为相应买/卖档；成交用于测量，不消耗队列后生成下一状态。这是外生快照实验，不重建逐订单或隐藏流动性。

令当前I=(B-A)/(B+A)，下一事件上移1分概率.25+.2I、下移1分概率.25-.2I、其余不变，因此植入条件均值.4I分。模型不读取该系数。每个起点t从100开始，只用最多200个已完成转移拟合Δm对I的线性关系，fit_last_label_time=t，target_end=t+1，共${m.predictions}笔。

| 下一事件预测 | MSE 分² |
| --- | --- |
| 历史拟合不平衡 | ${f(m.mse_next_mid_cents_squared.prediction)} |
| 零变化 | ${f(m.mse_next_mid_cents_squared.zero)} |
| 加权中价相对中价偏离 | ${f(m.mse_next_mid_cents_squared.proxy)} |

加权代理=w-m=I分，并非这个生成机制的.4I分；盘口范围内的合理代理也可能预测过度。MSE是中价任务误差，没有跨价差、排队、手续费或策略净值，不能把较低MSE称为交易利润。

对每笔成交计算ES=2d(p-m)、RS=2d(p-m_h)、PI=2d(m_h-m)，h=${m.markout_horizon_events}个后续状态。共同可评分样本${m.scored_trades}笔，ES均值${f(m.average_effective_spread_cents)}分，RS均值${f(m.average_realized_spread_cents)}分，PI均值${f(m.average_impact_cents)}分，逐笔及相同权重平均都满足ES=RS+PI。末尾5笔未来字段留空，不填0，也不计入这些后验均值。

[micro_quotes.csv](../examples/market_output/micro_quotes.csv) 保存601个状态、I、OFI和成本分解；OFI是端点状态测量，不等于从快照唯一恢复所有中间事件。[micro_forecasts.csv](../examples/market_output/micro_forecasts.csv) 保存500笔滚动系数、截止与预测。

独立核验：同价买量增30和卖量减30均贡献+30；买价上/下移、卖价上/下移共四个分支各手算；加权中价保持在买卖价之间。把350之后的未来状态改坏，不改变截至350的预测与拟合。末尾缺失后验、方向定义和单位均随CSV保留。

延伸实验先固定价差、深度、噪声或信号情景，再运行；要评价自己订单的成交，必须另外建模排队与到达。

<a id="case-5"></a>

## 案例五 FIFO 新增延迟与撤单延迟

一个显示买价10000分，本单4股。外部订单A在0时挂5股，3时主动卖4，B在4时挂3，5时取消A剩1，7时卖2，9时卖3，11时卖5。本单在2或6到达，本地8时请求取消，撤单到场所需2或5个教学时间单位。场所同价严格FIFO；相同时刻按预设插入序，本组参数没有并列到达争议。

| 情景 | 到达延迟 | 撤单延迟 | 实际股数 | 费用 分 | 期末现金 分 | 期末中价盯市损益 分 |
| --- | --- | --- | --- | --- | --- | --- |
${h.scenarios.map(s=>`| ${s.scenario} | ${s.order_latency} | ${s.cancel_latency} | ${s.filled} | ${s.fees_cents} | ${s.final_cash_cents} | ${s.terminal_marked_pnl_cents} |`).join('\n')}

快单排在B前，7和9各成交2股；慢单排在B后，9时才成交2股。快撤10生效能撤慢单剩余2股，慢撤13才生效则11时继续成交。价格始终可触及本单档，不代表自己必然一开始全部成交；简单触价全填为4股，而慢单快撤只有2股。

每笔非零本单执行费1分，初始现金100000分；终点统一中价9997分，未额外在市场平仓。4股的终点损益为4×(-3)-2=-14分，2股为2×(-3)-1=-7分。它说明成交数量与净收益不是同一目标，不证明较慢执行普遍更好。

场所成交回报延迟3，取消结果无额外传输延迟。慢单快撤9时的成交在12才收到，10时先收到取消结果；它仍须计仓位和现金。已全部成交后取消返回cancel_no_working_order，实际撤掉剩余才返回cancelled。收到取消结果不清空已有持仓。首个fill故意重复回报一次，现金、股数和手续费只处理一次。

[queue_events.csv](../examples/market_output/queue_events.csv) 是场所队列、前方量、剩余量与累计成交；[queue_reports.csv](../examples/market_output/queue_reports.csv) 是本地接收顺序、去重标志、现金与股数。after_cancel表示已经收到取消处理结果，包括无工作订单结果，并不声称每次都撤掉了量。预设请求不读取场所真状态作实时策略决策。

校验逐事件数量守恒、到达前无fill、取消只到场所生效、迟到事实入账、重复幂等、两次回放一致。只改变11时未来主动量，9及之前场所状态不变。四情景共享同一条路径，不是独立样本，不能拿来计算延迟收益显著性。隐藏量、多档穿价、交易更正与自身行为反馈未实现。

<a id="case-6"></a>

## 案例六 配对形成 下一观测成交与现金账

种子${p.seed}，${p.observations}点价格，X以整数分随机游走，Y=1000+1.5X+e后取整；e下一期=.9e+N(0,25²)。关系是受控植入，模型只读取数据。从起点200起，每100点用前200个水平价格拟合Y=a+βX，均值尺度也在同一形成期计算。共${p.models}次形成，fit_last=origin-1；本脚本没有正式协整检验，输出formal_cointegration_test=false，不生成p值。

空仓时|z|>2开相反方向价差，持有时|z|<.5或已过20个观测间隔提出退出。Y腿±10股，X腿=-round(β×Y股数)。开仓后冻结入场模型和整数股数，退出也使用该模型z；新折模型供下一次空仓开仓使用。最后一个决策时点停止开仓并发零目标，最后观测统一清仓。

时间顺序：先对上一持仓期间计算借券扣款和中价变动，再执行上个时点发来的订单，当前完成价格才用于本次信号。每笔fill_time=decision_time+1；下一观测中价只是成交模型基准，再按买+滑点、卖-滑点执行，不能用当前信号价回填成交。

初始现金${p.base.initial_cash_cents}分。基础成本：每股每边滑点1分，每条非零腿成交费1分，上一期短头寸名义每期1bp借券、向上取整到分。观测期未赋真实日历，不年化，也不提供真实借券报价；短卖所得可用于账本但未建保证金、利息和所得限制。

| 成本情景 | 价格毛损益 分 | 费用 分 | 滑点 分 | 借券 分 | 最终现金 分 | 初始资本收益 |
| --- | --- | --- | --- | --- | --- | --- |
${[['零成本',p.no_cost],['基础',p.base],['双倍单位成本',p.stress]].map(([name,s])=>`| ${name} | ${s.price_pnl_cents} | ${s.fees_cents} | ${s.slippage_cents} | ${s.borrow_cents} | ${s.final_cash_cents} | ${pct(s.return_on_initial_cash)} |`).join('\n')}

同一信号路径，价格毛损益保持相同，基础${p.base.entries}次开仓、${p.base.fills}笔腿成交。借券逐期向上取整，双倍费率的总扣款未必恰好两倍；净值下降按真实扣款核对。以上是给定合成过程与执行假设的计算，无真实市场策略业绩含义。

每期精确核对E_t-E_初始=累计持仓中价损益-手续费-滑点-借券，其中E=C+hX×X+hY×Y。独立手算长10Y、短15X，两腿各涨1元、每股每边滑点.01、4笔各费.01，未含借券净损益=-554分。期末股数0，最终现金等于权益。

| 文件 | 记录与核验 |
| --- | --- |
| [pairs_models.csv](../examples/market_output/pairs_models.csv) | 7次形成的a、β、尺度、φ与合法半衰期；φ不在(0,1)时半衰期留空 |
| [pairs_signals.csv](../examples/market_output/pairs_signals.csv) | 700行当前z、使用模型、实际股数与下一时点目标 |
| [pairs_trades.csv](../examples/market_output/pairs_trades.csv) | 每条腿决策与成交时刻、数量、执行价与费用 |
| [pairs_ledger.csv](../examples/market_output/pairs_ledger.csv) | 701期现金、股数、权益与逐项累计成本 |

改变600起两腿未来价格，600之前信号与账本逐行不变；形成只用过去，持仓模型冻结，所有成交在决定后一期，期末真实清仓。PCA、真实协整检验、单腿失败、借券权限、保证金和冲击可作为新的明确实验扩展，不能把未实现机制写成已验证功能。

## 复现与维护

三个案例共8份CSV，JSON同时记录脚本与CSV的SHA-256。修改脚本后先重跑再构建；校验检查生成文档同步、摘要、全部不变量以及从CSV独立复算的MSE、价差与现金恒等式。通过条件是时间、方向、数量与账本正确，不要求每个随机种子或每条路径盈利。
`);
}
