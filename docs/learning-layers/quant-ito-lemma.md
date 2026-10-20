# Itô 引理

概念编号：`concept:quant-ito-lemma` · [网站双语阅读](https://zhiyuan-deng.pages.dev/dictionary/topic/concept/quant-ito-lemma/)

## 第一层：概念入门 · 知其然

### 它是什么

Itô引理是随机过程的链式法则；因为布朗增量的平方不会消失，必须多保留一个二阶项。

### 先看一个例子

普通微分像直线近似，随机路径粗糙时弯曲项也累积成可见变化。

### 理解练习

随机链式法则为何保留二阶弯曲项？

<details><summary>答案与解释</summary>

布朗增量平方按时间累积，二阶项不再像普通光滑曲线那样消失。

</details>

## 第二层：深入理解 · 知其所以然

围绕推导、计算、应用与推广阅读；下面保留原有推演顺序。

### 从条件一步步推导

1. 若dX=μdt+σdW，对光滑f(t,X)作二阶展开。
2. 用(dW)²=dt的Itô记号，df=(ft+μfx+0.5σ²fxx)dt+σfxdW。

### 具体输入与计算步骤

X=W，f(X)=X²，当前X=2。

1. fx=2X=4，fxx=2。
2. df=dt+4dW。

计算结果：即d(W²)=2WdW+dt。

### 换到实际问题中应用

求几何布朗的对数。

1. dS=μSdt+σSdW，f=lnS，fx=1/S、fxx=−1/S²。
2. 代入得dlnS=(μ−σ²/2)dt+σdW。

应用结论：对数漂移低于价格漂移。

### 举一反三：改变条件后的完整解答

若σ=0会怎样？

<details><summary>变式的推演与答案</summary>

1. 二阶修正0.5σ²fxx为0。
2. dlnS=μdt。

退化回普通确定性链式法则。

</details>

### 原有解释与进一步例题


### 定义

伊藤公式是随机扩散过程的链式法则。因为布朗运动具有非零二次变差，普通微积分的一阶链式法则要增加二阶修正项。


### 参数与公式

若 $dX=\mu dt+\sigma dW$，则 $df(t,X)=(f_t+\mu f_x+\tfrac12\sigma^2f_{xx})dt+\sigma f_xdW$。fₜ、fₓ、fₓₓ 为偏导，μ、σ 为过程系数；要求相应光滑性及积分条件。


### 例子

取 f(x)=x²、X=W，则 $d(W_t^2)=2W_tdW_t+dt$。积分得到 $\int_0^T W_tdW_t=(W_T^2-T)/2$；普通积分写成 W_T²/2 会漏掉 T/2。取期望还可核对 E[W_T²]=T。


### 适用边界与常见误解

二阶修正来自二次变差。

### 推导与方法参考

- [一手资料](https://ocw.mit.edu/courses/15-070j-advanced-stochastic-processes-fall-2013/resources/mit15_070jf13_lec17/)

[返回分层目录](00-learning-index.md)
