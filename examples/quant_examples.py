"""Reproducible textbook calculations, Python 3.10+, standard library only.

All parameters are hypothetical. No market data or brokerage connection is used.
Run: python examples/quant_examples.py --output data/numerical-results.json
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import random
import statistics
from pathlib import Path


def norm_cdf(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2)))


def bs(s=100., k=100., r=.05, q=0., sigma=.2, t=1.):
    if s <= 0 or k <= 0 or t < 0 or sigma < 0:
        raise ValueError('S,K must be positive; T,sigma must be nonnegative')
    if t == 0:
        return {'call': max(s-k, 0.), 'put': max(k-s, 0.)}
    if sigma == 0:
        forward=s*math.exp((r-q)*t)
        return {'call': math.exp(-r*t)*max(forward-k,0.),
                'put': math.exp(-r*t)*max(k-forward,0.)}
    d1=(math.log(s/k)+(r-q+.5*sigma*sigma)*t)/(sigma*math.sqrt(t))
    d2=d1-sigma*math.sqrt(t)
    density=math.exp(-d1*d1/2)/math.sqrt(2*math.pi)
    call=s*math.exp(-q*t)*norm_cdf(d1)-k*math.exp(-r*t)*norm_cdf(d2)
    put=k*math.exp(-r*t)*norm_cdf(-d2)-s*math.exp(-q*t)*norm_cdf(-d1)
    return dict(call=call,put=put,d1=d1,d2=d2,
                delta=math.exp(-q*t)*norm_cdf(d1),
                gamma=math.exp(-q*t)*density/(s*sigma*math.sqrt(t)),
                vega=s*math.exp(-q*t)*density*math.sqrt(t))


def crr(s=100.,k=100.,r=.05,q=0.,sigma=.2,t=1.,steps=400,put=False,american=False):
    if steps < 1 or sigma <= 0 or t <= 0:
        raise ValueError('positive steps, sigma and maturity required')
    dt=t/steps
    u=math.exp(sigma*math.sqrt(dt));d=1/u
    p=(math.exp((r-q)*dt)-d)/(u-d)
    if not 0 < p < 1:
        raise ValueError('tree violates d < growth < u')
    payoff=lambda price: max(k-price,0.) if put else max(price-k,0.)
    values=[payoff(s*u**j*d**(steps-j)) for j in range(steps+1)]
    disc=math.exp(-r*dt)
    for n in range(steps-1,-1,-1):
        for j in range(n+1):
            continuation=disc*((1-p)*values[j]+p*values[j+1])
            values[j]=max(continuation,payoff(s*u**j*d**(n-j))) if american else continuation
        values.pop()
    return values[0]


def implied_vol(price,s=100.,k=100.,r=.05,q=0.,t=1.):
    if t <= 0:
        raise ValueError('IV is not identified at expiry')
    lower=max(s*math.exp(-q*t)-k*math.exp(-r*t),0.)
    upper=s*math.exp(-q*t)
    if not lower < price < upper:
        raise ValueError('price outside strict finite-IV call bounds')
    lo=0.;hi=1.
    while bs(s,k,r,q,hi,t)['call'] < price:
        hi*=2
        if hi > 32: raise ValueError('no usable finite bracket')
    for _ in range(100):
        mid=(lo+hi)/2
        if bs(s,k,r,q,mid,t)['call'] < price: lo=mid
        else: hi=mid
    return (lo+hi)/2


def mc_antithetic(pairs=20000,seed=20261016):
    rng=random.Random(seed)
    observations=[]
    for _ in range(pairs):
        z=rng.gauss(0,1)
        s1=100*math.exp(.03+.2*z)
        s2=100*math.exp(.03-.2*z)
        observations.append(math.exp(-.05)*.5*(max(s1-100,0)+max(s2-100,0)))
    mean=statistics.fmean(observations)
    se=statistics.stdev(observations)/math.sqrt(pairs)
    return dict(seed=seed,independent_pairs=pairs,terminal_payoffs=2*pairs,
                price=mean,standard_error=se,ci95=[mean-1.96*se,mean+1.96*se],
                analytic=bs()['call'])


def variance(w,a=.04,c=0.,d=.01):
    return w*w*a+2*w*(1-w)*c+(1-w)**2*d


def gmv_weight(a,c,d):
    return (d-c)/(a+d-2*c)


def meanvar_objective(w,gamma=4.):
    return .08*w+.04*(1-w)-.5*gamma*variance(w)


def soft_trade(a,w0=.5,gamma=1.,cost=.02):
    gap=a-w0
    return w0 if abs(gap)<=cost/gamma else a-math.copysign(cost/gamma,gap)


def near(a,b,tol=1e-9):
    assert abs(a-b) < tol, (a,b,tol)


def run():
    base=bs()
    near(base['call']-base['put'],100-100*math.exp(-.05))
    near(base['call'],10.450583572185565)
    near(bs(t=0)['call'],0)
    near(bs(sigma=0)['call'],100-100*math.exp(-.05))
    # Independent finite differences for derivatives, not a second copy of the formulas.
    h=.01
    delta_fd=(bs(s=100+h)['call']-bs(s=100-h)['call'])/(2*h)
    gamma_fd=(bs(s=100+h)['call']-2*base['call']+bs(s=100-h)['call'])/(h*h)
    vega_fd=(bs(sigma=.20001)['call']-bs(sigma=.19999)['call'])/.00002
    near(delta_fd,base['delta'],1e-7);near(gamma_fd,base['gamma'],1e-7)
    near(vega_fd,base['vega'],1e-6)
    price22=bs(sigma=.22)['call'];near(implied_vol(price22),.22)
    near(bs(q=.02)['call']-bs(q=.02)['put'],100*math.exp(-.02)-100*math.exp(-.05))
    # Cross-method pricing and optimal-stopping inequalities.
    tree={str(n):crr(steps=n) for n in [50,100,200,400,800]}
    near(tree['800'],base['call'],.004)
    american_call=crr(steps=400,american=True)
    near(american_call,tree['400'],1e-8)
    european_put=crr(s=70,put=True,steps=400)
    american_put=crr(s=70,put=True,american=True,steps=400)
    assert american_put >= european_put and american_put >= 30
    mc=mc_antithetic()
    assert abs(mc['price']-mc['analytic']) < 4*mc['standard_error']
    # OU exact conditional moments.
    kappa=math.log(2);dt=.5
    ou_mean=100+10*math.exp(-kappa*dt)
    ou_sd=math.sqrt(16*(1-math.exp(-2*kappa*dt))/(2*kappa))
    # Markov transitions, rank IC, account reconciliation and causal alignment.
    near(.9*.1+.1*.7,.16);near(.75*.1+.25*.7,.25)
    ranks_x=[1,2,3,4];ranks_y=[2,1,3,4]
    rank_ic=1-6*sum((x-y)**2 for x,y in zip(ranks_x,ranks_y))/(4*(4**2-1))
    near(rank_ic,.8)
    residual=[x-m for x,m in zip([1,2,3,4],[1.5,1.5,3.5,3.5])]
    near(sum(residual[:2]),0);near(sum(residual[2:]),0)
    cash=10000-10*100-2
    near(cash+10*100,9998)
    equity_before_sale=cash+10*105
    cash+=10*105-2
    near(cash,10046)
    prices=[100,110,99]
    future_return=prices[2]/prices[1]-1
    leaked_return=prices[1]/prices[0]-1
    near(future_return,-.1);near(leaked_return,.1)
    intervals=[('safe',5,7),('overlap',8,12)]
    retained=[name for name,start,end in intervals if end < 10 or start > 15]
    assert retained==['safe']
    # First-order condition plus a grid independently confirms the optimum.
    w_gmv=gmv_weight(.04,0,.01);near(w_gmv,.2)
    w_mv=.4
    grid=[i/10000 for i in range(10001)]
    numerical_max=max(grid,key=meanvar_objective)
    near(numerical_max,w_mv)
    constrained=max((w for w in grid if w<=.3),key=meanvar_objective)
    near(constrained,.3)
    for a in [.51,.60]:
        proposed=soft_trade(a)
        objective=lambda w:.5*(w-a)**2+.02*abs(w-.5)
        numerical_min=min(grid,key=objective)
        near(numerical_min,proposed)
    # Empirical CVaR: optimization over the possible break points.
    losses=[1,2,3,4,10];alpha=.8
    cvar=min(eta+sum(max(x-eta,0) for x in losses)/((1-alpha)*len(losses)) for eta in losses)
    near(cvar,10)
    turnover=abs(.3-.2)+abs(.7-.8)
    output={
        'method':'hypothetical textbook examples; Python standard library; deterministic seed',
        'source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'black_scholes':base,
        'greeks_finite_difference':dict(delta=delta_fd,gamma=gamma_fd,vega=vega_fd),
        'implied_volatility':dict(call_price_at_22pct=price22,recovered_sigma=implied_vol(price22)),
        'crr_call_convergence':tree,
        'american_exercise':dict(call=american_call,deep_put_european=european_put,deep_put_american=american_put),
        'monte_carlo':mc,
        'processes':dict(ou_half_year_mean=ou_mean,ou_half_year_sd=ou_sd,daily_vol=.2/math.sqrt(252),daily_jump_probability=1-math.exp(-2/252)),
        'factor_and_backtest':dict(rank_ic=rank_ic,industry_residuals=residual,equity_before_sale=equity_before_sale,final_cash=cash,correct_future_return=future_return,incorrect_same_interval_return=leaked_return,purged_retained=retained,family_false_positive=1-.95**20),
        'portfolio':dict(gmv_weights=[w_gmv,1-w_gmv],gmv_vol=math.sqrt(variance(w_gmv)),meanvar_weights=[w_mv,1-w_mv],constrained_weights=[constrained,1-constrained],constrained_forecast=.08*constrained+.04*(1-constrained),constrained_vol=math.sqrt(variance(constrained)),stress_loss=.3*.2+.7*.05,correlation_stress_vol=math.sqrt(variance(.3,c=.8*.2*.1)),turnover=turnover,one_time_cost=turnover*.001,unshrunk_weight=gmv_weight(.04,.019,.01),half_shrunk_weight=gmv_weight(.04,.0095,.01),risk_parity_weights=[1/3,2/3],cvar80=cvar,no_trade_small=soft_trade(.51),trade_large=soft_trade(.6)),
        'checks':'PASS: parity, boundaries, IV roundtrip, Greeks, tree convergence, exercise inequalities, MC sanity, timestamps, cash ledger, purging, optimality grid, no-trade interval and CVaR'
    }
    return output


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path)
    args=parser.parse_args();result=run()
    text=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(text,encoding='utf-8')
        print(result['checks'])
    else:print(text)
