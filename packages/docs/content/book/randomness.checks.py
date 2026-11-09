# /// script
# requires-python = ">=3.12"
# dependencies = ["sympy==1.14.0", "scipy==1.16.2", "numpy==2.5.3", "mpmath==1.3.0"]
# ///
"""Checks for a documentation page. Run with `uv run --script <file> [name ...]`."""


def check_t_critical():
    from scipy import stats

    assert round(stats.t.ppf(0.975, 9), 3) == 2.262, "t for 10 replications"
    assert round(stats.t.ppf(0.975, 24), 3) == 2.064, "t for 25 replications"
    assert round(stats.t.ppf(0.975, 99), 3) == 1.984, "t for 100 replications"
    assert round(stats.t.ppf(0.975, 399), 3) == 1.966, "t for 400 replications"
    assert round(stats.norm.ppf(0.975), 2) == 1.96, "normal limit"


def check_known_mean_intervals():
    import math

    from scipy import stats

    # Total demand has standard deviation sqrt(14.4). Half-widths with 25, 100 and 400 replications.
    sigma = math.sqrt(14.4)
    halves = [stats.t.ppf(0.975, n - 1) * sigma / math.sqrt(n) for n in (25, 100, 400)]
    assert [round(h, 2) for h in halves] == [1.57, 0.75, 0.37], f"half-widths {halves}"


def check_interval_example():
    import math

    from scipy import stats

    # 100 replications with a sample mean of 27.97 and a sample standard deviation of 3.00.
    half = stats.t.ppf(0.975, 99) * 3.00 / math.sqrt(100)
    assert round(half, 2) == 0.60, f"half-width {half}"
    assert (round(27.97 - half, 2), round(27.97 + half, 2)) == (27.37, 28.57), "interval"


def check_paired_intervals():
    import math

    from scipy import stats

    t = stats.t.ppf(0.975, 99)
    # Stalled production over 100 replications: differences with standard deviation 2.92,
    # against 3.71 for independent replications.
    assert round(t * 2.92 / 10, 2) == 0.58, "paired half-width"
    assert round(t * 3.71 / 10, 2) == 0.74, "independent half-width"
    # Ten replications of the difference in unmet demand, with standard deviation 2.55.
    assert round(stats.t.ppf(0.975, 9) * 2.55 / math.sqrt(10), 2) == 1.82, "ten replications"


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
