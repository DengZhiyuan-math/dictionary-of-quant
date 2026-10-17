"""Three deterministic research labs. Python 3.10+, standard library only.

Run from the repository root:
    python examples/research_cases.py --output data/research-results.json
Synthetic data only. This module has no network or brokerage integration.
Assertions validate timing and accounting invariants, not trading profitability.
"""
from __future__ import annotations

import argparse
import csv
from dataclasses import asdict, dataclass
import hashlib
import json
import math
from pathlib import Path
import random
from statistics import fmean

ROOT = Path(__file__).resolve().parents[1]


def mse(actual, predicted):
    return fmean((y - p) ** 2 for y, p in zip(actual, predicted))


def write_csv(folder, name, rows):
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / name).open('w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def ar_forecasts(series, first=100, window=120):
    rows = []
    for t in range(first, len(series) - 1):
        start = max(0, t - window)
        xs, ys = series[start:t], series[start + 1:t + 1]
        xm, ym = fmean(xs), fmean(ys)
        denominator = sum((x - xm) ** 2 for x in xs)
        phi = sum((x - xm) * (y - ym) for x, y in zip(xs, ys)) / denominator
        intercept = ym - phi * xm
        rows.append(dict(origin=t, fit_first_transition=start,
                         fit_last_label_time=t, target_end=t + 1,
                         intercept=intercept, phi=phi, actual=series[t + 1],
                         ar=intercept + phi * series[t], last=series[t],
                         mean=fmean(series[start:t + 1])))
    return rows


def kalman(observations, q=.0001, r=.0004):
    mean, variance = 0., .001
    estimates = []
    for observation in observations:
        prior = variance + q
        gain = prior / (prior + r)
        mean += gain * (observation - mean)
        variance = (1 - gain) * prior
        estimates.append(mean)
    return estimates


def timeseries_case(folder):
    rng = random.Random(81)
    x = [0.]
    for _ in range(600):
        x.append(.8 * x[-1] + rng.gauss(0, .01))
    rows = ar_forecasts(x)
    # Alter all observations strictly after origin 350. Earlier decisions must match.
    changed = [v if i <= 350 else v + 100 for i, v in enumerate(x)]
    altered = ar_forecasts(changed)
    causal = all(all(a[k] == b[k] for k in ('ar', 'last', 'mean', 'phi', 'intercept'))
                 for a, b in zip(rows, altered) if a['origin'] <= 350)
    assert causal and len(rows) == 500
    assert all(row['fit_last_label_time'] <= row['origin'] < row['target_end'] for row in rows)
    # Match the filter's declared initial Gaussian prior as well as Q and R.
    state, latent, observed = rng.gauss(0, math.sqrt(.001)), [], []
    for _ in range(600):
        state += rng.gauss(0, .01)
        latent.append(state)
        observed.append(state + rng.gauss(0, .02))
    filtered = kalman(observed)
    altered_filter = kalman(observed[:300] + [v + 100 for v in observed[300:]])
    assert filtered[:300] == altered_filter[:300]
    # Independent hand calculations from chapters 81--87.
    assert math.isclose(1 / (1 - .8**2), 25 / 9)
    assert math.isclose(.94 * .0001 + .06 * .03**2, .000148)
    assert math.isclose(1.2 / 1.5, .8)
    write_csv(folder, 'timeseries_forecasts.csv', rows)
    write_csv(folder, 'kalman_states.csv', [dict(t=i, latent=s, observation=o, filtered=f)
              for i, (s, o, f) in enumerate(zip(latent, observed, filtered))])
    return dict(seed=81, transitions=600, forecasts=len(rows), first_origin=100,
                max_training_transitions=120,
                mse={key: mse([r['actual'] for r in rows], [r[key] for r in rows])
                     for key in ('ar', 'last', 'mean')},
                kalman=dict(q=.0001, r=.0004, initial_variance=.001,
                            observation_mse=mse(latent, observed), filtered_mse=mse(latent, filtered),
                            oracle_state_scoring='latent state is known only in this synthetic experiment'),
                checks=dict(future_suffix_invariance=causal, filter_prefix_invariance=True,
                            label_cutoffs=True, hand_calculations=True))


def solve(matrix, rhs):
    """Small dense system with partial pivoting; not a general numerical library."""
    a = [list(row) + [y] for row, y in zip(matrix, rhs)]
    n = len(a)
    for j in range(n):
        pivot = max(range(j, n), key=lambda i: abs(a[i][j]))
        a[j], a[pivot] = a[pivot], a[j]
        if abs(a[j][j]) < 1e-12:
            raise ValueError('Singular design; change the specified teaching design')
        scale = a[j][j]
        a[j] = [v / scale for v in a[j]]
        for i in range(n):
            if i != j:
                factor = a[i][j]
                a[i] = [u - factor * v for u, v in zip(a[i], a[j])]
    return [row[-1] for row in a]


def fit_ridge(features, targets, penalty):
    means = [fmean(col) for col in zip(*features)]
    scales = [math.sqrt(fmean((row[j] - mean) ** 2 for row in features)) or 1.
              for j, mean in enumerate(means)]
    design = [[1.] + [(v - m) / s for v, m, s in zip(row, means, scales)] for row in features]
    p = len(design[0])
    gram = [[sum(row[i] * row[j] for row in design) + (penalty if i == j and i > 0 else 0)
             for j in range(p)] for i in range(p)]
    rhs = [sum(row[j] * y for row, y in zip(design, targets)) for j in range(p)]
    return dict(means=means, scales=scales, coefficients=solve(gram, rhs))


def predict(model, row):
    return model['coefficients'][0] + sum(c * (x - m) / s for c, x, m, s in
        zip(model['coefficients'][1:], row, model['means'], model['scales']))


def nested_forecasts(features, targets):
    rows, folds = [], []
    candidates = (0., .1, 1., 10.)  # Sum squared error + lambda * coefficient norm squared.
    for origin in range(200, len(targets), 50):
        split = origin - 60
        scores = []
        for penalty in candidates:
            inner = fit_ridge(features[:split], targets[:split], penalty)
            score = mse(targets[split:origin], [predict(inner, r) for r in features[split:origin]])
            scores.append((score, penalty))
        _, penalty = min(scores)  # Deterministic tie break: lower lambda.
        model = fit_ridge(features[:origin], targets[:origin], penalty)
        folds.append(dict(origin=origin, inner_train_last_label_time=split,
                          validation_first_feature_time=split, validation_last_label_time=origin,
                          outer_fit_last_label_time=origin, test_end_exclusive=min(origin + 50, len(targets)),
                          penalty=penalty, validation_mse=dict((str(p), s) for s, p in scores),
                          **model))
        for t in range(origin, min(origin + 50, len(targets))):
            rows.append(dict(origin=t, fit_origin=origin, max_train_label_time=origin,
                             target_end=t + 1, actual=targets[t], prediction=predict(model, features[t]),
                             baseline=fmean(targets[:origin]), penalty=penalty))
    return rows, folds


def portfolio_path(rows, key, unit_cost):
    """Each target weight earns the NEXT period's simple return; cash earns zero.

    One-period target-weight friction convention: charge c*abs(w_t-w_previous),
    ignoring the small drift in pretrade weights. This is an explicit teaching
    approximation, not a share-level self-financing execution ledger. Final
    liquidation is charged on final equity after the last holding period.
    """
    previous, equity, gross_sum, net_sum, turnover = 0., 1., 0., 0., 0.
    path = []
    for row in rows:
        weight = max(-1., min(1., row[key] / .02))
        traded = abs(weight - previous)
        gross, cost = weight * row['actual'], unit_cost * traded
        net = gross - cost
        equity *= 1 + net
        gross_sum += gross
        net_sum += net
        turnover += traded
        path.append(dict(origin=row['origin'], weight=weight, realized_return=row['actual'],
                         gross=gross, cost=cost, net=net, equity=equity))
        previous = weight
    final_cost = unit_cost * abs(previous)
    equity *= 1 - final_cost
    net_sum -= final_cost
    turnover += abs(previous)
    return dict(gross_return_sum=gross_sum, net_return_sum=net_sum,
                compounded_net_return=equity - 1, target_weight_turnover=turnover,
                cost_return_sum=unit_cost * turnover, final_liquidation_cost=final_cost), path


def machine_learning_case(folder):
    rng = random.Random(96)
    features = [[rng.gauss(0, 1), rng.gauss(0, 1)] for _ in range(600)]
    targets = [.003 * x[0] - .002 * x[1] + rng.gauss(0, .01) for x in features]
    rows, folds = nested_forecasts(features, targets)
    # Both future features and future labels change; earlier scalers/selection/decisions stay fixed.
    changed_x = [r if i < 450 else [v + 100 for v in r] for i, r in enumerate(features)]
    changed_y = [y if i < 450 else y + 100 for i, y in enumerate(targets)]
    changed_rows, changed_folds = nested_forecasts(changed_x, changed_y)
    assert [r for r in rows if r['origin'] < 450] == [r for r in changed_rows if r['origin'] < 450]
    assert [f for f in folds if f['origin'] < 450] == [f for f in changed_folds if f['origin'] < 450]
    assert all(r['max_train_label_time'] <= r['origin'] < r['target_end'] for r in rows)
    assert len(rows) == 400 and len(folds) == 8
    # Independent solver and preprocessing checks, including unpenalized intercept.
    model = fit_ridge([[1.], [3.]], [2., 6.], 0.)
    assert model['means'] == [2.] and model['scales'] == [1.]
    assert math.isclose(predict(model, [5.]), 10.)
    intercept_only = fit_ridge([[1.], [3.]], [4., 4.], 100.)
    assert math.isclose(predict(intercept_only, [100.]), 4.)
    assert math.isclose((.8 - 1)**2, .04) and math.isclose(.011 / .03, 11 / 30)
    portfolios = {}
    for key in ('prediction', 'baseline'):
        stats, path = portfolio_path(rows, key, .0002)
        zero, _ = portfolio_path(rows, key, 0.)
        high, _ = portfolio_path(rows, key, .001)
        assert high['net_return_sum'] <= stats['net_return_sum'] <= zero['net_return_sum']
        assert math.isclose(stats['gross_return_sum'] - stats['net_return_sum'], stats['cost_return_sum'])
        portfolios[key] = stats
        write_csv(folder, 'ml_' + key + '_portfolio.csv', path)
    write_csv(folder, 'ml_forecasts.csv', rows)
    return dict(seed=96, samples=600, features=2, predictions=len(rows), folds=folds,
                unit_cost=.0002, weight_scale=.02,
                loss_definition='SSE + lambda * sum(slope**2); intercept unpenalized',
                fee_convention='target-weight change approximation; final liquidation charged separately',
                mse=dict(ridge=mse([r['actual'] for r in rows], [r['prediction'] for r in rows]),
                         historical_mean=mse([r['actual'] for r in rows], [r['baseline'] for r in rows])),
                portfolios=portfolios,
                checks=dict(future_suffix_invariance=True, train_only_scaling=True,
                            nested_selection=True, label_cutoffs=True,
                            intercept_unpenalized=True, fees_and_close=True, cost_monotonicity=True))


@dataclass
class Order:
    side: str
    quantity: int
    price: int
    filled: int = 0
    cancel_pending: bool = False
    cancelled: bool = False

    @property
    def leaves(self):
        return 0 if self.cancelled else self.quantity - self.filled


class Engine:
    """One account/instrument namespace, integer cents and shares, no matching.

    Only positive fills for known orders are supported. Trade busts/corrections,
    unknown orders, reconnect protocols and external persistence are not modeled.
    """
    def __init__(self):
        self.cash, self.position, self.limit = 100000, 0, 10
        self.orders, self.executions = {}, {}
        self.sequence, self.fresh, self.killed = 0, False, False

    def bounds(self):
        buys = sum(o.leaves for o in self.orders.values() if o.side == 'BUY')
        sells = sum(o.leaves for o in self.orders.values() if o.side == 'SELL')
        return self.position - sells, self.position + buys

    def apply(self, event):
        kind = event['kind']
        if kind == 'snapshot':
            self.sequence, self.fresh = event['sequence'], True
            return 'SNAPSHOT'
        if kind == 'delta':
            if event['sequence'] <= self.sequence:
                return 'OLD_DELTA'
            if not self.fresh or event['sequence'] != self.sequence + 1:
                self.fresh = False
                return 'DATA_GAP'
            self.sequence = event['sequence']
            return 'DELTA'
        if kind == 'kill':
            self.killed = True
            return 'KILL_SET'
        if kind == 'new':
            cid, side, qty, price = (event[k] for k in ('cid', 'side', 'quantity', 'price'))
            if cid in self.orders:
                order = self.orders[cid]
                return ('DUPLICATE_ORDER' if (order.side, order.quantity, order.price) == (side, qty, price)
                        else 'ORDER_ID_CONFLICT')
            if self.killed:
                return 'KILL_REJECT'
            if not self.fresh:
                return 'STALE_REJECT'
            if side not in ('BUY', 'SELL') or type(qty) is not int or qty <= 0 or type(price) is not int or price <= 0:
                return 'INVALID_ORDER'
            low, high = self.bounds()
            low -= qty if side == 'SELL' else 0
            high += qty if side == 'BUY' else 0
            if low < -self.limit or high > self.limit:
                return 'LIMIT_REJECT'
            self.orders[cid] = Order(side, qty, price)
            return 'ACCEPT'
        order = self.orders[event['cid']]
        if kind == 'cancel_request':
            order.cancel_pending = True
            return 'CANCEL_PENDING'
        if kind == 'cancel_ack':
            order.cancelled, order.cancel_pending = True, False
            return 'CANCELLED'
        if kind == 'fill':
            payload = tuple(event[k] for k in ('cid', 'quantity', 'price', 'fee'))
            eid = event['eid']
            if eid in self.executions:
                return 'DUPLICATE_FILL' if self.executions[eid] == payload else 'EXECUTION_ID_CONFLICT'
            _, qty, price, fee = payload
            if any(type(v) is not int for v in (qty, price, fee)) or qty <= 0 or price <= 0 or fee < 0 or order.filled + qty > order.quantity:
                raise ValueError('Fill outside the declared teaching subset')
            sign = 1 if order.side == 'BUY' else -1
            self.position += sign * qty
            self.cash -= sign * qty * price + fee
            order.filled += qty
            self.executions[eid] = payload
            return 'LATE_FILL' if order.cancelled else 'FILL'
        raise ValueError(kind)

    def state(self):
        return dict(cash_cents=self.cash, position=self.position, risk_bounds=self.bounds(),
                    sequence=self.sequence, fresh=self.fresh, killed=self.killed,
                    orders={k: asdict(v) for k, v in self.orders.items()},
                    executions=self.executions)


def trading_system_case(folder):
    def new(cid, side='BUY', qty=8):
        return dict(kind='new', cid=cid, side=side, quantity=qty, price=1000)
    def fill(eid, qty, cid='O1'):
        return dict(kind='fill', cid=cid, eid=eid, quantity=qty, price=1000, fee=2)
    events = [dict(kind='snapshot', sequence=10), new('O1'), new('O1'), new('O1', qty=7),
              new('LIMIT', qty=4), fill('E1', 3), fill('E1', 3),
              dict(kind='cancel_request', cid='O1'), new('PENDING', qty=8),
              dict(kind='cancel_ack', cid='O1'), fill('E2', 2),
              dict(kind='delta', sequence=12), dict(kind='delta', sequence=13),
              new('STALE', qty=1), dict(kind='snapshot', sequence=20),
              new('TOO_LARGE', qty=6), new('O2', side='SELL', qty=5),
              dict(kind='kill'), new('KILLED', qty=1),
              dict(kind='cancel_request', cid='O2'), dict(kind='cancel_ack', cid='O2')]

    def replay():
        engine, rows = Engine(), []
        for i, event in enumerate(events):
            outcome = engine.apply(event)
            low, high = engine.bounds()
            rows.append(dict(index=i, event=json.dumps(event, sort_keys=True), outcome=outcome,
                             position=engine.position, cash_cents=engine.cash, lower=low, upper=high,
                             fresh=engine.fresh, killed=engine.killed))
        digest = hashlib.sha256(json.dumps(dict(rows=rows, state=engine.state()), sort_keys=True).encode()).hexdigest()
        return engine, rows, digest
    engine, rows, digest = replay()
    assert replay()[2] == digest
    assert engine.position == 5 and engine.cash == 94996
    expected = {2:'DUPLICATE_ORDER', 3:'ORDER_ID_CONFLICT', 4:'LIMIT_REJECT',
                6:'DUPLICATE_FILL', 7:'CANCEL_PENDING', 8:'LIMIT_REJECT', 10:'LATE_FILL',
                11:'DATA_GAP', 12:'DATA_GAP', 13:'STALE_REJECT', 15:'LIMIT_REJECT', 18:'KILL_REJECT'}
    assert all(rows[i]['outcome'] == outcome for i, outcome in expected.items())
    assert rows[5]['cash_cents'] == rows[6]['cash_cents'] == 96998
    assert rows[7]['upper'] == 8 and rows[9]['upper'] == 3
    assert rows[13]['position'] == rows[14]['position'] == 5
    # Freshness and kill gates apply to new orders, never to genuine existing fills.
    isolated = Engine()
    isolated.apply(dict(kind='snapshot', sequence=1))
    isolated.apply(new('O1', qty=2))
    isolated.apply(dict(kind='delta', sequence=3))
    isolated.apply(dict(kind='kill'))
    assert isolated.apply(fill('X1', 1)) == 'FILL' and isolated.position == 1
    assert isolated.apply(dict(kind='cancel_request', cid='O1')) == 'CANCEL_PENDING'
    conflict = fill('X1', 2)
    assert isolated.apply(conflict) == 'EXECUTION_ID_CONFLICT' and isolated.position == 1
    # An opposing sell cannot erase the upper bound of an outstanding buy.
    interval = Engine()
    interval.apply(dict(kind='snapshot', sequence=1))
    interval.apply(new('B', qty=8))
    interval.apply(new('S', side='SELL', qty=8))
    assert interval.bounds() == (-8, 8) and interval.apply(new('B2', qty=4)) == 'LIMIT_REJECT'
    write_csv(folder, 'order_replay.csv', rows)
    return dict(events=len(events), initial_cash_cents=100000, position_limit=10,
                final=engine.state(), replay_sha256=digest,
                outcomes=[r['outcome'] for r in rows],
                checks=dict(replay_deterministic=True, pending_risk=True, duplicate_fill=True,
                            cancel_pending_reservation=True, late_fill_accounted=True,
                            id_payload_conflicts=True, gap_until_snapshot=True,
                            snapshot_preserves_position=True, kill_and_stale_keep_fills=True,
                            opposing_orders_not_netted=True, integer_cash_ledger=True))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/research-results.json')
    parser.add_argument('--artifacts-dir', type=Path, default=ROOT / 'examples/output')
    args = parser.parse_args()
    result = dict(schema_version=1, data='fixed-seed synthetic data / scripted local events',
                  source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  timeseries=timeseries_case(args.artifacts_dir),
                  machine_learning=machine_learning_case(args.artifacts_dir),
                  trading_system=trading_system_case(args.artifacts_dir))
    artifacts = sorted(args.artifacts_dir.glob('*.csv'))
    result['artifacts'] = [dict(name=p.name, sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in artifacts]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('PASS: rolling forecasts, nested validation, 3 cost paths, replay and fault invariants')
    print('Wrote', args.output, 'and', len(artifacts), 'CSV artifacts')


if __name__ == '__main__':
    main()
