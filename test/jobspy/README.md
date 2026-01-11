# JobSpy Demo Scripts

Simple scripts demonstrating how to use JobSpy to scrape job postings for InternAtlas.

## Installation

```bash
cd test/jobspy
pip install -r requirements.txt
```

## Usage

### Simple Example
The most basic usage - search and save jobs:

```bash
python simple_example.py
```

### Full Demo
More comprehensive demo with multiple searches:

```bash
python demo_jobspy.py
```

## Features

- ✅ Scrapes from Indeed, LinkedIn, ZipRecruiter, Google
- ✅ Filters for internships and new grad positions
- ✅ Saves results to CSV
- ✅ Handles errors gracefully
- ✅ Supports multiple locations

## Example Output

The scripts will create CSV files with the following columns:
- site
- title
- company
- location
- job_type
- job_url
- description
- date_posted
- salary info (if available)

## Tips

1. **For Indeed**: Use specific search syntax
   - `"exact phrase"` for exact matches
   - `-word` to exclude words
   - `(word1 OR word2)` for alternatives

2. **Rate Limiting**: 
   - Wait between searches
   - Consider using proxies for large scrapes
   - Indeed is the most reliable (no rate limiting)

3. **Best Results**:
   - Be specific with search terms
   - Use location filters effectively
   - Adjust `hours_old` to get recent postings
