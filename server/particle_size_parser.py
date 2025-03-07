
import pandas as pd
import csv
import re
import logging
import traceback
import json
import sys
import io

# Set up a logger for the parser
logger = logging.getLogger("parserLogger")
logger.setLevel(logging.DEBUG)  # Changed to DEBUG for more verbose output
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

def parser(file_path):
    """
    Parses a file and returns a DataFrame.
    Logs are output using the logger.
    """
    logger.info(f"Starting to parse file: {file_path}")
    data_table = pd.DataFrame()
    chart_table = pd.DataFrame()
    
    t1_rows = 0
    blank_row_count = 0
    blank_rows = {}

    try:
        # Read the file line-by-line to detect blank rows
        logger.debug("Reading file to detect blank rows")
        with open(file_path, newline='', encoding='utf-16') as csvfile:
            csv_reader = csv.reader(csvfile, delimiter='\t', quotechar='|')
            for row in csv_reader:
                t1_rows += 1
                # If row is completely empty or the first column is empty
                if not row or not row[0]:
                    blank_row_count += 1
                    blank_rows[blank_row_count] = t1_rows
                    logger.debug(f"Found blank row #{blank_row_count} at line {t1_rows}")
                    # Stop after finding the second blank row
                    if blank_row_count == 2:
                        break

        if blank_row_count < 2:
            err_msg = ("Parsing failed: Could not locate two distinct blank rows in the file. "
                       "Check file format.")
            logger.error(err_msg)
            return pd.DataFrame()

        blank_row_1 = blank_rows[1]
        blank_row_2 = blank_rows[2]
        num_rows_between_blank_rows = blank_row_2 - blank_row_1 - 2
        
        logger.debug(f"First blank row at line {blank_row_1}, second at {blank_row_2}")
        logger.debug(f"Number of rows between blank rows: {num_rows_between_blank_rows}")

        # Read the relevant data sections into dataframes
        logger.debug("Reading table2 (metadata)")
        table2 = pd.read_csv(
            file_path, 
            encoding="utf-16", 
            delimiter="\t", 
            skiprows=blank_row_1, 
            nrows=num_rows_between_blank_rows, 
            index_col=0, 
            on_bad_lines='skip'
        ).transpose()

        logger.debug("Reading table3 (measurement data)")
        table3 = pd.read_csv(
            file_path, 
            encoding="utf-16", 
            delimiter="\t", 
            skiprows=blank_row_2 + 2, 
            nrows=100, 
            quoting=csv.QUOTE_NONNUMERIC, 
            decimal=","
        )
    except Exception as e:
        err_msg = f"Parsing failed while reading file: {str(e)}"
        logger.exception(err_msg)
        return pd.DataFrame()

    try:
        logger.debug("Processing table data")
        # Coerce numeric values in the first column of table3
        numeric_coerced = pd.to_numeric(table3.iloc[:, 0], errors='coerce')
        table3.iloc[:, 0] = numeric_coerced.fillna(table3.iloc[:, 0])
        
        # Build temporary chart data to avoid repeated DataFrame copying
        logger.debug("Building chart data from measurements")
        tmp_chart_data = {}  # { row_key (Comment 2): { col_label: value } }
        for idx, row_data in table3.iloc[:, :blank_row_1].iterrows():
            col_label = row_data.iloc[1]
            # Process data columns starting from the third column
            for file in row_data.index.values[2:]:
                try:
                    row_key = table2.loc[file]["Comment 2"]
                    value = float(row_data.loc[file])
                    if row_key not in tmp_chart_data:
                        tmp_chart_data[row_key] = {}
                    tmp_chart_data[row_key][col_label] = value
                except (KeyError, ValueError) as e:
                    logger.warning(f"Skipping data point due to error: {e}")
                    pass

        tmp_chart = pd.DataFrame.from_dict(tmp_chart_data, orient='index')
        chart_table = pd.concat([chart_table, tmp_chart], axis=0, ignore_index=True)
        chart_table.insert(0, "0.1", 0.00)

        # Process table2 into data_table
        logger.debug("Processing metadata table")
        table2.reset_index(drop=True, inplace=True)
        data_table = pd.concat([data_table, table2], axis=0, ignore_index=True)
        data_table.dropna(how='all', axis=0, inplace=True)

        # Convert numeric columns in data_table (assuming columns starting from 3rd are numeric)
        logger.debug("Converting numeric columns")
        numeric_columns = data_table.iloc[:, 2:]
        data_table.iloc[:, 2:] = (
            numeric_columns
            .apply(lambda x: x.str.replace(',', '.'))
            .astype(float)
        )

        # Combine data_table & chart_table side-by-side
        logger.debug("Combining data and chart tables")
        CAM_table = pd.concat([data_table, chart_table], axis=1)
        CAM_table = CAM_table.rename(columns={'Comment 1': 'MRA_no', 'Comment 2': 'Label_OU_SR'})
        
        # Helper functions to extract text patterns
        def extract_method_short(value):
            pattern = r'^(M[0-9][;,:]?)(.*)'
            match = re.match(pattern, value)
            if match:
                return match.group(1).rstrip(';,:'), match.group(2).strip()
            return None, value
             
        def extract_trial(s):
            pattern = r'([^, ]+)[, ]?(.*)'
            match = re.search(pattern, s)
            if match:
                return match.group(1), match.group(2).strip()
            return s, ''
        
        def extract_trial_without_letter(s):
            pattern = r'([A-Z]{3}\d{2}-\d[A-Z]\d{0,2})'
            match = re.search(pattern, s, re.IGNORECASE)
            return match.group(1) if match else s
        
        # Extract and modify Label_OU_SR, inserting new columns
        logger.debug("Extracting and formatting label information")
        results = CAM_table['Label_OU_SR'].apply(extract_method_short)
        CAM_table['Label_OU_SR'] = results.apply(lambda x: x[1])
        CAM_table.insert(0, 'Method_short', results.apply(lambda x: x[0]))
        
        results2 = CAM_table['Label_OU_SR'].apply(extract_trial)
        CAM_table.insert(1, 'Trial', results2.apply(lambda x: x[0]))
        CAM_table.insert(2, 'Intermediate_Form', results2.apply(lambda x: x[1]))
        CAM_table.insert(3, 'Batch', CAM_table['Trial'].apply(extract_trial_without_letter))
        
        logger.debug("Creating final unpivoted data table")
        num_columns = CAM_table.shape[1]
        CAM_table_unpivot = CAM_table.melt(
            id_vars=CAM_table.columns[:num_columns - 101],
            value_vars=CAM_table.columns[-101:], 
            var_name='Size_class', 
            value_name='Value'
        )
    except Exception as e:
        err_msg = f"Parsing failed while processing data: {str(e)}"
        logger.exception(err_msg)
        return pd.DataFrame()

    logger.info("Parsing completed successfully.")
    return CAM_table_unpivot

# Function to handle file from stdin and output to stdout (for API use)
def handle_api_request():
    try:
        # Get the temp file path from command line arguments
        if len(sys.argv) < 2:
            logger.error("No file path provided in command line arguments")
            print(json.dumps({
                "success": False,
                "error": {
                    "message": "No file path provided",
                    "details": "The parser requires a file path as command line argument"
                }
            }))
            return
            
        file_path = sys.argv[1]
        logger.info(f"Processing file: {file_path}")
        
        # Parse the file
        result_df = parser(file_path)
        
        if result_df.empty:
            logger.error("Parser returned empty DataFrame")
            print(json.dumps({
                "success": False,
                "error": {
                    "message": "Parsing failed",
                    "details": "The parser returned an empty DataFrame. Check the logs for details."
                }
            }))
            return
            
        # Convert DataFrame to JSON and return
        json_result = result_df.to_json(orient='records')
        
        logger.info(f"Successfully parsed file. Found {len(result_df)} data points.")
        print(json.dumps({
            "success": True,
            "data": json.loads(json_result)
        }))
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Unhandled exception: {error_details}")
        print(json.dumps({
            "success": False,
            "error": {
                "message": str(e),
                "details": error_details
            }
        }))

if __name__ == "__main__":
    handle_api_request()
