# /// script
# requires-python = ">=3.12"
# dependencies = ["sympy==1.14.0", "scipy==1.16.2", "numpy==2.5.3", "mpmath==1.3.0"]
# ///
"""Checks for a documentation page. Run with `uv run --script <file> [name ...]`."""


def check_quantile():
    from scipy import stats

    assert stats.poisson.ppf(0.9, 20) == 26, "quantile"


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
