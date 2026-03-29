import argparse
from pathlib import Path

import pandas as pd


def resolve_input_path(input_path: Path) -> Path:
    if input_path.is_absolute() and input_path.exists():
        return input_path

    candidate_paths = [
        Path.cwd() / input_path,
        Path(__file__).resolve().parent / input_path,
        Path(__file__).resolve().parent.parent / input_path,
        Path(__file__).resolve().parent.parent / "Data" / input_path.name,
    ]

    for candidate in candidate_paths:
        if candidate.exists():
            return candidate.resolve()

    raise FileNotFoundError(
        f"Input file not found: '{input_path}'. "
        "Use an absolute path or a path relative to current folder/project root."
    )


def read_table(file_path: Path) -> pd.DataFrame:
    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(file_path)
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(file_path)
    raise ValueError("Unsupported input format. Use .csv, .xlsx, or .xls")


def write_table(df: pd.DataFrame, file_path: Path) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        df.to_csv(file_path, index=False)
        return
    if suffix in {".xlsx", ".xls"}:
        df.to_excel(file_path, index=False)
        return
    raise ValueError("Unsupported output format. Use .csv, .xlsx, or .xls")


def build_default_output_path(input_path: Path) -> Path:
    return input_path.with_name(f"{input_path.stem}_no_empty_rows{input_path.suffix}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove rows that contain empty values in any column."
    )
    parser.add_argument(
        "input_file",
        type=Path,
        help="Path to input file (.csv, .xlsx, .xls)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Path to output file. Default: <input>_no_empty_rows.<ext>",
    )

    args = parser.parse_args()

    input_path = resolve_input_path(args.input_file)
    output_path = args.output or build_default_output_path(input_path)
    if not output_path.is_absolute():
        output_path = (Path.cwd() / output_path).resolve()

    df = read_table(input_path)
    original_rows = len(df)

    # Treat empty/whitespace-only strings as missing values.
    df = df.replace(r"^\s*$", pd.NA, regex=True)

    cleaned_df = df.dropna(axis=0, how="any")
    removed_rows = original_rows - len(cleaned_df)

    write_table(cleaned_df, output_path)

    print(f"Input file: {input_path}")
    print(f"Output file: {output_path}")
    print(f"Rows before: {original_rows}")
    print(f"Rows after : {len(cleaned_df)}")
    print(f"Removed    : {removed_rows}")


if __name__ == "__main__":
    main()