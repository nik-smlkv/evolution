#!/usr/bin/env python3
"""Generate static homepage routes, or check that committed routes are current."""

import argparse
from pathlib import Path
import sys

from home_routes import HomeRouteError, generate_home_routes, validate_home_routes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check", action="store_true", help="Validate generated files without writing")
    args = parser.parse_args()
    try:
        routes = (validate_home_routes if args.check else generate_home_routes)(args.root)
    except (HomeRouteError, OSError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print("{} {} homepage routes.".format("Checked" if args.check else "Generated", len(routes)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
