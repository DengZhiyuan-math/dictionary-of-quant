"""Market microstructure, FIFO latency and pairs-trading teaching labs.

Python 3.10+, standard library, no network. Run from the project root:
  python examples/market_cases.py --output data/market-results.json
Prices and cash use integer cents unless a statistic explicitly says otherwise.
Synthetic data and scripted FIFO events do not estimate real fill probabilities.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import random
from statistics import fmean

ROOT = Path(__file__).resolve().parents[1]


def write_csv(folder, name, rows):
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / name).open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def linear_fit(xs, ys):
    xm, ym = fmean(xs), fmean(ys)
    denominator = sum((x - xm)**2 for x in xs)
    if denominator < 1e-12:
        raise ValueError('Teaching design has no regressor variation')
    slope = sum((x - xm) * (y - ym) for x, y in zip(xs, ys)) / denominator
    return ym - slope * xm, slope


def ofi(old, new):
    b0, a0, qb0, qa0 = (old[k] for k in ('bid', 'ask', 'bid_qty', 'ask_qty'))
    b1, a1, qb1, qa1 = (new[k] for k in ('bid', 'ask', 'bid_qty', 'ask_qty'))
    return ((b1 >= b0) * qb1 - (b1 <= b0) * qb0
            - (a1 <= a0) * qa1 + (a1 >= a0) * qa0)


def quote_forecasts(quotes):
    rows = []
    for t in range(100, len(quotes) - 1):
        start = max(0, t - 200)
        xs = [q['imbalance'] for q in quotes[start:t]]
        ys = [quotes[j + 1]['mid'] - quotes[j]['mid'] for j in range(start, t)]
        intercept, slope = linear_fit(xs, ys)
        rows.append(dict(origin=t, fit_last_label_time=t, target_end=t + 1,
                         imbalance=quotes[t]['imbalance'], intercept=intercept, slope=slope,
                         prediction=intercept + slope * quotes[t]['imbalance'],
                         zero=0., proxy=quotes[t]['weighted_mid'] - quotes[t]['mid'],
                         actual=quotes[t + 1]['mid'] - quotes[t]['mid']))
    return rows


def microstructure_case(folder):
    rng, mid, quotes = random.Random(112), 10000, []
    for t in range(601):
        qb, qa = rng.randint(20, 180), rng.randint(20, 180)
        imbalance = (qb - qa) / (qb + qa)
        direction = rng.choice((-1, 1))  # Known synthetic aggressor sign.
        bid, ask = mid - 1, mid + 1
        quotes.append(dict(t=t, bid=bid, ask=ask, mid=mid, bid_qty=qb, ask_qty=qa,
                           imbalance=imbalance, weighted_mid=(ask * qb + bid * qa) / (qb + qa),
                           direction=direction, trade_price=ask if direction == 1 else bid))
        u = rng.random()
        # Deliberately planted weak next-event relation; not an empirical market claim.
        mid += 1 if u < .25 + .2 * imbalance else -1 if u > .75 + .2 * imbalance else 0
    metrics = []
    for t, quote in enumerate(quotes):
        d, p, m = quote['direction'], quote['trade_price'], quote['mid']
        row = dict(**quote, ofi=ofi(quotes[t - 1], quote) if t else 0,
                   quoted_spread=quote['ask'] - quote['bid'], effective_spread=2 * d * (p - m),
                   future_mid_5='', realized_spread_5='', price_impact_5='', taker_markout_5='')
        if t + 5 < len(quotes):
            future = quotes[t + 5]['mid']
            row.update(future_mid_5=future, realized_spread_5=2*d*(p-future),
                       price_impact_5=2*d*(future-m), taker_markout_5=d*(future-p))
            assert row['effective_spread'] == row['realized_spread_5'] + row['price_impact_5']
        assert quote['bid'] <= quote['weighted_mid'] <= quote['ask']
        metrics.append(row)
    predictions = quote_forecasts(quotes)
    changed = [q.copy() for q in quotes]
    for q in changed[351:]:
        for key in ('bid', 'ask', 'mid', 'weighted_mid'):
            q[key] += 1000
        q['imbalance'] *= -1
    altered = quote_forecasts(changed)
    keys = ('origin', 'fit_last_label_time', 'intercept', 'slope', 'prediction', 'proxy')
    assert all(all(a[k] == b[k] for k in keys) for a, b in zip(predictions, altered) if a['origin'] <= 350)
    base = dict(bid=99, ask=101, bid_qty=100, ask_qty=100)
    assert ofi(base, {**base, 'bid_qty':130}) == 30
    assert ofi(base, {**base, 'ask_qty':70}) == 30
    assert ofi(base, {**base, 'bid':100, 'bid_qty':50}) == 50
    assert ofi(base, {**base, 'bid':98, 'bid_qty':50}) == -100
    assert ofi(base, {**base, 'ask':100, 'ask_qty':50}) == -50
    assert ofi(base, {**base, 'ask':102, 'ask_qty':50}) == 100
    assert math.isclose((101 * 300 + 99 * 100) / 400, 100.5)
    mse = {key: fmean((r['actual'] - r[key])**2 for r in predictions)
           for key in ('prediction', 'zero', 'proxy')}
    scored = [r for r in metrics if r['future_mid_5'] != '']
    write_csv(folder, 'micro_quotes.csv', metrics)
    write_csv(folder, 'micro_forecasts.csv', predictions)
    return dict(seed=112, quotes=len(quotes), predictions=len(predictions), markout_horizon_events=5,
                scored_trades=len(scored), units='prices/spreads in cents; quantities in shares',
                mse_next_mid_cents_squared=mse, average_effective_spread_cents=fmean(r['effective_spread'] for r in scored),
                average_realized_spread_cents=fmean(r['realized_spread_5'] for r in scored),
                average_impact_cents=fmean(r['price_impact_5'] for r in scored),
                checks=dict(spread_identity=True, weighted_mid_bounds=True, ofi_six_branches=True,
                            future_prefix_invariance=True, known_trade_signs=True))


def queue_run(order_latency, cancel_latency, later_market_size=5):
    """One displayed FIFO bid price. External orders are identified, not inferred.

    Our order is 4 shares at 10000 cents. Market sells consume from the head.
    Cancel is requested locally at 8 and acts only at venue arrival. Equal-time
    events are ordered by insertion index; the chosen scenarios avoid such ties.
    Fill reports arrive 3 time units later, cancel outcomes with no extra delay.
    """
    events = [(0, 'add', 'A', 5), (order_latency, 'add', 'OWN', 4),
              (3, 'market', '', 4), (4, 'add', 'B', 3), (5, 'cancel', 'A', 1),
              (7, 'market', '', 2), (8, 'request_cancel', 'OWN', 0),
              (9, 'market', '', 3), (8 + cancel_latency, 'cancel', 'OWN', 0),
              (11, 'market', '', later_market_size)]
    events = sorted(enumerate(events), key=lambda item:(item[1][0], item[0]))
    queue, rows, messages, filled, serial = [], [], [], 0, 0
    for _, (time, kind, oid, qty) in events:
        before = sum(order[1] for order in queue)
        removed = 0
        matched = 0
        if kind == 'add':
            queue.append([oid, qty])
        elif kind == 'market':
            remaining = qty
            while remaining and queue:
                head = queue[0]
                take = min(remaining, head[1])
                head[1] -= take
                remaining -= take
                matched += take
                if head[0] == 'OWN':
                    filled += take
                    serial += 1
                    messages.append(dict(time=time+3, venue_time=time, kind='fill',
                                         eid='E'+str(serial), quantity=take, price=10000, fee=1))
                if head[1] == 0:
                    queue.pop(0)
        elif kind == 'cancel':
            found = next((i for i, order in enumerate(queue) if order[0] == oid), None)
            if found is not None:
                removed = queue[found][1] if oid == 'OWN' else min(qty, queue[found][1])
                queue[found][1] -= removed
                if queue[found][1] == 0:
                    queue.pop(found)
            if oid == 'OWN':
                messages.append(dict(time=time, venue_time=time,
                                     kind='cancelled' if found is not None else 'cancel_no_working_order',
                                     eid='', quantity=0, price=0, fee=0))
        expected = before + (qty if kind == 'add' else 0) - matched - removed
        assert sum(order[1] for order in queue) == expected
        assert all(order[1] > 0 for order in queue)
        own_index = next((i for i, order in enumerate(queue) if order[0] == 'OWN'), None)
        ahead = sum(order[1] for order in queue[:own_index]) if own_index is not None else 0
        rows.append(dict(time=time, event=kind, oid=oid, quantity=qty, market_matched=matched,
                         queue=';'.join(f'{k}:{v}' for k,v in queue), ahead=ahead,
                         own_remaining=queue[own_index][1] if own_index is not None else 0,
                         venue_filled=filled))
    # Demonstrate a duplicate report independently of venue matching.
    first = next(m for m in messages if m['kind'] == 'fill')
    messages.append({**first, 'time':first['time']+1})
    messages.sort(key=lambda m:m['time'])
    cash, position, fees, seen, report_rows, cancelled, duplicates = 100000, 0, 0, {}, [], False, 0
    for message in messages:
        duplicate = False
        if message['kind'] == 'fill':
            payload = tuple(message[k] for k in ('quantity','price','fee','venue_time'))
            if message['eid'] in seen:
                assert seen[message['eid']] == payload
                duplicates += 1
                duplicate = True
            else:
                seen[message['eid']] = payload
                position += message['quantity']
                cash -= message['quantity'] * message['price'] + message['fee']
                fees += message['fee']
        else:
            cancelled = True
        report_rows.append(dict(**message, duplicate=duplicate, after_cancel=cancelled,
                                position=position, cash_cents=cash))
    assert position == filled and filled <= 4
    assert all(r['venue_filled'] == 0 for r in rows if r['time'] < order_latency)
    assert cash == 100000 - 10000*filled - fees
    summary = dict(order_latency=order_latency, cancel_latency=cancel_latency,
                   filled=filled, fees_cents=fees, final_position=position, final_cash_cents=cash,
                   terminal_mid_cents=9997, terminal_marked_pnl_cents=cash+position*9997-100000,
                   duplicate_reports=duplicates,
                   fill_received_after_cancel=any(m['kind']=='fill' and m['after_cancel'] and not m['duplicate'] for m in report_rows))
    return summary, rows, report_rows


def high_frequency_case(folder):
    summaries, event_rows, report_rows = [], [], []
    for ol, cl in ((2,2),(2,5),(6,2),(6,5)):
        summary, rows, reports = queue_run(ol,cl)
        scenario = f'order{ol}_cancel{cl}'
        summaries.append(dict(scenario=scenario, **summary))
        event_rows += [dict(scenario=scenario, **r) for r in rows]
        report_rows += [dict(scenario=scenario, **r) for r in reports]
        assert queue_run(ol,cl) == (summary, rows, reports)
        altered = queue_run(ol,cl,later_market_size=50)[1]
        assert [r for r in rows if r['time']<=9] == [r for r in altered if r['time']<=9]
    assert [s['filled'] for s in summaries] == [4,4,2,4]
    assert summaries[2]['fill_received_after_cancel']
    assert all(s['terminal_marked_pnl_cents'] == -3*s['filled']-s['fees_cents'] for s in summaries)
    write_csv(folder, 'queue_events.csv', event_rows)
    write_csv(folder, 'queue_reports.csv', report_rows)
    return dict(scenarios=summaries, price_cents=10000, order_quantity=4, final_mid_cents=9997,
                report_delay=3, local_cancel_time=8, touch_fill_assumption=4,
                checks=dict(fifo_conservation=True, no_fill_before_arrival=True,
                            cancel_only_at_venue=True, late_reports_accounted=True,
                            duplicate_reports=True, prefix_invariance=True,
                            deterministic_replay=True, touch_is_not_fill=True))


def fit_pair(prices, origin, window=200):
    history = prices[origin-window:origin]
    a, beta = linear_fit([p[0] for p in history], [p[1] for p in history])
    residuals = [y-a-beta*x for x,y in history]
    mean = fmean(residuals)
    scale = math.sqrt(fmean((v-mean)**2 for v in residuals))
    intercept, phi = linear_fit(residuals[:-1], residuals[1:])
    return dict(origin=origin, fit_first=origin-window, fit_last=origin-1,
                intercept=a, beta=beta, residual_mean=mean, residual_sd=scale,
                ar_intercept=intercept, ar_phi=phi,
                half_life_events=-math.log(2)/math.log(phi) if 0<phi<1 else '')


def pair_run(prices, slippage=1, fee=1, borrow_bps=1):
    initial, cash, hx, hy = 1000000, 1000000, 0, 0
    pending, active, entry_time, model = None, None, None, None
    models, signals, ledger, trades = [], [], [], []
    fees, slips, borrow, price_pnl = 0, 0, 0, 0
    for t in range(200, len(prices)):
        x,y = prices[t]
        if t > 200:
            px,py = prices[t-1]
            price_pnl += hx*(x-px)+hy*(y-py)
            charge = math.ceil((max(-hx,0)*px + max(-hy,0)*py)*borrow_bps/10000)
            cash -= charge
            borrow += charge
        forced = t == len(prices)-1
        if forced:
            pending = dict(decision_time=t-1, x=0, y=0, reason='scheduled_final_close', model=None)
        if pending:
            for symbol,current,target,mid in (('X',hx,pending['x'],x),('Y',hy,pending['y'],y)):
                change = target-current
                if change:
                    execution = mid + slippage*(1 if change>0 else -1)
                    cash -= change*execution + fee
                    fees += fee
                    slips += abs(change)*slippage
                    trades.append(dict(decision_time=pending['decision_time'], fill_time=t,
                                       symbol=symbol, delta_quantity=change, mid_cents=mid,
                                       execution_cents=execution, fee_cents=fee,
                                       slippage_cents=abs(change)*slippage, reason=pending['reason']))
            hx,hy = pending['x'],pending['y']
            if hx or hy:
                active,entry_time = pending['model'],t
            else:
                active,entry_time = None,None
            pending = None
        equity = cash+hx*x+hy*y
        assert equity-initial == price_pnl-fees-slips-borrow
        ledger.append(dict(time=t, x_cents=x,y_cents=y,x_shares=hx,y_shares=hy,
                           cash_cents=cash,equity_cents=equity,price_pnl_cents=price_pnl,
                           fees_cents=fees,slippage_cents=slips,borrow_cents=borrow))
        if forced:
            break
        if (t-200)%100 == 0:
            model=fit_pair(prices,t)
            models.append(model)
        used = active or model
        z=(y-used['intercept']-used['beta']*x-used['residual_mean'])/used['residual_sd']
        reason='hold' if hy else 'flat'
        target_x,target_y=hx,hy
        if t == len(prices)-2:
            target_x,target_y=0,0
            reason='scheduled_final_close' if hy else 'flat'
        elif hy:
            if abs(z)<.5 or t-entry_time>=20:
                target_x,target_y=0,0
                reason='mean_exit' if abs(z)<.5 else 'time_exit'
        elif abs(z)>2:
            # Integer-share linear PRICE hedge, not log-price elasticity.
            target_y=-10 if z>0 else 10
            target_x=-round(used['beta']*target_y)
            reason='entry'
        if (target_x,target_y)!=(hx,hy):
            pending=dict(decision_time=t,x=target_x,y=target_y,reason=reason,
                         model=used if target_y else None)
        signals.append(dict(time=t,model_origin=used['origin'],fit_last=used['fit_last'],
                            z=z,x_shares=hx,y_shares=hy,target_x=target_x,target_y=target_y,reason=reason))
    assert hx==hy==0 and all(row['decision_time']+1==row['fill_time'] for row in trades)
    return dict(initial_cash_cents=initial,final_cash_cents=cash,pnl_cents=cash-initial,
                return_on_initial_cash=(cash-initial)/initial,price_pnl_cents=price_pnl,
                fees_cents=fees,slippage_cents=slips,borrow_cents=borrow,
                entries=sum(s['reason']=='entry' for s in signals),fills=len(trades),
                slippage_per_share_cents=slippage,fee_per_leg_fill_cents=fee,borrow_bps_per_period=borrow_bps), signals,ledger,trades,models


def statistical_arbitrage_case(folder):
    rng,x,e,prices = random.Random(128),10000,0.,[]
    for _ in range(901):
        prices.append((x,round(1000+1.5*x+e)))
        x += rng.randint(-60,60)
        e=.9*e+rng.gauss(0,25)
    result,signals,ledger,trades,models=pair_run(prices)
    no_cost=pair_run(prices,0,0,0)[0]
    stressed=pair_run(prices,2,2,2)[0]
    changed=prices[:600]+[(x+1000,y-1000) for x,y in prices[600:]]
    altered=pair_run(changed)
    assert [r for r in signals if r['time']<600] == [r for r in altered[1] if r['time']<600]
    assert [r for r in ledger if r['time']<600] == [r for r in altered[2] if r['time']<600]
    assert result['price_pnl_cents']==no_cost['price_pnl_cents']==stressed['price_pnl_cents']
    assert stressed['pnl_cents']<=result['pnl_cents']<=no_cost['pnl_cents']
    assert all(r['fit_last']<r['time'] for r in signals)
    assert len(signals)==700 and len(ledger)==701 and len(models)==7
    # Independent two-leg round-trip hand example, excluding borrow.
    assert 10*(16100-16000)-15*(10100-10000)-2*(10+15)-4 == -554
    assert math.isclose(math.log(.5)/math.log(.9),6.578813478960585)
    write_csv(folder,'pairs_signals.csv',signals)
    write_csv(folder,'pairs_ledger.csv',ledger)
    write_csv(folder,'pairs_trades.csv',trades)
    write_csv(folder,'pairs_models.csv',models)
    return dict(seed=128,observations=901,formation_window=200,refit_every=100,
                signal_rows=len(signals),ledger_rows=len(ledger),models=len(models),
                entry_z=2,exit_z=.5,max_elapsed_before_exit_decision=20,
                formal_cointegration_test=False,
                base=result,no_cost=no_cost,stress=stressed,
                checks=dict(future_prefix_invariance=True,fit_strictly_past=True,
                            next_observation_execution=True,integer_cash_identity=True,
                            frozen_entry_hedge=True,final_liquidation=True,
                            cost_monotonicity=True,round_trip_hand_calculation=True))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'data/market-results.json')
    parser.add_argument('--artifacts-dir',type=Path,default=ROOT/'examples/market_output')
    args=parser.parse_args()
    result=dict(schema_version=1,data='fixed-seed synthetic L1/prices and scripted FIFO events',
                source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                microstructure=microstructure_case(args.artifacts_dir),
                high_frequency=high_frequency_case(args.artifacts_dir),
                statistical_arbitrage=statistical_arbitrage_case(args.artifacts_dir))
    names=['micro_quotes.csv','micro_forecasts.csv','queue_events.csv','queue_reports.csv',
           'pairs_signals.csv','pairs_ledger.csv','pairs_trades.csv','pairs_models.csv']
    result['artifacts']=[dict(name=name,sha256=hashlib.sha256((args.artifacts_dir/name).read_bytes()).hexdigest()) for name in names]
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('PASS: spread/OFI, causal forecasts, FIFO latency, delayed reports, next-event pairs ledger and cost stress')
    print('Wrote',args.output,'and',len(names),'CSV artifacts')


if __name__=='__main__':
    main()
