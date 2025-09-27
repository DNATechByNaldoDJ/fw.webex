# html2fwwebex.py

html2fwwebex.py is a Python script that converts HTML files into TLPP format, specifically tailored for generating WebExControl-based code for the fwWebEx framework. It uses the BeautifulSoup library to parse HTML and transform its structure into a TLPP file with hierarchical WebExControl objects.
Features

- Converts HTML tags into WebExControl objects.
- Preserves attributes like class, id, src, href, and others, mapping them to SetAttr or SetFixedID calls.
- Handles nested HTML elements, generating appropriate AddChild calls.
- Supports textual content within tags via SetContent.
- Accepts input and output file paths as command-line arguments for flexibility.

---

Prerequisites
To use this script, ensure you have the following installed:

Python 3.6 or higher: The script is written in Python 3 and requires a compatible version.
BeautifulSoup4: A Python library for parsing HTML files.
(Optional) lxml: A parser library that can be used with BeautifulSoup for faster HTML parsing.

---

Installation

- Install Python: Download and install Python from python.org if you don't already have it.
- Install BeautifulSoup4: Use pip to install the beautifulsoup4 package:pip install beautifulsoup4

For Python 3, you may need to use:python3 -m pip install beautifulsoup4

(Optional) Install lxml: For improved parsing performance, install the lxml parser:pip install lxml

Verify Installation: Ensure the libraries are installed by running:python -c "from bs4 import BeautifulSoup"

If no errors appear, you're ready to proceed.

---

Usage
The script is executed from the command line and requires two arguments:

input_file: The path to the input HTML file to be converted.
output_file: The path to the output TLPP file where the converted code will be saved.

Command Syntax

```bash
python sbadmin2fwwebex.py <input_file> <output_file>
```

Example
To convert an HTML file named index.html to a TLPP file named fwwebex_converted.tlpp, run:

```bash
python sbadmin2fwwebex.py index.html fwwebex_converted.tlpp
```

This command will:

- Read the index.html file.
- Parse its structure using BeautifulSoup.
- Convert the HTML elements into WebExControl objects in TLPP format.
- Save the result to fwwebex_converted.tlpp.
- Print a confirmation message: Arquivo TLPP gerado com sucesso em fwwebex_converted.tlpp!

---

Help Command
To view the script's help message, run:

```bash
python sbadmin2fwwebex.py -h


Output:
usage: sbadmin2fwwebex.py [-h] input_file output_file
Converte arquivo HTML para TLPP.

positional arguments:
  input_file   Caminho para o arquivo HTML de entrada
  output_file  Caminho para o arquivo TLPP de saída

options:
  -h, --help   show this help message and exit
```

---

How It Works

HTML Parsing: The script uses BeautifulSoup to parse the input HTML file, starting from the <body> tag.
Element Processing:
Each HTML tag is converted into a WebExControl object with a unique variable name (e.g., oDiv1).
Attributes (e.g., class, id, src, href, data-bs-toggle) are mapped to SetAttr or SetFixedID calls.
Text content within tags is added using SetContent.
Nested elements are processed recursively, with parent-child relationships established via AddChild.

Output Generation: The processed structure is written to the output TLPP file in a hierarchical format compatible with fwWebEx.

---

Notes

- The script assumes the input HTML file is well-formed and contains a <body> tag.
- The output TLPP file is encoded in UTF-8 to support special characters.
- Ensure the input file exists and is accessible, or the script will raise an error.
- The script preserves the hierarchy of the HTML structure but only processes direct children of each element to avoid excessive recursion.

---

Troubleshooting

ModuleNotFoundError: No module named 'bs4': Install BeautifulSoup4 using the pip command above.
FileNotFoundError: Ensure the input file path is correct and the file exists.
Invalid HTML: If the input HTML is malformed, the script may produce unexpected results. Use a tool like an HTML validator to check the input file.
Permission Denied: Ensure you have write permissions in the directory where the output TLPP file will be saved.

---

License
This script is provided as-is for use with the fwWebEx framework. No specific license is applied unless otherwise stated by the author.
