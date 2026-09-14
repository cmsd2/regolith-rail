# /// script
# requires-python = ">=3.12"
# dependencies = ["sympy==1.14.0", "scipy==1.16.2", "numpy==2.5.3", "mpmath==1.3.0"]
# ///
"""Checks for a documentation page. Run with `uv run --script <file> [name ...]`."""


def check_t_critical():
    from scipy import stats

    assert round(stats.t.ppf(0.975, 29), 3) == 2.045, "t for 30 runs"
    assert round(stats.t.ppf(0.975, 99), 3) == 1.984, "t for 100 runs"
    assert round(stats.norm.ppf(0.975), 2) == 1.96, "normal limit"


def check_base_stock_level():
    from scipy import stats

    # Backorder cost 10 and holding cost 1 give a ratio of 10/11; demand over the interval is Poisson with mean 9.
    ratio = 10 / 11
    level = int(stats.poisson.ppf(ratio, 9))
    assert level == 13, f"level {level}"
    assert stats.poisson.cdf(12, 9) < ratio <= stats.poisson.cdf(13, 9), "smallest such level"


def check_interval_example():
    import math

    from scipy import stats

    # 100 runs with a sample mean of 7.9 and a sample standard deviation of 1.4.
    half = stats.t.ppf(0.975, 99) * 1.4 / math.sqrt(100)
    assert round(half, 2) == 0.28, f"half width {half}"
    assert (round(7.9 - half, 2), round(7.9 + half, 2)) == (7.62, 8.18), "interval"


def check_paired_example():
    import math

    # Two policies each with a standard deviation of 1.4 over seeds, correlated at 0.9 on shared seeds.
    independent = math.sqrt(1.4**2 + 1.4**2)
    paired = math.sqrt(1.4**2 + 1.4**2 - 2 * 0.9 * 1.4 * 1.4)
    assert round(independent, 2) == 1.98, f"independent {independent}"
    assert round(paired, 2) == 0.63, f"paired {paired}"


def check_monte_carlo_pi():
    import math

    import numpy as np

    # Monte Carlo in miniature: the share of random points in a quarter circle estimates pi / 4.
    rng = np.random.default_rng(2024)
    points = rng.random((400_000, 2))
    estimate = 4 * np.mean((points**2).sum(axis=1) <= 1)
    standard_error = 4 * math.sqrt((math.pi / 4) * (1 - math.pi / 4) / 400_000)
    assert abs(estimate - math.pi) < 3 * standard_error, f"estimate {estimate}"
    assert round(standard_error, 4) == 0.0026, f"standard error {standard_error}"


# runner: shared by every checks script. Keep in sync with packages/docs/checks/template.checks.py.
if __name__ == "__main__":
    import sys

    wanted = {name.replace("-", "_") for name in sys.argv[1:]}
    failed = []
    for name, check in sorted(globals().items()):
        if not name.startswith("check_") or (wanted and name[6:] not in wanted):
            continue
        try:
            check()
        except AssertionError as error:
            failed.append(f"{name[6:].replace('_', '-')}: {error}")
    for failure in failed:
        print(f"check failed: {failure}", file=sys.stderr)
    sys.exit(1 if failed else 0)
